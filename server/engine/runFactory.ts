import { FlowDefinition, FlowRun, TaskRun, TaskState } from '../types';
import { StatsDb } from '../database/db';

/** Generate a short random id. */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Build the task list for a new run of `flow`. Prefers a learned task structure
 * from previous executions; otherwise falls back to the flow's registered
 * (statically analyzed) tasks. In both cases estimated times/weights are refined
 * from recorded statistics when available.
 *
 * Shared by createRun (client-initiated) and triggerFlow (server-initiated),
 * which previously duplicated this logic verbatim.
 */
export function buildRunTasks(flow: FlowDefinition, statsDb: StatsDb): TaskRun[] {
  const learnedStructure = statsDb.getFlowTaskStructure(flow.name);

  if (learnedStructure && learnedStructure.length > 0) {
    // Use learned task structure from previous executions, but look up fresh
    // statistics for estimated times.
    console.log(`[FlowEngine] Using learned task structure for ${flow.name}: ${learnedStructure.length} tasks`);

    const tasksWithEstimates = learnedStructure.map(t => {
      const taskStats = statsDb.getTaskStats(flow.name, t.taskName);
      const estimatedTime = taskStats ? Math.round(taskStats.avgDurationMs) : t.estimatedTime;
      return { taskName: t.taskName, estimatedTime };
    });

    const totalEstimatedTime = tasksWithEstimates.reduce((sum, t) => sum + t.estimatedTime, 0);

    return tasksWithEstimates.map((t, index) => {
      const weight = totalEstimatedTime > 0 ? t.estimatedTime / totalEstimatedTime : 1 / learnedStructure.length;
      return {
        id: `tr-${generateId()}`,
        taskId: `learned-task-${index}`,
        taskName: t.taskName,
        state: TaskState.PENDING,
        logs: [],
        weight,
        estimatedTime: t.estimatedTime,
        progress: 0,
        crucialPass: true
      };
    });
  }

  // Use tasks from flow registration (static analysis), but check statistics for
  // better estimated times.
  console.log(`[FlowEngine] Using static task structure for ${flow.name}: ${flow.tasks.length} tasks`);

  const tasksWithEstimates = flow.tasks.map(t => {
    const taskStats = statsDb.getTaskStats(flow.name, t.name);
    const estimatedTime = taskStats ? Math.round(taskStats.avgDurationMs) : t.estimatedTime;
    if (taskStats) {
      console.log(`[FlowEngine] Using statistics for ${t.name}: ${estimatedTime}ms (vs client: ${t.estimatedTime}ms)`);
    }
    return { ...t, estimatedTime };
  });

  const totalEstimatedTime = tasksWithEstimates.reduce((sum, t) => sum + t.estimatedTime, 0);

  return tasksWithEstimates.map(t => {
    const weight = totalEstimatedTime > 0 ? t.estimatedTime / totalEstimatedTime : t.weight;
    return {
      id: `tr-${generateId()}`,
      taskId: t.id,
      taskName: t.name,
      state: TaskState.PENDING,
      logs: [],
      weight,
      estimatedTime: t.estimatedTime,
      progress: 0,
      crucialPass: t.crucialPass
    };
  });
}

/**
 * Assemble a fresh RUNNING FlowRun for `flow`. Does not touch engine state,
 * persistence, or listeners — the caller handles those.
 */
export function buildNewRun(
  flow: FlowDefinition,
  configuration: string,
  clientColor: string | undefined,
  clientName: string | undefined,
  statsDb: StatsDb
): FlowRun {
  const timestamp = new Date().toISOString();
  const tasks = buildRunTasks(flow, statsDb);

  return {
    id: `run-${generateId()}`,
    flowId: flow.id,
    flowName: flow.name,
    state: TaskState.RUNNING,
    startTime: timestamp,
    configuration,
    tags: flow.tags,
    logs: [],
    tasks,
    progress: 0,
    clientColor,
    clientName
  };
}
