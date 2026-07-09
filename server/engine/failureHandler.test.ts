import { describe, it, expect } from 'vitest';
import { markRunFailed } from './failureHandler';
import { TaskState, FlowRun, TaskRun } from '../types';

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
    progress: 50,
  };
}

const messages = { flow: 'flow failed', task: 'task failed' };

describe('markRunFailed', () => {
  it('marks the run FAILED, sets endTime, and appends the flow message', () => {
    const run = makeRun([]);
    markRunFailed(run, messages, { includePending: true });
    expect(run.state).toBe(TaskState.FAILED);
    expect(run.endTime).toBeTruthy();
    expect(run.logs).toContain('flow failed');
  });

  it('includePending: true fails both RUNNING and PENDING tasks', () => {
    const run = makeRun([
      makeTask({ id: 'a', state: TaskState.RUNNING }),
      makeTask({ id: 'b', state: TaskState.PENDING }),
    ]);
    markRunFailed(run, messages, { includePending: true });
    expect(run.tasks[0].state).toBe(TaskState.FAILED);
    expect(run.tasks[1].state).toBe(TaskState.FAILED);
    expect(run.tasks[0].logs).toContain('task failed');
    expect(run.tasks[1].logs).toContain('task failed');
    expect(run.tasks[0].endTime).toBeTruthy();
    expect(run.tasks[1].endTime).toBeTruthy();
  });

  it('includePending: false fails only RUNNING tasks; PENDING is left alone', () => {
    const run = makeRun([
      makeTask({ id: 'a', state: TaskState.RUNNING }),
      makeTask({ id: 'b', state: TaskState.PENDING }),
    ]);
    markRunFailed(run, messages, { includePending: false });
    expect(run.tasks[0].state).toBe(TaskState.FAILED);
    expect(run.tasks[1].state).toBe(TaskState.PENDING);
    expect(run.tasks[1].logs).not.toContain('task failed');
    expect(run.tasks[1].endTime).toBeUndefined();
  });

  it('leaves already-COMPLETED tasks untouched', () => {
    const run = makeRun([
      makeTask({ id: 'a', state: TaskState.COMPLETED, endTime: '2024-01-01T00:01:00.000Z', logs: ['done'] }),
      makeTask({ id: 'b', state: TaskState.RUNNING }),
    ]);
    markRunFailed(run, messages, { includePending: true });
    expect(run.tasks[0].state).toBe(TaskState.COMPLETED);
    expect(run.tasks[0].endTime).toBe('2024-01-01T00:01:00.000Z');
    expect(run.tasks[0].logs).not.toContain('task failed');
    expect(run.tasks[1].state).toBe(TaskState.FAILED);
  });
});
