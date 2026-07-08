import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlowRun, TaskRun, TaskState } from '../types';
import { calculateRunProgress, calculateOverallProgress, calculateTaskProgress } from './progressUtils';

const NOW = 1700000000000;

function makeTask(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: 'tr-1',
    taskId: 'task-1',
    taskName: 'Task 1',
    state: TaskState.PENDING,
    logs: [],
    weight: 1,
    estimatedTime: 2000,
    progress: 0,
    crucialPass: true,
    ...overrides,
  };
}

function makeRun(tasks: TaskRun[], overrides: Partial<FlowRun> = {}): FlowRun {
  return {
    id: 'run-1',
    flowId: 'flow-1',
    flowName: 'Test Flow',
    state: TaskState.RUNNING,
    startTime: new Date(NOW).toISOString(),
    configuration: 'test',
    tags: {},
    logs: [],
    tasks,
    progress: 0,
    ...overrides,
  };
}

describe('calculateRunProgress', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { dateSpy = vi.spyOn(Date, 'now').mockReturnValue(NOW); });
  afterEach(() => { dateSpy.mockRestore(); });

  it('all PENDING: progress=0, remainingMs=sum of estimatedTimes', () => {
    const run = makeRun([
      makeTask({ id: 'tr-1', weight: 0.5, estimatedTime: 1000 }),
      makeTask({ id: 'tr-2', weight: 0.5, estimatedTime: 2000 }),
    ]);
    const { progress, remainingMs } = calculateRunProgress(run);
    expect(progress).toBe(0);
    expect(remainingMs).toBe(3000);
  });

  it('all COMPLETED: progress capped at 99, remainingMs=0', () => {
    const run = makeRun([makeTask({ state: TaskState.COMPLETED, weight: 1, progress: 100 })]);
    const { progress, remainingMs } = calculateRunProgress(run);
    expect(progress).toBe(99);
    expect(remainingMs).toBe(0);
  });

  it('all FAILED: progress capped at 99, remainingMs=0', () => {
    const run = makeRun([makeTask({ state: TaskState.FAILED, weight: 1, progress: 50 })]);
    const { progress } = calculateRunProgress(run);
    expect(progress).toBe(99);
  });

  it('RUNNING task at half its estimatedTime: progress ~50%, remainingMs ~1000', () => {
    const startTime = new Date(NOW - 1000).toISOString();
    const run = makeRun([makeTask({ state: TaskState.RUNNING, weight: 1, estimatedTime: 2000, startTime })]);
    const { progress, remainingMs } = calculateRunProgress(run);
    expect(progress).toBeCloseTo(50, 0);
    expect(remainingMs).toBeCloseTo(1000, 0);
  });

  it('RUNNING task past 99% cap: progress capped at 99', () => {
    const startTime = new Date(NOW - 10000).toISOString();
    const run = makeRun([makeTask({ state: TaskState.RUNNING, weight: 1, estimatedTime: 2000, startTime })]);
    const { progress } = calculateRunProgress(run);
    expect(progress).toBe(99);
  });

  it('mixed RUNNING + PENDING: remaining includes both contributions', () => {
    const startTime = new Date(NOW - 500).toISOString();
    const run = makeRun([
      makeTask({ id: 'tr-1', state: TaskState.RUNNING, weight: 0.5, estimatedTime: 2000, startTime }),
      makeTask({ id: 'tr-2', state: TaskState.PENDING, weight: 0.5, estimatedTime: 3000 }),
    ]);
    const { remainingMs } = calculateRunProgress(run);
    expect(remainingMs).toBeGreaterThan(3000);
  });
});

describe('calculateOverallProgress', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { dateSpy = vi.spyOn(Date, 'now').mockReturnValue(NOW); });
  afterEach(() => { dateSpy.mockRestore(); });

  it('empty array → zero', () => {
    const { progress, remainingMs } = calculateOverallProgress([]);
    expect(progress).toBe(0);
    expect(remainingMs).toBe(0);
  });

  it('two runs: progress = average, remainingMs = max (bottleneck)', () => {
    const run1 = makeRun([makeTask({ state: TaskState.COMPLETED, weight: 1 })]);
    const run2 = makeRun([makeTask({ state: TaskState.PENDING, weight: 1, estimatedTime: 5000 })], { id: 'run-2' });
    const { progress, remainingMs } = calculateOverallProgress([run1, run2]);
    expect(progress).toBeCloseTo(49.5, 0); // (99 + 0) / 2
    expect(remainingMs).toBe(5000);
  });

  it('single run delegates to calculateRunProgress', () => {
    const run = makeRun([makeTask({ state: TaskState.PENDING, estimatedTime: 3000 })]);
    const { progress } = calculateOverallProgress([run]);
    expect(progress).toBe(0);
  });
});

describe('calculateTaskProgress', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { dateSpy = vi.spyOn(Date, 'now').mockReturnValue(NOW); });
  afterEach(() => { dateSpy.mockRestore(); });

  it('PENDING: progress=0, remainingMs=estimatedTime', () => {
    const task = makeTask({ state: TaskState.PENDING, estimatedTime: 3000 });
    const { progress, remainingMs } = calculateTaskProgress(task);
    expect(progress).toBe(0);
    expect(remainingMs).toBe(3000);
  });

  it('COMPLETED: progress=99, remainingMs=0', () => {
    const task = makeTask({ state: TaskState.COMPLETED });
    const { progress, remainingMs } = calculateTaskProgress(task);
    expect(progress).toBe(99);
    expect(remainingMs).toBe(0);
  });

  it('FAILED: progress=99, remainingMs=0', () => {
    const task = makeTask({ state: TaskState.FAILED });
    const { progress, remainingMs } = calculateTaskProgress(task);
    expect(progress).toBe(99);
    expect(remainingMs).toBe(0);
  });

  it('RUNNING at half estimatedTime: ~50% progress', () => {
    const task = makeTask({
      state: TaskState.RUNNING,
      estimatedTime: 2000,
      startTime: new Date(NOW - 1000).toISOString(),
    });
    const { progress, remainingMs } = calculateTaskProgress(task);
    expect(progress).toBeCloseTo(50, 0);
    expect(remainingMs).toBeCloseTo(1000, 0);
  });
});
