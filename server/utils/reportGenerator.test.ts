import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  calculateTotalDuration,
  getStatusColor,
  renderValue,
  generateReportHTML,
  generateTaskHTML,
} from '../utils/reportGenerator';
import { TaskState, FlowRun, TaskRun } from '../types';

// ---------------------------------------------------------------------------
// Helpers / factories
// ---------------------------------------------------------------------------

function makeRun(overrides: Partial<FlowRun> = {}): FlowRun {
  return {
    id: 'run-1',
    flowId: 'flow-1',
    flowName: 'Test Flow',
    state: TaskState.COMPLETED,
    startTime: '2024-01-01T00:00:00.000Z',
    endTime: '2024-01-01T00:01:00.000Z',
    configuration: 'test',
    tags: {},
    progress: 100,
    tasks: [],
    logs: [],
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: 'tr-1',
    taskId: 'task-1',
    taskName: 'My Task',
    state: TaskState.COMPLETED,
    weight: 1,
    estimatedTime: 1000,
    progress: 100,
    crucialPass: true,
    logs: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  describe('milliseconds range (< 1000)', () => {
    it('returns 0ms for 0', () => {
      expect(formatDuration(0)).toBe('0ms');
    });

    it('returns 500ms for 500', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('returns 999ms for 999', () => {
      expect(formatDuration(999)).toBe('999ms');
    });

    it('rounds fractional milliseconds', () => {
      expect(formatDuration(500.6)).toBe('501ms');
    });
  });

  describe('seconds range (1000 <= ms < 60000)', () => {
    it('returns 1.00s for exactly 1000ms', () => {
      expect(formatDuration(1000)).toBe('1.00s');
    });

    it('returns 2.50s for 2500ms', () => {
      expect(formatDuration(2500)).toBe('2.50s');
    });

    it('returns 59.00s for 59000ms', () => {
      expect(formatDuration(59000)).toBe('59.00s');
    });

    it('uses toFixed(2) for sub-second precision in this range', () => {
      // 1500ms → 1.50s
      expect(formatDuration(1500)).toBe('1.50s');
    });
  });

  describe('minutes range (>= 60000)', () => {
    it('returns 1m 0s for exactly 60000ms', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
    });

    it('returns 1m 30s for 90000ms', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });

    it('returns 2m 0s for 120000ms', () => {
      expect(formatDuration(120000)).toBe('2m 0s');
    });

    it('handles minutes with non-zero seconds correctly', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });
});

// ---------------------------------------------------------------------------
// calculateTotalDuration
// ---------------------------------------------------------------------------

describe('calculateTotalDuration', () => {
  it('returns 60000 when run lasts exactly one minute', () => {
    const run = makeRun({
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T00:01:00.000Z',
    });
    expect(calculateTotalDuration(run)).toBe(60000);
  });

  it('returns 0 when endTime is absent', () => {
    const run = makeRun({ endTime: undefined });
    expect(calculateTotalDuration(run)).toBe(0);
  });

  it('returns 0 when start and end are the same', () => {
    const run = makeRun({
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T00:00:00.000Z',
    });
    expect(calculateTotalDuration(run)).toBe(0);
  });

  it('returns correct ms for a 2.5 second run', () => {
    const run = makeRun({
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T00:00:02.500Z',
    });
    expect(calculateTotalDuration(run)).toBe(2500);
  });
});

// ---------------------------------------------------------------------------
// getStatusColor
// ---------------------------------------------------------------------------

describe('getStatusColor', () => {
  it('returns green for COMPLETED', () => {
    expect(getStatusColor(TaskState.COMPLETED)).toBe('#10b981');
  });

  it('returns red for FAILED', () => {
    expect(getStatusColor(TaskState.FAILED)).toBe('#ef4444');
  });

  it('returns blue for RUNNING', () => {
    expect(getStatusColor(TaskState.RUNNING)).toBe('#3b82f6');
  });

  it('returns gray for PENDING', () => {
    expect(getStatusColor(TaskState.PENDING)).toBe('#6b7280');
  });

  it('returns gray for RETRYING (falls through to default)', () => {
    expect(getStatusColor(TaskState.RETRYING)).toBe('#6b7280');
  });
});

