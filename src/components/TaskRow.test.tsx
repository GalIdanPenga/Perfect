// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRow } from './TaskRow';
import { TaskRun, TaskState } from '../types';

// Mock useAnimatedProgress so tests don't depend on rAF
vi.mock('../hooks/useAnimatedProgress', () => ({
  useAnimatedProgress: vi.fn(() => ({
    localProgress: 45,
    countdownRef: { current: null },
  })),
}));

function makeTask(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: 'tr-1',
    taskId: 'task-1',
    taskName: 'My Task',
    state: TaskState.PENDING,
    logs: [],
    weight: 0.5,
    estimatedTime: 2000,
    progress: 0,
    crucialPass: true,
    ...overrides,
  };
}

describe('TaskRow', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders task name', () => {
    render(<TaskRow task={makeTask({ taskName: 'Fetch Data' })} />);
    expect(screen.getByText('Fetch Data')).toBeTruthy();
  });

  it('shows PENDING state with StatusIcon', () => {
    const { container } = render(<TaskRow task={makeTask({ state: TaskState.PENDING })} />);
    // PENDING renders a div circle
    expect(container.querySelector('.rounded-full')).toBeTruthy();
  });

  it('shows weight and estimated time in metadata', () => {
    render(<TaskRow task={makeTask({ weight: 0.5, estimatedTime: 2000 })} />);
    expect(screen.getByText(/W: 50\.0%/)).toBeTruthy();
    expect(screen.getByText(/EST:/)).toBeTruthy();
  });

  it('shows TOOK duration when durationMs present', () => {
    render(<TaskRow task={makeTask({ state: TaskState.COMPLETED, durationMs: 1500, progress: 100 })} />);
    expect(screen.getByText(/TOOK:/)).toBeTruthy();
  });

  it('does not show TOOK when durationMs absent', () => {
    render(<TaskRow task={makeTask({ state: TaskState.COMPLETED })} />);
    expect(screen.queryByText(/TOOK:/)).toBeNull();
  });

  it('shows progress % badge while RUNNING', () => {
    render(<TaskRow task={makeTask({ state: TaskState.RUNNING, startTime: new Date().toISOString(), progress: 0 })} />);
    // localProgress initializes to task.progress; rAF doesn't fire synchronously in tests
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('does not show progress badge while PENDING', () => {
    render(<TaskRow task={makeTask({ state: TaskState.PENDING })} />);
    expect(screen.queryByText(/45%/)).toBeNull();
  });

  it('shows logs while RUNNING', () => {
    render(<TaskRow task={makeTask({ state: TaskState.RUNNING, logs: ['log line 1', 'log line 2'] })} />);
    expect(screen.getByText('log line 1')).toBeTruthy();
  });

  it('shows logs while FAILED', () => {
    render(<TaskRow task={makeTask({ state: TaskState.FAILED, logs: ['error occurred'] })} />);
    expect(screen.getByText('error occurred')).toBeTruthy();
  });

  it('does not show logs while COMPLETED', () => {
    render(<TaskRow task={makeTask({ state: TaskState.COMPLETED, logs: ['done'] })} />);
    expect(screen.queryByText('done')).toBeNull();
  });

  it('does not show logs section when logs empty', () => {
    const { container } = render(<TaskRow task={makeTask({ state: TaskState.RUNNING, logs: [] })} />);
    // Look for the logs container div — it should not exist
    const logDiv = container.querySelector('.bg-slate-950\\/50');
    expect(logDiv).toBeNull();
  });

  it('shows result note when COMPLETED with passed=true', () => {
    render(<TaskRow task={makeTask({
      state: TaskState.COMPLETED,
      result: { passed: true, note: 'All checks passed', table: [] },
    })} />);
    expect(screen.getByText('All checks passed')).toBeTruthy();
    expect(screen.getByText('PASSED')).toBeTruthy();
  });

  it('shows result note when COMPLETED with passed=false', () => {
    render(<TaskRow task={makeTask({
      state: TaskState.COMPLETED,
      result: { passed: false, note: 'Check failed', table: [] },
    })} />);
    expect(screen.getByText('Check failed')).toBeTruthy();
    expect(screen.getByText('FAILED')).toBeTruthy();
  });

  it('renders simple table without Expand button', () => {
    render(<TaskRow task={makeTask({
      state: TaskState.COMPLETED,
      result: {
        passed: true,
        note: '',
        table: [{ name: 'Alice', age: 30 }],
      },
    })} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.queryByText('Expand')).toBeNull();
  });

  it('renders Expand button for complex table (object values)', () => {
    render(<TaskRow task={makeTask({
      state: TaskState.COMPLETED,
      result: {
        passed: true,
        note: '',
        table: [{ data: { nested: true } }],
      },
    })} />);
    expect(screen.getByText('Expand')).toBeTruthy();
  });

  it('clicking Expand opens TableModal', () => {
    render(<TaskRow task={makeTask({
      state: TaskState.COMPLETED,
      result: {
        passed: true,
        note: '',
        table: [{ data: { value: 1 } }],
      },
    })} />);
    fireEvent.click(screen.getByText('Expand'));
    expect(screen.getByText('Task Result')).toBeTruthy();
  });

  it('renders boolean true as ✓', () => {
    render(<TaskRow task={makeTask({
      state: TaskState.COMPLETED,
      result: { passed: true, note: '', table: [{ ok: true }] },
    })} />);
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('renders boolean false as ✗', () => {
    render(<TaskRow task={makeTask({
      state: TaskState.COMPLETED,
      result: { passed: true, note: '', table: [{ ok: false }] },
    })} />);
    expect(screen.getByText('✗')).toBeTruthy();
  });

  it('renders number value', () => {
    render(<TaskRow task={makeTask({
      state: TaskState.COMPLETED,
      result: { passed: true, note: '', table: [{ count: 42 }] },
    })} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('shows warning badge when performanceWarning present', () => {
    render(<TaskRow task={makeTask({
      performanceWarning: { type: 'slow', severity: 'warning', message: 'took too long' },
    })} />);
    expect(screen.getByText('SLOW')).toBeTruthy();
  });

  it('shows CRITICAL badge when severity=critical', () => {
    render(<TaskRow task={makeTask({
      performanceWarning: { type: 'slow', severity: 'critical', message: 'very slow' },
    })} />);
    expect(screen.getByText('CRITICAL')).toBeTruthy();
  });

  it('shows performance warning message in details block', () => {
    render(<TaskRow task={makeTask({
      performanceWarning: { type: 'slow', severity: 'warning', message: 'took 5.2s (3.1σ from 2.0s avg)' },
    })} />);
    expect(screen.getByText('took 5.2s (3.1σ from 2.0s avg)')).toBeTruthy();
  });

  it('does not show warning when performanceWarning absent', () => {
    render(<TaskRow task={makeTask()} />);
    expect(screen.queryByText('SLOW')).toBeNull();
    expect(screen.queryByText('CRITICAL')).toBeNull();
  });
});
