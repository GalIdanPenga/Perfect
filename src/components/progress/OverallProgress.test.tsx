// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverallProgress } from './OverallProgress';
import { FlowRun, TaskState } from '../../types';

vi.mock('../../hooks/useAnimatedProgress', () => ({
  useAnimatedProgress: vi.fn(() => ({
    localProgress: 50,
    countdownRef: { current: null },
  })),
}));

import { useAnimatedProgress } from '../../hooks/useAnimatedProgress';

function makeRun(state: TaskState, id = 'run-1'): FlowRun {
  return {
    id,
    flowId: 'flow-1',
    flowName: 'Test Flow',
    state,
    startTime: new Date().toISOString(),
    configuration: 'test',
    tags: {},
    logs: [],
    tasks: [],
    progress: state === TaskState.COMPLETED ? 100 : 0,
  };
}

describe('OverallProgress', () => {
  const mockUseAnimatedProgress = vi.mocked(useAnimatedProgress);

  beforeEach(() => {
    mockUseAnimatedProgress.mockReturnValue({
      localProgress: 50,
      countdownRef: { current: null } as any,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Overall Progress" label', () => {
    render(<OverallProgress flowCount={2} activeRuns={[makeRun(TaskState.RUNNING)]} themeColor="#0ea5e9" />);
    expect(screen.getByText('Overall Progress')).toBeTruthy();
  });

  it('shows correct flow count badge', () => {
    render(<OverallProgress flowCount={3} activeRuns={[makeRun(TaskState.RUNNING)]} themeColor="#0ea5e9" />);
    expect(screen.getByText('3 Flows')).toBeTruthy();
  });

  it('shows singular "Flow" for count=1', () => {
    render(<OverallProgress flowCount={1} activeRuns={[makeRun(TaskState.RUNNING)]} themeColor="#0ea5e9" />);
    expect(screen.getByText('1 Flow')).toBeTruthy();
  });

  it('shows localProgress% from hook', () => {
    mockUseAnimatedProgress.mockReturnValue({ localProgress: 73, countdownRef: { current: null } as any });
    render(<OverallProgress flowCount={1} activeRuns={[makeRun(TaskState.RUNNING)]} themeColor="#0ea5e9" />);
    expect(screen.getByText('73%')).toBeTruthy();
  });

  it('shows completed count badge when all runs finished', () => {
    const runs = [makeRun(TaskState.COMPLETED), makeRun(TaskState.COMPLETED, 'run-2')];
    render(<OverallProgress flowCount={2} activeRuns={runs} themeColor="#0ea5e9" />);
    expect(screen.getByText('2 completed')).toBeTruthy();
  });

  it('shows failed count badge when some runs failed', () => {
    const runs = [makeRun(TaskState.COMPLETED), makeRun(TaskState.FAILED, 'run-2')];
    render(<OverallProgress flowCount={2} activeRuns={runs} themeColor="#0ea5e9" />);
    expect(screen.getByText('1 failed')).toBeTruthy();
  });

  it('does not show failed badge when failedCount=0', () => {
    const runs = [makeRun(TaskState.COMPLETED)];
    render(<OverallProgress flowCount={1} activeRuns={runs} themeColor="#0ea5e9" />);
    expect(screen.queryByText(/failed/)).toBeNull();
  });

  it('calls useAnimatedProgress with active=false when all done', () => {
    const runs = [makeRun(TaskState.COMPLETED)];
    render(<OverallProgress flowCount={1} activeRuns={runs} themeColor="#0ea5e9" />);
    const [, active] = mockUseAnimatedProgress.mock.calls[0];
    expect(active).toBe(false);
  });

  it('calls useAnimatedProgress with active=true when runs still going', () => {
    render(<OverallProgress flowCount={1} activeRuns={[makeRun(TaskState.RUNNING)]} themeColor="#0ea5e9" />);
    const [, active] = mockUseAnimatedProgress.mock.calls[0];
    expect(active).toBe(true);
  });

  it('passes inactiveProgress=100 when all done', () => {
    const runs = [makeRun(TaskState.COMPLETED)];
    render(<OverallProgress flowCount={1} activeRuns={runs} themeColor="#0ea5e9" />);
    const [,, options] = mockUseAnimatedProgress.mock.calls[0];
    expect(options?.inactiveProgress).toBe(100);
  });

  it('renders a progress bar element', () => {
    const { container } = render(
      <OverallProgress flowCount={1} activeRuns={[makeRun(TaskState.RUNNING)]} themeColor="#0ea5e9" />
    );
    // The inner div with width=localProgress%
    const progressFill = container.querySelector('div[style*="width"]');
    expect(progressFill).toBeTruthy();
  });

  it('renders shimmer while not finished', () => {
    const { container } = render(
      <OverallProgress flowCount={1} activeRuns={[makeRun(TaskState.RUNNING)]} themeColor="#0ea5e9" />
    );
    const shimmer = container.querySelector('div[style*="shimmer"]');
    expect(shimmer).toBeTruthy();
  });

  it('does not render shimmer when finished', () => {
    const runs = [makeRun(TaskState.COMPLETED)];
    const { container } = render(
      <OverallProgress flowCount={1} activeRuns={runs} themeColor="#0ea5e9" />
    );
    const shimmer = container.querySelector('div[style*="shimmer"]');
    expect(shimmer).toBeNull();
  });
});