// ---------------------------------------------------------------------------
// renderValue
// ---------------------------------------------------------------------------

describe('renderValue', () => {
  describe('null / undefined', () => {
    it('renders null as an HTML span containing "null"', () => {
      const html = renderValue(null);
      expect(html).toContain('null');
    });

    it('renders undefined as an HTML span containing "null"', () => {
      const html = renderValue(undefined);
      expect(html).toContain('null');
    });
  });

  describe('booleans', () => {
    it('renders true with a checkmark indicator', () => {
      const html = renderValue(true);
      expect(html).toContain('✓');
      expect(html).toContain('true');
    });

    it('renders false with a cross indicator', () => {
      const html = renderValue(false);
      expect(html).toContain('✗');
      expect(html).toContain('false');
    });

    it('uses green colour for true', () => {
      expect(renderValue(true)).toContain('#10b981');
    });

    it('uses red colour for false', () => {
      expect(renderValue(false)).toContain('#ef4444');
    });
  });

  describe('numbers', () => {
    it('renders 42 with the numeric value present', () => {
      const html = renderValue(42);
      expect(html).toContain('42');
    });

    it('wraps number in a span with class nested-value number', () => {
      expect(renderValue(0)).toContain('class="nested-value number"');
    });
  });

  describe('strings', () => {
    it('renders the string value inside a span', () => {
      const html = renderValue('hello');
      expect(html).toContain('hello');
    });

    it('wraps string in a span with class nested-value string', () => {
      expect(renderValue('world')).toContain('class="nested-value string"');
    });
  });

  describe('objects', () => {
    it('renders an empty object as {}', () => {
      expect(renderValue({})).toContain('{}');
    });

    it('renders object keys and values', () => {
      const html = renderValue({ a: 1 });
      expect(html).toContain('a');
      expect(html).toContain('1');
    });

    it('wraps the result in nested-object container', () => {
      expect(renderValue({ x: 'y' })).toContain('nested-object');
    });

    it('renders nested object keys recursively', () => {
      const html = renderValue({ outer: { inner: 'val' } });
      expect(html).toContain('outer');
      expect(html).toContain('inner');
      expect(html).toContain('val');
    });
  });

  describe('arrays', () => {
    it('renders an empty array as []', () => {
      expect(renderValue([])).toContain('[]');
    });

    it('renders each element with its index', () => {
      const html = renderValue([1, 2]);
      expect(html).toContain('[0]');
      expect(html).toContain('[1]');
      expect(html).toContain('1');
      expect(html).toContain('2');
    });

    it('wraps array in a nested-object container', () => {
      expect(renderValue([42])).toContain('nested-object');
    });
  });
});

// ---------------------------------------------------------------------------
// generateReportHTML
// ---------------------------------------------------------------------------

