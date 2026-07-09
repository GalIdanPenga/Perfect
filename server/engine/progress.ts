import { FlowRun, TaskState } from '../types';

/**
 * Recalculate a run's weighted progress (0-100) from its tasks in place.
 * Completed tasks contribute their full weight; running/failed tasks contribute
 * proportionally to their own progress.
 */
export function updateRunProgress(run: FlowRun): void {
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
