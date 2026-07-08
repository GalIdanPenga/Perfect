import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FlowRun, TaskState } from '../types';
import {
  filterRunsByStatus,
  filterRunsByFlowName,
  filterRunsBySearchQuery,
  filterRunsByDate,
  applyAllFilters,
  getUniqueFlowNames,
} from './filterUtils';

function makeRun(overrides: Partial<FlowRun> = {}): FlowRun {
  return {
    id: 'run-1',
    flowId: 'flow-1',
    flowName: 'My Flow',
    state: TaskState.COMPLETED,
    startTime: new Date().toISOString(),
    configuration: 'test',
    tags: {},
    logs: [],
    tasks: [],
    progress: 100,
    ...overrides,
  };
}

describe('filterRunsByStatus', () => {
  const runs = [
    makeRun({ id: '1', state: TaskState.COMPLETED }),
    makeRun({ id: '2', state: TaskState.FAILED }),
    makeRun({ id: '3', state: TaskState.RUNNING }),
  ];

  it("returns all runs when filter is 'all'", () => {
    expect(filterRunsByStatus(runs, 'all')).toHaveLength(3);
  });

  it('filters to only COMPLETED', () => {
    const result = filterRunsByStatus(runs, TaskState.COMPLETED);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters to only FAILED', () => {
    const result = filterRunsByStatus(runs, TaskState.FAILED);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('returns empty array when no match', () => {
    expect(filterRunsByStatus([], TaskState.COMPLETED)).toHaveLength(0);
  });
});

describe('filterRunsByFlowName', () => {
  const runs = [
    makeRun({ id: '1', flowName: 'Alpha Flow' }),
    makeRun({ id: '2', flowName: 'Beta Flow' }),
  ];

  it("returns all when filter is 'all'", () => {
    expect(filterRunsByFlowName(runs, 'all')).toHaveLength(2);
  });

  it('returns matching flow', () => {
    const result = filterRunsByFlowName(runs, 'Alpha Flow');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty when no match', () => {
    expect(filterRunsByFlowName(runs, 'Unknown')).toHaveLength(0);
  });
});

describe('filterRunsBySearchQuery', () => {
  const runs = [
    makeRun({ id: 'run-abc', flowName: 'Data Pipeline' }),
    makeRun({ id: 'run-xyz', flowName: 'ETL Process', tags: { env: 'production' } }),
  ];

  it('returns all on empty query', () => {
    expect(filterRunsBySearchQuery(runs, '')).toHaveLength(2);
    expect(filterRunsBySearchQuery(runs, '   ')).toHaveLength(2);
  });

  it('matches flow name case-insensitively', () => {
    expect(filterRunsBySearchQuery(runs, 'data')).toHaveLength(1);
    expect(filterRunsBySearchQuery(runs, 'DATA')).toHaveLength(1);
  });

  it('matches run id', () => {
    expect(filterRunsBySearchQuery(runs, 'run-abc')).toHaveLength(1);
  });

  it('matches tag value case-insensitively', () => {
    expect(filterRunsBySearchQuery(runs, 'production')).toHaveLength(1);
    expect(filterRunsBySearchQuery(runs, 'PRODUCTION')).toHaveLength(1);
  });

  it('returns empty when no match', () => {
    expect(filterRunsBySearchQuery(runs, 'zzznomatch')).toHaveLength(0);
  });
});

describe('filterRunsByDate', () => {
  const now = new Date();
  const todayRun = makeRun({ id: 'today', startTime: now.toISOString() });
  const weekRun = makeRun({ id: 'week', startTime: new Date(now.getTime() - 3 * 86400000).toISOString() });
  const monthRun = makeRun({ id: 'month', startTime: new Date(now.getTime() - 15 * 86400000).toISOString() });
  const oldRun = makeRun({ id: 'old', startTime: new Date(now.getTime() - 31 * 86400000).toISOString() });
  const runs = [todayRun, weekRun, monthRun, oldRun];

  it("returns all when filter is 'all'", () => {
    expect(filterRunsByDate(runs, 'all')).toHaveLength(4);
  });

  it("returns only today's runs", () => {
    const result = filterRunsByDate(runs, 'today');
    expect(result.map(r => r.id)).toContain('today');
    expect(result.map(r => r.id)).not.toContain('week');
  });

  it('returns runs from last 7 days', () => {
    const result = filterRunsByDate(runs, 'week');
    expect(result.map(r => r.id)).toContain('today');
    expect(result.map(r => r.id)).toContain('week');
    expect(result.map(r => r.id)).not.toContain('month');
  });

  it('returns runs from last 30 days', () => {
    const result = filterRunsByDate(runs, 'month');
    expect(result.map(r => r.id)).toContain('today');
    expect(result.map(r => r.id)).toContain('week');
    expect(result.map(r => r.id)).toContain('month');
    expect(result.map(r => r.id)).not.toContain('old');
  });
});

describe('applyAllFilters', () => {
  const runs = [
    makeRun({ id: '1', flowName: 'Alpha', state: TaskState.COMPLETED }),
    makeRun({ id: '2', flowName: 'Beta', state: TaskState.FAILED }),
  ];

  it('returns all when all filters are default', () => {
    expect(applyAllFilters(runs, { status: 'all', flowName: 'all', searchQuery: '', date: 'all' })).toHaveLength(2);
  });

  it('intersects status + search', () => {
    const result = applyAllFilters(runs, { status: TaskState.COMPLETED, flowName: 'all', searchQuery: 'alpha', date: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

describe('getUniqueFlowNames', () => {
  it('deduplicates and sorts', () => {
    const runs = [
      makeRun({ flowName: 'Zebra' }),
      makeRun({ flowName: 'Apple' }),
      makeRun({ flowName: 'Zebra' }),
    ];
    expect(getUniqueFlowNames(runs)).toEqual(['Apple', 'Zebra']);
  });

  it('returns empty for empty input', () => {
    expect(getUniqueFlowNames([])).toEqual([]);
  });
});
