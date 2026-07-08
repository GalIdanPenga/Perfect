import { FlowRun, TaskRun, TaskState } from '../types';

export function calculateRunProgress(run: FlowRun): { progress: number; remainingMs: number } {
  let totalWeightedProgress = 0;
  let remainingMs = 0;

  for (const task of run.tasks) {
    if (task.state === TaskState.COMPLETED || task.state === TaskState.FAILED) {
      totalWeightedProgress += task.weight * 100;
    } else if ((task.state === TaskState.RUNNING || task.state === TaskState.RETRYING) && task.startTime) {
      const elapsedMs = Date.now() - new Date(task.startTime).getTime();
      totalWeightedProgress += task.weight * Math.min(99, (elapsedMs / task.estimatedTime) * 100);
      remainingMs += Math.max(0, task.estimatedTime - elapsedMs);
    } else if (task.state === TaskState.PENDING) {
      remainingMs += task.estimatedTime;
    }
  }

  return { progress: Math.min(99, totalWeightedProgress), remainingMs };
}

export function calculateTaskProgress(task: TaskRun): { progress: number; remainingMs: number } {
  if (task.state === TaskState.COMPLETED || task.state === TaskState.FAILED) {
    return { progress: 99, remainingMs: 0 };
  }
  if ((task.state === TaskState.RUNNING || task.state === TaskState.RETRYING) && task.startTime) {
    const elapsedMs = Date.now() - new Date(task.startTime).getTime();
    const progress = Math.min(99, (elapsedMs / task.estimatedTime) * 100);
    const remainingMs = Math.max(0, task.estimatedTime - elapsedMs);
    return { progress, remainingMs };
  }
  return { progress: 0, remainingMs: task.estimatedTime };
}

export function calculateOverallProgress(runs: FlowRun[]): { progress: number; remainingMs: number } {
  if (runs.length === 0) return { progress: 0, remainingMs: 0 };

  let totalProgress = 0;
  let maxRemaining = 0;

  for (const run of runs) {
    const { progress, remainingMs } = calculateRunProgress(run);
    totalProgress += progress;
    maxRemaining = Math.max(maxRemaining, remainingMs);
  }

  return { progress: totalProgress / runs.length, remainingMs: maxRemaining };
}
