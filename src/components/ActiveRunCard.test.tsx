// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveRunCard } from './ActiveRunCard';
import { FlowRun, TaskRun, TaskState } from '../types';

vi.mock('../hooks/useAnimatedProgress', () => ({
  useAnimatedProgress: vi.fn(() => ({
    localProgress: 60,
    countdownRef: { current: null },
  })),
}));

function makeTask(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: 'tr-1', taskId: 'task-1', taskName: 'Task A',
    state: TaskState.PENDING, logs: [], weight: 1,
    estimatedTime: 1000, progress: 0, crucialPass: true,
    ...overrides,
  };
}

function makeRun(overrides: Partial<FlowRun> = {}): FlowRun {
  return {
    id: 'run-1', flowId: 'flow-1', flowName: 'My Flow',
    state: TaskState.RUNNING,
    startTime: new Date().toISOString(),
    configuration: 'test', tags: {}, logs: [], tasks: [], progress: 0,
    ...overrides,
  };
}

describe('ActiveRunCard', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders flow name', () => {
    render(<ActiveRunCard run={makeRun({ flowName: 'Data Pipeline' })} />);
    expect(screen.getByText('Data Pipeline')).toBeTruthy();
  });

  it('renders StatusBadge with run state', () => {
    render(<ActiveRunCard run={makeRun({ state: TaskState.RUNNING })} />);
    expect(screen.getByText('RUNNING')).toBeTruthy();
  });

  it('shows progress % from useAnimatedProgress hook', () => {
    render(<ActiveRunCard run={makeRun()} />);
    expect(screen.getByText('60%')).toBeTruthy();
  });

  it('shows performance warning badge when task has warning', () => {
    const tasks = [makeTask({
      performanceWarning: { type: 'slow', severity: 'warning', message: 'slow' },
    })];
    render(<ActiveRunCard run={makeRun({ tasks })} />);
    expect(screen.getAllByText('SLOW').length).toBeGreaterThan(0);
  });

  it('shows CRITICAL badge when critical warning present', () => {
    const tasks = [makeTask({
      performanceWarning: { type: 'slow', severity: 'critical', message: 'very slow' },
    })];
    render(<ActiveRunCard run={makeRun({ tasks })} />);
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThan(0);
  });

  it('no warning badge when no tasks have warnings', () => {
    render(<ActiveRunCard run={makeRun({ tasks: [makeTask()] })} />);
    expect(screen.queryByText('SLOW')).toBeNull();
    expect(screen.queryByText('CRITICAL')).toBeNull();
  });

  it('shows Open Report link when run finished with reportPath', () => {
    render(<ActiveRunCard run={makeRun({
      state: TaskState.COMPLETED,
      reportPath: 'Reports/MyFlow/report.html',
    })} />);
    expect(screen.getByText('Open Report')).toBeTruthy();
  });

  it('does not show Open Report while RUNNING', () => {
    render(<ActiveRunCard run={makeRun({ state: TaskState.RUNNING })} />);
    expect(screen.queryByText('Open Report')).toBeNull();
  });

  it('does not show Open Report when no reportPath', () => {
    render(<ActiveRunCard run={makeRun({ state: TaskState.COMPLETED })} />);
    expect(screen.queryByText('Open Report')).toBeNull();
  });

  it('shows logs toggle when run has logs', () => {
    render(<ActiveRunCard run={makeRun({ logs: ['log1', 'log2'] })} />);
    // Toggle button should exist
    const { container } = render(<ActiveRunCard run={makeRun({ logs: ['log1'] })} />);
    expect(container.querySelector('button[title*="logs"]') || container.querySelector('button.rounded-full')).toBeTruthy();
  });

  it('no logs toggle when run has no logs', () => {
    const { container } = render(<ActiveRunCard run={makeRun({ logs: [] })} />);
    expect(container.querySelector('button[title*="logs"]')).toBeNull();
  });

  it('renders one TaskRow per task', () => {
    const tasks = [
      makeTask({ id: 'tr-1', taskName: 'Step 1' }),
      makeTask({ id: 'tr-2', taskName: 'Step 2' }),
    ];
    render(<ActiveRunCard run={makeRun({ tasks })} />);
    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(screen.getByText('Step 2')).toBeTruthy();
  });

  it('expands logs panel on toggle click', () => {
    const { container } = render(<ActiveRunCard run={makeRun({ logs: ['hello'] })} />);
    const toggleBtn = container.querySelector('button.rounded-full') as HTMLButtonElement;
    fireEvent.click(toggleBtn);
    const logsPanel = container.querySelector('.w-64') as HTMLElement;
    expect(logsPanel).toBeTruthy();
  });
});
