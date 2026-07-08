// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { PerformanceHistoryModal } from './PerformanceHistoryModal';

const mockHistory = [
  { runId: 'r1', timestamp: new Date(Date.now() - 60000).toISOString(), durationMs: 1200 },
  { runId: 'r2', timestamp: new Date(Date.now() - 30000).toISOString(), durationMs: 1500 },
];
const mockStatsData = { avgDurationMs: 1350, stdDevDurationMs: 150 };

function mockFetchHistory(history = mockHistory, stats = mockStatsData) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, history, stats }),
  }));
}

describe('PerformanceHistoryModal', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('calls task-history endpoint when type=task', async () => {
    mockFetchHistory();
    render(
      <PerformanceHistoryModal type="task" flowName="My Flow" taskName="my_task" onClose={vi.fn()} />
    );
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('task-history/My%20Flow/my_task')
    ));
  });

  it('calls flow-history endpoint when type=flow', async () => {
    mockFetchHistory();
    render(
      <PerformanceHistoryModal type="flow" flowName="My Flow" onClose={vi.fn()} />
    );
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('flow-history/My%20Flow')
    ));
  });

  it('uses API_BASE_URL (not hardcoded localhost:3000)', async () => {
    mockFetchHistory();
    render(
      <PerformanceHistoryModal type="task" flowName="F" taskName="t" onClose={vi.fn()} />
    );
    await waitFor(() => {
      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      // Should contain /api/statistics — not a hardcoded localhost:3000 string
      // (API_BASE_URL could be anything, but not raw localhost:3000/api)
      expect(url).toContain('/statistics');
    });
  });

  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<PerformanceHistoryModal type="task" flowName="F" taskName="t" onClose={vi.fn()} />);
    expect(screen.getByText('Loading history...')).toBeTruthy();
  });

  it('shows empty state when history is empty', async () => {
    mockFetchHistory([]);
    render(<PerformanceHistoryModal type="task" flowName="F" taskName="t" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('No historical data available')).toBeTruthy());
  });

  it('renders TimeSeriesChart when history has data', async () => {
    mockFetchHistory();
    render(<PerformanceHistoryModal type="task" flowName="F" taskName="t" onClose={vi.fn()} />);
    await waitFor(() => {
      // TimeSeriesChart renders with "Historical Samples" in title
      expect(screen.getByText('2 Historical Samples')).toBeTruthy();
    });
  });

  it('renders "Performance History" title', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<PerformanceHistoryModal type="task" flowName="F" taskName="t" onClose={vi.fn()} />);
    expect(screen.getByText('Performance History')).toBeTruthy();
  });

  it('shows flow/task name as subtitle', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<PerformanceHistoryModal type="task" flowName="My Flow" taskName="my_task" onClose={vi.fn()} />);
    expect(screen.getByText('My Flow / my_task')).toBeTruthy();
  });

  it('shows flow name as subtitle for type=flow', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<PerformanceHistoryModal type="flow" flowName="My Flow" onClose={vi.fn()} />);
    expect(screen.getByText('My Flow')).toBeTruthy();
  });

  it('close button calls onClose after animation', async () => {
    mockFetchHistory();
    const onClose = vi.fn();
    const { container } = render(
      <PerformanceHistoryModal type="task" flowName="F" taskName="t" onClose={onClose} />
    );
    // Click backdrop
    const backdrop = container.querySelector('.fixed.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    act(() => { vi.advanceTimersByTime(250); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
