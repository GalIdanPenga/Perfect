import { describe, it, expect } from 'vitest';
import { updateRunProgress } from './progress';
import { TaskState, FlowRun, TaskRun } from '../types';

// updateRunProgress only reads task.weight/state/progress and writes run.progress,
// so tests build minimal task/run shapes rather than full fixtures.

function makeTask(overrides: Partial<TaskRun>): TaskRun {
  return {
    id: 'tr',
    taskId: 'task',
    taskName: 'Task',
    state: TaskState.PENDING,
    logs: [],
    weight: 1,
    estimatedTime: 1000,
    progress: 0,
    crucialPass: true,
    ...overrides,
  };
}

function makeRun(tasks: TaskRun[]): FlowRun {
  return {
    id: 'run',
    flowId: 'flow',
    flowName: 'Flow',
    state: TaskState.RUNNING,
    startTime: '2024-01-01T00:00:00.000Z',
    configuration: 'test',
    tags: {},
    logs: [],
    tasks,
    progress: 0,
  };
}

describe('updateRunProgress', () => {
  it('a single COMPLETED task yields 100', () => {
    const run = makeRun([makeTask({ state: TaskState.COMPLETED, weight: 1, progress: 100 })]);
    updateRunProgress(run);
    expect(run.progress).toBe(100);
  });

  it('a single PENDING task yields 0', () => {
    const run = makeRun([makeTask({ state: TaskState.PENDING, weight: 1 })]);
    updateRunProgress(run);
    expect(run.progress).toBe(0);
  });

  it('a RUNNING task contributes weight * its own progress', () => {
    const run = makeRun([makeTask({ state: TaskState.RUNNING, weight: 1, progress: 40 })]);
    updateRunProgress(run);
    expect(run.progress).toBe(40);
  });

  it('a FAILED task contributes weight * its own progress', () => {
    const run = makeRun([makeTask({ state: TaskState.FAILED, weight: 1, progress: 30 })]);
    updateRunProgress(run);
    expect(run.progress).toBe(30);
  });

  it('mixes states weighted correctly (COMPLETED + RUNNING@50% over equal weights => 75)', () => {
    const run = makeRun([
      makeTask({ state: TaskState.COMPLETED, weight: 0.5, progress: 100 }),
      makeTask({ state: TaskState.RUNNING, weight: 0.5, progress: 50 }),
    ]);
    updateRunProgress(run);
    // earned = 0.5*100 + 0.5*50 = 75 ; total weight = 1 => 75
    expect(run.progress).toBe(75);
  });

  it('floors fractional progress', () => {
    const run = makeRun([
      makeTask({ state: TaskState.COMPLETED, weight: 1, progress: 100 }),
      makeTask({ state: TaskState.PENDING, weight: 2 }),
    ]);
    updateRunProgress(run);
    // earned = 100 ; total = 3 => 33.33 => floor 33
    expect(run.progress).toBe(33);
  });

  it('returns 0 when there are no tasks (divide-by-zero guard)', () => {
    const run = makeRun([]);
    updateRunProgress(run);
    expect(run.progress).toBe(0);
  });
});
