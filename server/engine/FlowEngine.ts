import {
  FlowDefinition,
  FlowRun,
  TaskState,
  FlowRegistrationPayload,
  TaskResult
} from '../types';
import { flowDb, runDb, statsDb } from '../database/db';
import { generateFlowReport } from '../utils/reportGenerator';
import { getActiveClient } from '../routes/clientRoutes';
import { PerformanceMonitor } from './services/PerformanceMonitor';

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
  private performanceMonitor: PerformanceMonitor;

  constructor(enableSimulation: boolean = false) {
    this.simulationEnabled = enableSimulation;
    this.performanceMonitor = new PerformanceMonitor();

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
  updateTaskState(runId: string, taskIndex: number, state: TaskState | string, progress?: number, durationMs?: number, result?: TaskResult, taskName?: string, clientEstimatedTime?: number): boolean {
    const run = this.runs.find(r => r.id === runId);
    if (!run) {
      return false;
    }

    // Dynamically add task if it doesn't exist (for dynamic task execution)
    if (!run.tasks[taskIndex]) {
      const actualTaskName = taskName || `Task ${taskIndex + 1}`;

      // Look up statistics for this task to get estimated time
      // Priority: statistics > client-provided > default 1000ms
      const taskStats = statsDb.getTaskStats(run.flowName, actualTaskName);
      const estimatedTime = taskStats ? Math.round(taskStats.avgDurationMs) : (clientEstimatedTime || 1000);

      if (taskStats) {
        console.log(`[FlowEngine] Using statistics for new dynamic task ${actualTaskName}: ${estimatedTime}ms`);
      } else if (clientEstimatedTime) {
        console.log(`[FlowEngine] Using client-provided estimated time for ${actualTaskName}: ${estimatedTime}ms`);
      }

      // Create a new task entry
      const newTask: TaskRun = {
        id: `tr-${this.generateId()}`,
        taskId: `dynamic-task-${taskIndex}`,
        taskName: actualTaskName,
        state: TaskState.PENDING,
        logs: [],
        weight: 1,  // Will be recalculated
        estimatedTime: estimatedTime,
        progress: 0
      };

      // Ensure array is large enough
      while (run.tasks.length <= taskIndex) {
        run.tasks.push(newTask);
      }
      run.tasks[taskIndex] = newTask;

      // Recalculate weights for all tasks based on estimated times
      const totalEstimatedTime = run.tasks.reduce((sum, t) => sum + t.estimatedTime, 0);
      if (totalEstimatedTime > 0) {
        run.tasks.forEach(t => {
          t.weight = t.estimatedTime / totalEstimatedTime;
        });
      }

      console.log(`[FlowEngine] Dynamically added task ${taskIndex}: ${actualTaskName} (estimated: ${estimatedTime}ms)`);
    }

    const task = run.tasks[taskIndex];

    // Update task name if provided (for dynamic tasks or when name doesn't match)
    if (taskName && task.taskName !== taskName) {
      console.log(`[FlowEngine] Task ${taskIndex} name changed: ${task.taskName} -> ${taskName}`);
      task.taskName = taskName;
    }

    // Don't allow updates to tasks that are already in a terminal state (COMPLETED or FAILED)
    // This prevents the Python client from overwriting FAILED states after Stop is clicked
    if (task.state === TaskState.COMPLETED || task.state === TaskState.FAILED) {
      console.log(`[FlowEngine] Ignoring state update for task ${task.taskName} - already in terminal state ${task.state}`);
      return false;
    }

    // Convert string to TaskState enum (handle both uppercase and lowercase)
    const stateStr = typeof state === 'string' ? state.toUpperCase() : state;
    task.state = stateStr as TaskState;

    if (durationMs !== undefined) {
      task.durationMs = durationMs;
    }

    if (result !== undefined) {
      task.result = result;
    }

    if (stateStr === 'RUNNING') {
      if (!task.startTime) {
        task.startTime = new Date().toISOString();
      }

      // Calculate progress server-side using the server's estimated time (from statistics)
      // This ensures accurate progress even when client has different estimates
      if (task.startTime) {
        const elapsedMs = Date.now() - new Date(task.startTime).getTime();
        // Use server's estimated time for progress calculation
        task.progress = Math.min(99, Math.round((elapsedMs / task.estimatedTime) * 100));
      } else if (progress !== undefined) {
        // Fallback to client progress if no start time yet
        task.progress = progress;
      }

      // Real-time outlier detection for running tasks (check on EVERY update)
      if (task.startTime) {
        const elapsedMs = Date.now() - new Date(task.startTime).getTime();
        const stats = statsDb.getTaskStats(run.flowName, task.taskName);

        if (stats) {
          const activeClient = getActiveClient();
          const sensitivity = activeClient?.performanceSensitivity || 'normal';
          const warning = this.performanceMonitor.detectOutlier(elapsedMs, stats.avgDurationMs, stats.stdDevDurationMs, stats.sampleCount, sensitivity);

          // Only log when warning status changes
          const hadWarning = task.performanceWarning !== undefined;
          const hasWarning = warning !== null;

          if (hasWarning && !hadWarning) {
            console.log(`[FlowEngine] ⚠️  Real-time warning triggered: ${run.flowName}/${task.taskName} - ${warning.message} (elapsed: ${elapsedMs}ms)`);
          } else if (!hasWarning && hadWarning) {
            console.log(`[FlowEngine] ✓  Warning cleared: ${run.flowName}/${task.taskName} - task speed normalized`);
          }

          task.performanceWarning = warning || undefined;
        }
      }
    } else if (stateStr === 'COMPLETED' || stateStr === 'FAILED') {
      task.endTime = new Date().toISOString();
      task.progress = stateStr === 'COMPLETED' ? 100 : task.progress;

      // Check for performance outliers and update statistics on completion
      if (stateStr === 'COMPLETED' && task.durationMs !== undefined) {
        const stats = statsDb.getTaskStats(run.flowName, task.taskName);
        const activeClient = getActiveClient();
        const sensitivity = activeClient?.performanceSensitivity || 'normal';

        if (stats) {
          const warning = this.performanceMonitor.detectOutlier(task.durationMs, stats.avgDurationMs, stats.stdDevDurationMs, stats.sampleCount, sensitivity);
          task.performanceWarning = warning || undefined;
          if (warning) {
            console.log(`[FlowEngine] ⚠️  Performance warning: ${run.flowName}/${task.taskName} - ${warning.message} (excluded from statistics)`);
          } else {
            // Update statistics only if not an outlier
            try {
              statsDb.updateTaskStats(run.flowName, task.taskName, task.durationMs);
              console.log(`[FlowEngine] Updated statistics for ${run.flowName}/${task.taskName}: ${task.durationMs}ms`);
            } catch (error) {
              console.error(`[FlowEngine] Failed to update statistics:`, error);
            }
          }
        } else {
          // No existing statistics, this is the first run - always include
          try {
            statsDb.updateTaskStats(run.flowName, task.taskName, task.durationMs);
            console.log(`[FlowEngine] Initial statistics for ${run.flowName}/${task.taskName}: ${task.durationMs}ms`);
          } catch (error) {
            console.error(`[FlowEngine] Failed to create initial statistics:`, error);
          }
        }
      }
    }

    // Check if any task failed - mark flow as failed immediately
    const anyFailed = run.tasks.some(t => t.state === TaskState.FAILED);

    if (anyFailed) {
      run.state = TaskState.FAILED;
      run.endTime = new Date().toISOString();
      // Generate report on failure
      run.reportPath = generateFlowReport(run, run.clientName || 'default') || undefined;
    } else {
      // Update weighted progress (don't mark as completed - wait for client to signal completion)
      this.updateRunProgress(run);
    }

    runDb.saveRun(run);
    this.notifyStateChange();
    return true;
  }

  /**
   * Complete a flow from client side - removes any predefined tasks that weren't executed
   */
  completeFlow(runId: string, actualTaskCount: number): boolean {
    const run = this.runs.find(r => r.id === runId);
    if (!run) {
      return false;
    }

    // If the run has more tasks than were actually executed, remove the extras
    if (run.tasks.length > actualTaskCount) {
      const removedTasks = run.tasks.slice(actualTaskCount);
      console.log(`[FlowEngine] Removing ${removedTasks.length} unused tasks from run ${runId}: ${removedTasks.map(t => t.taskName).join(', ')}`);
      run.tasks = run.tasks.slice(0, actualTaskCount);

      // Recalculate weights for remaining tasks
      const totalEstimatedTime = run.tasks.reduce((sum, t) => sum + t.estimatedTime, 0);
      if (totalEstimatedTime > 0) {
        run.tasks.forEach(t => {
          t.weight = t.estimatedTime / totalEstimatedTime;
        });
      }
    }

    // Mark all remaining tasks as completed if they're still running/pending
    // (this handles edge cases where the last task update might not have been received)
    const allCompleted = run.tasks.every(t => t.state === TaskState.COMPLETED);
    const anyFailed = run.tasks.some(t => t.state === TaskState.FAILED);

    if (allCompleted && !anyFailed) {
      run.state = TaskState.COMPLETED;
      run.progress = 100;
      if (!run.endTime) {
        run.endTime = new Date().toISOString();
      }

      // Generate report on successful completion
      if (!run.reportPath) {
        run.reportPath = generateFlowReport(run, run.clientName || 'default') || undefined;
      }

      // Save the learned task structure for future runs
      const taskStructure = run.tasks.map(t => ({
        taskName: t.taskName,
        estimatedTime: t.durationMs || t.estimatedTime
      }));
      statsDb.saveFlowTaskStructure(run.flowName, taskStructure);

      // Update flow statistics (only for successful runs WITHOUT warnings)
      const flowDuration = new Date(run.endTime).getTime() - new Date(run.startTime).getTime();
      const hasAnyWarnings = run.tasks.some(t => t.performanceWarning);

      if (!hasAnyWarnings) {
        statsDb.updateFlowStats(run.flowName, flowDuration);
        console.log(`[FlowEngine] Updated flow statistics for ${run.flowName}: ${flowDuration}ms`);
      }
    } else if (anyFailed) {
      run.state = TaskState.FAILED;
      if (!run.endTime) {
        run.endTime = new Date().toISOString();
      }
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
   * Create a run for a flow without notifying clients (for client-initiated execution)
   */
  createRun(flowId: string, configuration: string = 'development', clientColor?: string, clientName?: string): string | undefined {
    const flow = this.flows.find(f => f.id === flowId);
    if (!flow) return undefined;

    const timestamp = new Date().toISOString();

    // Check for learned task structure from previous runs
    const learnedStructure = statsDb.getFlowTaskStructure(flow.name);
    let tasks: TaskRun[];

    if (learnedStructure && learnedStructure.length > 0) {
      // Use learned task structure from previous executions
      // But look up fresh statistics for estimated times
      console.log(`[FlowEngine] Using learned task structure for ${flow.name}: ${learnedStructure.length} tasks`);

      // First pass: get estimated times from statistics (or use saved value as fallback)
      const tasksWithEstimates = learnedStructure.map(t => {
        const taskStats = statsDb.getTaskStats(flow.name, t.taskName);
        const estimatedTime = taskStats ? Math.round(taskStats.avgDurationMs) : t.estimatedTime;
        return { taskName: t.taskName, estimatedTime };
      });

      const totalEstimatedTime = tasksWithEstimates.reduce((sum, t) => sum + t.estimatedTime, 0);

      tasks = tasksWithEstimates.map((t, index) => {
        const weight = totalEstimatedTime > 0 ? t.estimatedTime / totalEstimatedTime : 1 / learnedStructure.length;
        return {
          id: `tr-${this.generateId()}`,
          taskId: `learned-task-${index}`,
          taskName: t.taskName,
          state: TaskState.PENDING,
          logs: [],
          weight: weight,
          estimatedTime: t.estimatedTime,
          progress: 0
        };
      });
    } else {
      // Use tasks from flow registration (static analysis)
      // But check statistics for better estimated times
      console.log(`[FlowEngine] Using static task structure for ${flow.name}: ${flow.tasks.length} tasks`);

      // First pass: get estimated times from statistics (or use registration value as fallback)
      const tasksWithEstimates = flow.tasks.map(t => {
        const taskStats = statsDb.getTaskStats(flow.name, t.name);
        const estimatedTime = taskStats ? Math.round(taskStats.avgDurationMs) : t.estimatedTime;
        if (taskStats) {
          console.log(`[FlowEngine] Using statistics for ${t.name}: ${estimatedTime}ms (vs client: ${t.estimatedTime}ms)`);
        }
        return { ...t, estimatedTime };
      });

      const totalEstimatedTime = tasksWithEstimates.reduce((sum, t) => sum + t.estimatedTime, 0);

      tasks = tasksWithEstimates.map(t => {
        const weight = totalEstimatedTime > 0 ? t.estimatedTime / totalEstimatedTime : t.weight;
        return {
          id: `tr-${this.generateId()}`,
          taskId: t.id,
          taskName: t.name,
          state: TaskState.PENDING,
          logs: [],
          weight: weight,
          estimatedTime: t.estimatedTime,
          progress: 0
        };
      });
    }

    const newRun: FlowRun = {
      id: `run-${this.generateId()}`,
      flowId: flow.id,
      flowName: flow.name,
      state: TaskState.RUNNING,
      startTime: timestamp,
      configuration: configuration,
      tags: flow.tags,
      logs: [],
      tasks: tasks,
      progress: 0,
      clientColor: clientColor,
      clientName: clientName
    };

    this.runs.unshift(newRun);

    // Remove the flow from the library immediately
    this.removeFlow(flowId);

    // Save the new run to the database
    runDb.saveRun(newRun);

    this.notifyStateChange();

    // Don't notify clients - this is client-initiated execution
    return newRun.id;
  }

  /**
   * Trigger a flow execution (server-initiated, notifies clients)
   */
  triggerFlow(flowId: string, configuration: string = 'development', clientColor?: string, clientName?: string): string | undefined {
    const flow = this.flows.find(f => f.id === flowId);
    if (!flow) return undefined;

    const timestamp = new Date().toISOString();

    // Check for learned task structure from previous runs
    const learnedStructure = statsDb.getFlowTaskStructure(flow.name);
    let tasks: TaskRun[];

    if (learnedStructure && learnedStructure.length > 0) {
      // Use learned task structure from previous executions
      // But look up fresh statistics for estimated times
      console.log(`[FlowEngine] Using learned task structure for ${flow.name}: ${learnedStructure.length} tasks`);

      // First pass: get estimated times from statistics (or use saved value as fallback)
      const tasksWithEstimates = learnedStructure.map(t => {
        const taskStats = statsDb.getTaskStats(flow.name, t.taskName);
        const estimatedTime = taskStats ? Math.round(taskStats.avgDurationMs) : t.estimatedTime;
        return { taskName: t.taskName, estimatedTime };
      });

      const totalEstimatedTime = tasksWithEstimates.reduce((sum, t) => sum + t.estimatedTime, 0);

      tasks = tasksWithEstimates.map((t, index) => {
        const weight = totalEstimatedTime > 0 ? t.estimatedTime / totalEstimatedTime : 1 / learnedStructure.length;
        return {
          id: `tr-${this.generateId()}`,
          taskId: `learned-task-${index}`,
          taskName: t.taskName,
          state: TaskState.PENDING,
          logs: [],
          weight: weight,
          estimatedTime: t.estimatedTime,
          progress: 0
        };
      });
    } else {
      // Use tasks from flow registration (static analysis)
      // But check statistics for better estimated times
      console.log(`[FlowEngine] Using static task structure for ${flow.name}: ${flow.tasks.length} tasks`);

      // First pass: get estimated times from statistics (or use registration value as fallback)
      const tasksWithEstimates = flow.tasks.map(t => {
        const taskStats = statsDb.getTaskStats(flow.name, t.name);
        const estimatedTime = taskStats ? Math.round(taskStats.avgDurationMs) : t.estimatedTime;
        if (taskStats) {
          console.log(`[FlowEngine] Using statistics for ${t.name}: ${estimatedTime}ms (vs client: ${t.estimatedTime}ms)`);
        }
        return { ...t, estimatedTime };
      });

      const totalEstimatedTime = tasksWithEstimates.reduce((sum, t) => sum + t.estimatedTime, 0);

      tasks = tasksWithEstimates.map(t => {
        const weight = totalEstimatedTime > 0 ? t.estimatedTime / totalEstimatedTime : t.weight;
        return {
          id: `tr-${this.generateId()}`,
          taskId: t.id,
          taskName: t.name,
          state: TaskState.PENDING,
          logs: [],
          weight: weight,
          estimatedTime: t.estimatedTime,
          progress: 0
        };
      });
    }

    const newRun: FlowRun = {
      id: `run-${this.generateId()}`,
      flowId: flow.id,
      flowName: flow.name,
      state: TaskState.RUNNING,
      startTime: timestamp,
      configuration: configuration,
      tags: flow.tags,
      logs: [],
      tasks: tasks,
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

    return newRun.id;
  }

  /**
   * Simulation engine tick - updates task progress and state
   * Also checks for performance outliers on running tasks
   */
  private tick(): void {
    let changed = false;

    // Real-time outlier detection for all running tasks (runs even when simulation disabled)
    this.runs.forEach(run => {
      if (run.state !== TaskState.RUNNING && run.state !== TaskState.PENDING) {
        return;
      }

      run.tasks.forEach(task => {
        if (task.state === TaskState.RUNNING && task.startTime) {
          const elapsedMs = Date.now() - new Date(task.startTime).getTime();
          const stats = statsDb.getTaskStats(run.flowName, task.taskName);

          if (stats) {
            const activeClient = getActiveClient();
            const sensitivity = activeClient?.performanceSensitivity || 'normal';
            const warning = this.performanceMonitor.detectOutlier(elapsedMs, stats.avgDurationMs, stats.stdDevDurationMs, stats.sampleCount, sensitivity);

            // Only log when warning status changes
            const hadWarning = task.performanceWarning !== undefined;
            const hasWarning = warning !== null;

            if (hasWarning && !hadWarning) {
              console.log(`[FlowEngine] ⚠️  Real-time warning triggered: ${run.flowName}/${task.taskName} - ${warning.message} (elapsed: ${elapsedMs}ms)`);
              changed = true;
            } else if (!hasWarning && hadWarning) {
              console.log(`[FlowEngine] ✓  Warning cleared: ${run.flowName}/${task.taskName} - task speed normalized`);
              changed = true;
            }

            if (task.performanceWarning !== warning) {
              task.performanceWarning = warning || undefined;
              changed = true;
            }
          }
        }
      });
    });

    if (changed) {
      this.notifyStateChange();
    }

    // Skip simulation if disabled (for real Python client execution)
    if (!this.simulationEnabled) {
      return;
    }

    changed = false;

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
        run.reportPath = generateFlowReport(run, run.clientName || 'default') || undefined;
        runDb.saveRun(run);
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
   * Manually fail all running flows (e.g., when user clicks Stop button)
   * Only the currently running task in each flow will be marked as failed.
   */
  failAllRunningFlows(): void {
    const runningRuns = this.runs.filter(
      r => r.state === TaskState.RUNNING || r.state === TaskState.PENDING
    );

    if (runningRuns.length > 0) {
      console.log(`[FlowEngine] Manually failing ${runningRuns.length} running flows due to stop request`);

      runningRuns.forEach(run => {
        run.state = TaskState.FAILED;
        run.endTime = new Date().toISOString();
        run.logs.push('[System] Flow failed: User stopped the client');

        // Only fail the currently running task, not pending tasks
        run.tasks.forEach(task => {
          if (task.state === TaskState.RUNNING) {
            task.state = TaskState.FAILED;
            task.endTime = new Date().toISOString();
            task.logs.push('[System] Task failed: User stopped the client');
          }
        });

        // Save the failed run to database
        runDb.saveRun(run);

        // Generate report for the failed flow
        run.reportPath = generateFlowReport(run, run.clientName || 'default') || undefined;
        runDb.saveRun(run);
      });

      this.notifyStateChange();
    }
  }

  /**
   * Delete a run from history
   */
  deleteRun(runId: string): boolean {
    const runIndex = this.runs.findIndex(r => r.id === runId);
    if (runIndex === -1) {
      return false;
    }

    // Don't allow deleting running flows
    const run = this.runs[runIndex];
    if (run.state === TaskState.RUNNING || run.state === TaskState.PENDING) {
      console.log(`[FlowEngine] Cannot delete running flow: ${runId}`);
      return false;
    }

    const flowName = run.flowName;

    // Remove from memory
    this.runs.splice(runIndex, 1);

    // Remove from database
    runDb.deleteRun(runId);

    // Check if there are any remaining runs for this flow
    const remainingRuns = this.runs.filter(r => r.flowName === flowName);
    if (remainingRuns.length === 0) {
      // No more runs for this flow, clean up statistics
      statsDb.deleteFlowStats(flowName);
      console.log(`[FlowEngine] Deleted run and statistics for flow: ${flowName}`);
    } else {
      console.log(`[FlowEngine] Deleted run: ${runId} (${remainingRuns.length} runs remaining for ${flowName})`);
    }

    this.notifyStateChange();
    return true;
  }

  /**
   * Delete all statistics
   */
  deleteAllStats(): void {
    statsDb.deleteAllStats();
    console.log(`[FlowEngine] Deleted all statistics`);
    this.notifyStateChange();
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
