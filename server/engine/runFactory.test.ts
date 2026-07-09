import { describe, it, expect } from 'vitest';
import { buildRunTasks, buildNewRun } from './runFactory';
import { TaskState, FlowDefinition } from '../types';
import type { StatsDb } from '../database/db';

type TaskStats = { avgDurationMs: number; stdDevDurationMs: number; sampleCount: number };

// Minimal StatsDb stub exposing only the two methods buildRunTasks calls.
function makeStatsStub(opts: {
  structure?: Array<{ taskName: string; estimatedTime: number }> | null;
  taskStats?: Record<string, TaskStats>;
} = {}): StatsDb {
  return {
    getFlowTaskStructure: () => opts.structure ?? null,
    getTaskStats: (_flowName: string, taskName: string) => opts.taskStats?.[taskName],
  } as unknown as StatsDb;
}

function makeFlow(overrides: Partial<FlowDefinition> = {}): FlowDefinition {
  return {
    id: 'flow-1',
    name: 'MyFlow',
    description: 'desc',
    codeSnippet: '',
    tags: { team: 'data' },
    createdAt: '2024-01-01T00:00:00.000Z',
    tasks: [
      { id: 'task-a', name: 'A', description: 'a', weight: 1, estimatedTime: 1000, crucialPass: true },
      { id: 'task-b', name: 'B', description: 'b', weight: 1, estimatedTime: 3000, crucialPass: false },
    ],
    ...overrides,
  };
}

describe('buildRunTasks — static path (no learned structure)', () => {
  it('derives tasks from flow.tasks with weights proportional to estimatedTime', () => {
    const tasks = buildRunTasks(makeFlow(), makeStatsStub({ structure: null }));
    expect(tasks).toHaveLength(2);
    // total estimated = 4000 => 0.25 / 0.75
    expect(tasks[0].weight).toBeCloseTo(0.25, 5);
    expect(tasks[1].weight).toBeCloseTo(0.75, 5);
  });

  it('carries the flow task id and crucialPass through', () => {
    const tasks = buildRunTasks(makeFlow(), makeStatsStub({ structure: null }));
    expect(tasks[0].taskId).toBe('task-a');
    expect(tasks[0].crucialPass).toBe(true);
    expect(tasks[1].taskId).toBe('task-b');
    expect(tasks[1].crucialPass).toBe(false);
    expect(tasks[0].state).toBe(TaskState.PENDING);
  });

  it('overrides estimatedTime from statistics (rounded avg) when available', () => {
    const tasks = buildRunTasks(
      makeFlow(),
      makeStatsStub({
        structure: null,
        taskStats: { A: { avgDurationMs: 2000.6, stdDevDurationMs: 0, sampleCount: 5 } },
      })
    );
    expect(tasks[0].estimatedTime).toBe(2001); // Math.round(2000.6)
    expect(tasks[1].estimatedTime).toBe(3000); // no stats => unchanged
  });
});

describe('buildRunTasks — learned-structure path', () => {
  it('derives tasks from the learned structure with learned-task ids and crucialPass=true', () => {
    const tasks = buildRunTasks(
      makeFlow(),
      makeStatsStub({
        structure: [
          { taskName: 'A', estimatedTime: 1000 },
          { taskName: 'B', estimatedTime: 1000 },
        ],
      })
    );
    expect(tasks).toHaveLength(2);
    expect(tasks[0].taskId).toBe('learned-task-0');
    expect(tasks[1].taskId).toBe('learned-task-1');
    expect(tasks[0].crucialPass).toBe(true);
    expect(tasks[1].crucialPass).toBe(true);
    expect(tasks[0].weight).toBeCloseTo(0.5, 5);
    expect(tasks[1].weight).toBeCloseTo(0.5, 5);
  });

  it('overrides learned estimatedTime from statistics when available', () => {
    const tasks = buildRunTasks(
      makeFlow(),
      makeStatsStub({
        structure: [{ taskName: 'A', estimatedTime: 1000 }],
        taskStats: { A: { avgDurationMs: 5000, stdDevDurationMs: 0, sampleCount: 3 } },
      })
    );
    expect(tasks[0].estimatedTime).toBe(5000);
  });
});

describe('buildNewRun', () => {
  it('assembles a RUNNING run at 0 progress with the given metadata and tasks', () => {
    const run = buildNewRun(makeFlow(), 'staging', '#abcdef', 'Client X', makeStatsStub({ structure: null }));
    expect(run.state).toBe(TaskState.RUNNING);
    expect(run.progress).toBe(0);
    expect(run.configuration).toBe('staging');
    expect(run.clientColor).toBe('#abcdef');
    expect(run.clientName).toBe('Client X');
    expect(run.flowId).toBe('flow-1');
    expect(run.flowName).toBe('MyFlow');
    expect(run.tasks).toHaveLength(2);
    expect(run.id).toMatch(/^run-/);
  });
});
