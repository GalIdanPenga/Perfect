import { FlowRun, TaskState } from '../types';

export interface FailMessages {
  /** Log line appended to the flow. */
  flow: string;
  /** Log line appended to each failed task. */
  task: string;
}

/**
 * Mark a run and its unfinished tasks as FAILED, appending the given log lines.
 * By default only RUNNING tasks are failed; set `includePending` to also fail
 * PENDING tasks (used when the whole flow is abandoned, e.g. server restart or
 * lost worker). Persistence/report/notify are left to the caller since those
 * differ per failure scenario.
 */
export function markRunFailed(
  run: FlowRun,
  messages: FailMessages,
  { includePending }: { includePending: boolean }
): void {
  run.state = TaskState.FAILED;
  run.endTime = new Date().toISOString();
  run.logs.push(messages.flow);

  run.tasks.forEach(task => {
    if (task.state === TaskState.RUNNING || (includePending && task.state === TaskState.PENDING)) {
      task.state = TaskState.FAILED;
      task.endTime = new Date().toISOString();
      task.logs.push(messages.task);
    }
  });
}