describe('generateReportHTML', () => {
  it('returns a non-trivial HTML string', () => {
    const html = generateReportHTML(makeRun(), 'AcmeCorp');
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });

  it('contains the flow name', () => {
    const html = generateReportHTML(makeRun({ flowName: 'My Awesome Flow' }), 'client');
    expect(html).toContain('My Awesome Flow');
  });

  it('contains the run state', () => {
    const html = generateReportHTML(makeRun({ state: TaskState.FAILED }), 'client');
    expect(html).toContain(TaskState.FAILED);
  });

  it('contains the client name', () => {
    const html = generateReportHTML(makeRun(), 'SpecialClient');
    expect(html).toContain('SpecialClient');
  });

  it('contains the run id', () => {
    const html = generateReportHTML(makeRun({ id: 'run-xyz' }), 'client');
    expect(html).toContain('run-xyz');
  });

  it('opens with an HTML doctype declaration', () => {
    const html = generateReportHTML(makeRun(), 'client');
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('includes task HTML when tasks are present', () => {
    const run = makeRun({
      tasks: [makeTask({ taskName: 'Alpha Task', state: TaskState.COMPLETED })],
    });
    const html = generateReportHTML(run, 'client');
    expect(html).toContain('Alpha Task');
  });

  it('includes flow logs when present', () => {
    const run = makeRun({ logs: ['Flow started', 'Flow ended'] });
    const html = generateReportHTML(run, 'client');
    expect(html).toContain('Flow started');
    expect(html).toContain('Flow ended');
  });

  it('includes tag badges when tags are provided', () => {
    const run = makeRun({ tags: { env: 'staging' } });
    const html = generateReportHTML(run, 'client');
    expect(html).toContain('env');
    expect(html).toContain('staging');
  });

  it('displays the correct status color for the run state', () => {
    const html = generateReportHTML(makeRun({ state: TaskState.FAILED }), 'client');
    // FAILED → #ef4444
    expect(html).toContain('#ef4444');
  });

  it('shows pass rate stat', () => {
    const run = makeRun({
      tasks: [
        makeTask({ state: TaskState.COMPLETED }),
        makeTask({ id: 'tr-2', taskId: 'task-2', state: TaskState.FAILED }),
      ],
    });
    const html = generateReportHTML(run, 'client');
    // 1 of 2 passed → 50.0%
    expect(html).toContain('50.0%');
  });
});

// ---------------------------------------------------------------------------
// generateTaskHTML
// ---------------------------------------------------------------------------

describe('generateTaskHTML', () => {
  it('returns a non-empty HTML string', () => {
    const html = generateTaskHTML(makeTask());
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  it('contains the task name', () => {
    const html = generateTaskHTML(makeTask({ taskName: 'Login Check' }));
    expect(html).toContain('Login Check');
  });

  it('contains the task state', () => {
    const html = generateTaskHTML(makeTask({ state: TaskState.FAILED }));
    expect(html).toContain(TaskState.FAILED);
  });

  it('uses the correct status color for the task state', () => {
    const html = generateTaskHTML(makeTask({ state: TaskState.COMPLETED }));
    expect(html).toContain('#10b981');
  });

  it('shows formatted duration when durationMs is provided', () => {
    const html = generateTaskHTML(makeTask({ durationMs: 2500 }));
    expect(html).toContain('2.50s');
  });

  it('shows N/A when durationMs is absent', () => {
    const html = generateTaskHTML(makeTask({ durationMs: undefined }));
    expect(html).toContain('N/A');
  });

  it('includes task logs when present', () => {
    const html = generateTaskHTML(makeTask({ logs: ['step 1 done', 'step 2 done'] }));
    expect(html).toContain('step 1 done');
    expect(html).toContain('step 2 done');
  });

  it('includes result pass/fail when result is provided', () => {
    const html = generateTaskHTML(
      makeTask({
        result: { passed: true, note: 'All good', table: [] },
      })
    );
    expect(html).toContain('Passed');
    expect(html).toContain('All good');
  });

  it('includes result failure indicator when result.passed is false', () => {
    const html = generateTaskHTML(
      makeTask({
        result: { passed: false, note: 'Threshold exceeded', table: [] },
      })
    );
    expect(html).toContain('Failed');
    expect(html).toContain('Threshold exceeded');
  });

  it('renders result table rows when table data is present', () => {
    const html = generateTaskHTML(
      makeTask({
        result: {
          passed: true,
          note: '',
          table: [{ metric: 'latency', value: 42 }],
        },
      })
    );
    expect(html).toContain('metric');
    expect(html).toContain('latency');
  });

  it('renders performance warning when present', () => {
    const html = generateTaskHTML(
      makeTask({
        performanceWarning: { type: 'slow', message: 'Took too long', severity: 'warning' },
      })
    );
    expect(html).toContain('Took too long');
    expect(html).toContain('Performance Warning');
  });

  it('renders critical performance warning with appropriate label', () => {
    const html = generateTaskHTML(
      makeTask({
        performanceWarning: { type: 'slow', message: 'Way too slow', severity: 'critical' },
      })
    );
    expect(html).toContain('Way too slow');
    expect(html).toContain('Critical Performance Issue');
  });

  it('includes progress bar with correct width', () => {
    const html = generateTaskHTML(makeTask({ progress: 75 }));
    expect(html).toContain('width: 75%');
  });
});
