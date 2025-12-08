import {
  FlowDefinition,
  FlowRun,
  TaskRun,
  TaskState,
  FlowRegistrationPayload,
  TaskResult
} from '../types';
import { flowDb, runDb, statsDb } from '../database/db';
import { generateFlowReport } from '../utils/reportGenerator';

/**
 * FlowEngine - Core workflow orchestration engine
 *
 * Manages flow definitions, executions, and real-time state updates.
 * Provides pub/sub mechanism for state changes.
 */
export class FlowEngine {
  private flows: FlowDefinition[] = [];
  private runs: FlowRun[] = [];
  private stateChangeListeners: (() => void)[] = [];
  private flowTriggerListeners: ((runId: string, flowName: string, configuration: string) => void)[] = [];
  private tickInterval: NodeJS.Timeout;
  private readonly TICK_INTERVAL_MS = 100;
  private simulationEnabled: boolean = false; // Disable simulation by default for real Python execution
  private lastClientHeartbeat: number | null = null;
  private readonly HEARTBEAT_TIMEOUT_MS = 10000; // 10 seconds
  private heartbeatCheckInterval: NodeJS.Timeout;

  constructor(enableSimulation: boolean = false) {
    this.simulationEnabled = enableSimulation;

    // Load existing flows and runs from database
    console.log('[FlowEngine] Loading flows and runs from database...');
    this.flows = flowDb.getAllFlows();
    this.runs = runDb.getAllRuns();
    console.log(`[FlowEngine] Loaded ${this.flows.length} flows and ${this.runs.length} runs from database`);

    // Fail any stuck flows from previous server instance
    this.failStuckFlows();

    // Start the simulation loop for progress updates
    this.tickInterval = setInterval(() => this.tick(), this.TICK_INTERVAL_MS);
    // Start heartbeat check loop
    this.heartbeatCheckInterval = setInterval(() => this.checkHeartbeat(), 1000);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: () => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(l => l !== listener);
    };
  }

  /**
   * Subscribe to flow trigger events
   */
  subscribeToFlowTriggers(
    listener: (runId: string, flowName: string, configuration: string) => void
  ): () => void {
    this.flowTriggerListeners.push(listener);
    return () => {
      this.flowTriggerListeners = this.flowTriggerListeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all state change listeners
   */
  private notifyStateChange(): void {
    this.stateChangeListeners.forEach(l => l());
  }

  /**
   * Notify all flow trigger listeners
   */
  private notifyFlowTrigger(runId: string, flowName: string, configuration: string): void {
    this.flowTriggerListeners.forEach(l => l(runId, flowName, configuration));
  }

  /**
   * Get all flow definitions
   */
  getFlows(): FlowDefinition[] {
    return this.flows;
  }

  /**
   * Get all flow runs, sorted by start time (newest first)
   */
  getRuns(): FlowRun[] {
    return this.runs.sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  /**
   * Get a specific flow by ID
   */
  getFlow(id: string): FlowDefinition | undefined {
    return this.flows.find(f => f.id === id);
  }

  /**
   * Get a specific run by ID
   */
  getRun(id: string): FlowRun | undefined {
    return this.runs.find(r => r.id === id);
  }

  /**
   * Add a log message to a running flow
   */
  addFlowLog(runId: string, log: string): void {
    const run = this.runs.find(r => r.id === runId);
    if (run) {
      run.logs.push(log);
      runDb.saveRun(run);
      this.notifyStateChange();
    }
  }

  /**
   * Update task state for a running flow
   */
  updateTaskState(runId: string, taskIndex: number, state: TaskState | string, progress?: number, durationMs?: number, result?: TaskResult): boolean {
    const run = this.runs.find(r => r.id === runId);
    if (!run || !run.tasks[taskIndex]) {
      return false;
    }

    const task = run.tasks[taskIndex];
    // Convert string to TaskState enum (handle both uppercase and lowercase)
    const stateStr = typeof state === 'string' ? state.toUpperCase() : state;
    task.state = stateStr as TaskState;

    if (progress !== undefined) {
      task.progress = progress;
    }

    if (durationMs !== undefined) {
      task.durationMs = durationMs;
    }

    if (result !== undefined) {
      task.result = result;
    }

    if (stateStr === 'RUNNING') {
      task.startTime = new Date().toISOString();
    } else if (stateStr === 'COMPLETED' || stateStr === 'FAILED') {
      task.endTime = new Date().toISOString();
      task.progress = stateStr === 'COMPLETED' ? 100 : task.progress;

      // Update statistics when task completes successfully
      if (stateStr === 'COMPLETED' && task.durationMs !== undefined) {
        try {
          statsDb.updateTaskStats(run.flowName, task.taskName, task.durationMs);
          console.log(`[FlowEngine] Updated statistics for ${run.flowName}/${task.taskName}: ${task.durationMs}ms`);
        } catch (error) {
          console.error(`[FlowEngine] Failed to update statistics:`, error);
        }
      }
    }

    // Update run state if all tasks complete or any failed
    const allCompleted = run.tasks.every(t => t.state === TaskState.COMPLETED);
    const anyFailed = run.tasks.some(t => t.state === TaskState.FAILED);

    if (allCompleted && !anyFailed) {
      run.state = TaskState.COMPLETED;
      run.progress = 100;
      run.endTime = new Date().toISOString();
      // Generate report on successful completion
      generateFlowReport(run, run.clientName || 'default');
    } else if (anyFailed) {
      run.state = TaskState.FAILED;
      run.endTime = new Date().toISOString();
      // Generate report on failure
      generateFlowReport(run, run.clientName || 'default');
    } else {
      // Update weighted progress
      this.updateRunProgress(run);
    }

    runDb.saveRun(run);
    this.notifyStateChange();
    return true;
  }

  /**
   * Register a new flow definition (typically called by Python clients)
   */
  registerFlow(payload: FlowRegistrationPayload): FlowDefinition {
    // Prevent duplicate registration
    if (this.flows.some(f => f.name === payload.name)) {
      return this.flows.find(f => f.name === payload.name)!;
    }

    // Get statistics for this flow
    const flowStats = statsDb.getFlowStats(payload.name);
    console.log(`[FlowEngine] Registering flow '${payload.name}' with ${flowStats.size} task statistics available`);

    // Determine duration for each task (use statistics if available, otherwise use estimatedTime)
    const taskDurations = payload.tasks.map(t => {
      const estimatedTime = t.estimatedTime || 1000;
      const stats = flowStats.get(t.name);

      // Use statistics if we have at least 2 samples (to ensure some reliability)
      if (stats && stats.sampleCount >= 2) {
        console.log(`[FlowEngine] Using statistics for ${payload.name}/${t.name}: ${Math.round(stats.avgDurationMs)}ms (${stats.sampleCount} samples) vs estimated ${estimatedTime}ms`);
        return stats.avgDurationMs;
      } else {
        console.log(`[FlowEngine] Using estimated time for ${payload.name}/${t.name}: ${estimatedTime}ms (no statistics)`);
        return estimatedTime;
      }
    });

    // Calculate total duration for weight calculation
    const totalDuration = taskDurations.reduce((sum, duration) => sum + duration, 0);

    const newFlow: FlowDefinition = {
      id: `flow-${this.generateId()}`,
      name: payload.name,
      description: payload.description,
      codeSnippet: '',
      tags: payload.tags,
      tasks: payload.tasks.map((t, index) => {
        const duration = taskDurations[index];
        const clientEstimatedTime = t.estimatedTime || 1000;
        const stats = flowStats.get(t.name);

        // Use statistics for estimatedTime if we have at least 2 samples, otherwise use client's estimate
        const estimatedTime = (stats && stats.sampleCount >= 2)
          ? Math.round(stats.avgDurationMs)
          : clientEstimatedTime;

        // Calculate weight as: duration / totalDuration
        const weight = totalDuration > 0 ? duration / totalDuration : 1 / payload.tasks.length;

        return {
          id: `task-${this.generateId()}`,
          name: t.name,
          description: t.description || 'Registered task',
          weight: weight,
          estimatedTime: estimatedTime,
          crucialPass: t.crucialPass ?? true
        };
      }),
      createdAt: new Date().toISOString()
    };

    this.flows.push(newFlow);
    flowDb.saveFlow(newFlow);
    this.notifyStateChange();
    return newFlow;
  }

  /**
   * Remove a flow from the library
   */
  private removeFlow(flowId: string): void {
    this.flows = this.flows.filter(f => f.id !== flowId);
    flowDb.deleteFlow(flowId);
  }

  /**
   * Trigger a flow execution
   */
  triggerFlow(flowId: string, configuration: string = 'development', clientColor?: string, clientName?: string): void {
    const flow = this.flows.find(f => f.id === flowId);
    if (!flow) return;

    const timestamp = new Date().toISOString();

    const newRun: FlowRun = {
      id: `run-${this.generateId()}`,
      flowId: flow.id,
      flowName: flow.name,
      state: TaskState.RUNNING,
      startTime: timestamp,
      configuration: configuration,
      tags: flow.tags,
      logs: [],
      tasks: flow.tasks.map(t => ({
        id: `tr-${this.generateId()}`,
        taskId: t.id,
        taskName: t.name,
        state: TaskState.PENDING,
        logs: [],
        weight: t.weight,
        estimatedTime: t.estimatedTime,
        progress: 0
      })),
      progress: 0,
      clientColor: clientColor,
      clientName: clientName
    };

    this.runs.unshift(newRun);

    // Remove the flow from the library immediately after triggering
    this.removeFlow(flowId);

    // Save the new run to the database
    runDb.saveRun(newRun);

    this.notifyStateChange();

    // Notify clients that a flow has been triggered
    this.notifyFlowTrigger(newRun.id, flow.name, configuration);
  }

  /**
   * Simulation engine tick - updates task progress and state
   */
  private tick(): void {
    // Skip simulation if disabled (for real Python client execution)
    if (!this.simulationEnabled) {
      return;
    }

    let changed = false;

    this.runs.forEach(run => {
      // Skip finished runs
      if (run.state === TaskState.COMPLETED || run.state === TaskState.FAILED) {
        return;
      }

      const pendingTasks = run.tasks.filter(t => t.state === TaskState.PENDING);
      const runningTasks = run.tasks.filter(t => t.state === TaskState.RUNNING);

      // SEQUENTIAL EXECUTION: Start next task if none running
      if (runningTasks.length === 0 && pendingTasks.length > 0) {
        const nextTask = pendingTasks[0];
        nextTask.state = TaskState.RUNNING;
        nextTask.startTime = new Date().toISOString();
        changed = true;
      }

      // Progress running tasks
      runningTasks.forEach(task => {
        // Increment progress based on estimated time
        const progressIncrement = (this.TICK_INTERVAL_MS / task.estimatedTime) * 100;
        task.progress = Math.min(99, task.progress + progressIncrement);
        changed = true;

        // Determine if task finishes
        const isTimeComplete = task.progress >= 95;
        const randomChance = Math.random() > 0.9;

        if (isTimeComplete && randomChance) {
          // Small chance to fail (1%)
          const isFailure = Math.random() > 0.99;
          task.state = isFailure ? TaskState.FAILED : TaskState.COMPLETED;
          task.progress = isFailure ? task.progress : 100;
          task.endTime = new Date().toISOString();
          task.durationMs = Math.floor(task.estimatedTime + (Math.random() * 500 - 250));

          if (isFailure) {
            task.logs.push(`[ERROR] Task failed with exception: ConnectionTimeout`);
          } else {
            task.logs.push(`[INFO] Task completed successfully in ${task.durationMs}ms`);
          }
        } else {
          // Log heartbeat occasionally (3% chance per tick)
          if (Math.random() > 0.97) {
            const heartbeatLogs = [
              `[DEBUG] Processing chunk... ${Math.floor(task.progress)}% done`,
              `[INFO] Heartbeat signal sent`,
              `[DEBUG] Validating schema...`,
              `[INFO] Records processed: ${Math.floor(Math.random() * 500)}`
            ];
            task.logs.push(heartbeatLogs[Math.floor(Math.random() * heartbeatLogs.length)]);
          }
        }
      });

      // Update Run State & Weighted Progress
      this.updateRunProgress(run);

      const isAnyFailed = run.tasks.some(t => t.state === TaskState.FAILED);
      const areAllCompleted = run.tasks.every(t => t.state === TaskState.COMPLETED);

      // Note: We've already filtered out COMPLETED and FAILED runs at the start of forEach
      if (isAnyFailed) {
        run.state = TaskState.FAILED;
        run.endTime = new Date().toISOString();
        changed = true;
      } else if (areAllCompleted) {
        run.state = TaskState.COMPLETED;
        run.progress = 100;
        run.endTime = new Date().toISOString();
        changed = true;
      }
    });

    if (changed) {
      // Save all modified runs to database
      this.runs.forEach(run => {
        if (run.state === TaskState.RUNNING || run.state === TaskState.COMPLETED || run.state === TaskState.FAILED) {
          runDb.saveRun(run);
        }
      });
      this.notifyStateChange();
    }
  }

  /**
   * Calculate weighted progress for a flow run
   */
  private updateRunProgress(run: FlowRun): void {
    const totalWeight = run.tasks.reduce((sum, t) => sum + t.weight, 0);
    let earnedWeight = 0;

    run.tasks.forEach(t => {
      if (t.state === TaskState.COMPLETED) {
        earnedWeight += t.weight * 100;
      } else if (t.state === TaskState.RUNNING || t.state === TaskState.FAILED) {
        earnedWeight += t.weight * t.progress;
      }
    });

    run.progress = totalWeight > 0 ? Math.floor(earnedWeight / totalWeight) : 0;
  }

  /**
   * Generate a random ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  /**
   * Fail any flows that were running when server was restarted
   */
  private failStuckFlows(): void {
    const stuckRuns = this.runs.filter(
      r => r.state === TaskState.RUNNING || r.state === TaskState.PENDING
    );

    if (stuckRuns.length > 0) {
      console.log(`[FlowEngine] Found ${stuckRuns.length} stuck flows from previous server instance - failing them`);

      stuckRuns.forEach(run => {
        run.state = TaskState.FAILED;
        run.endTime = new Date().toISOString();
        run.logs.push('[System] Flow failed: Server was restarted');

        // Mark all running/pending tasks as failed
        run.tasks.forEach(task => {
          if (task.state === TaskState.RUNNING || task.state === TaskState.PENDING) {
            task.state = TaskState.FAILED;
            task.endTime = new Date().toISOString();
            task.logs.push('[System] Task failed: Server was restarted');
          }
        });

        // Save the failed run to database
        runDb.saveRun(run);

        // Generate report for the failed flow
        generateFlowReport(run, run.clientName || 'default');
      });

      this.notifyStateChange();
    }
  }

  /**
   * Update the client heartbeat timestamp
   */
  updateHeartbeat(): void {
    this.lastClientHeartbeat = Date.now();
  }

  /**
   * Check if client heartbeat is stale and fail all running flows
   */
  private checkHeartbeat(): void {
    if (this.lastClientHeartbeat === null) {
      // No client has connected yet
      return;
    }

    const now = Date.now();
    const timeSinceLastHeartbeat = now - this.lastClientHeartbeat;

    if (timeSinceLastHeartbeat > this.HEARTBEAT_TIMEOUT_MS) {
      // Client connection lost - fail all running flows
      const runningRuns = this.runs.filter(
        r => r.state === TaskState.RUNNING || r.state === TaskState.PENDING
      );

      if (runningRuns.length > 0) {
        console.log(`[FlowEngine] Client heartbeat timeout - failing ${runningRuns.length} running flows`);

        runningRuns.forEach(run => {
          run.state = TaskState.FAILED;
          run.endTime = new Date().toISOString();
          run.logs.push('[System] Flow failed: Lost connection to Python client');

          // Mark all running/pending tasks as failed
          run.tasks.forEach(task => {
            if (task.state === TaskState.RUNNING || task.state === TaskState.PENDING) {
              task.state = TaskState.FAILED;
              task.endTime = new Date().toISOString();
              task.logs.push('[System] Task failed: Lost connection to Python client');
            }
          });

          // Save the failed run to database
          runDb.saveRun(run);

          // Generate report for the failed flow
          generateFlowReport(run, run.clientName || 'default');
        });

        this.notifyStateChange();
        // Reset heartbeat to avoid repeated failure notifications
        this.lastClientHeartbeat = null;
      }
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
    }
  }
}

// Export singleton instance
export const flowEngine = new FlowEngine();
