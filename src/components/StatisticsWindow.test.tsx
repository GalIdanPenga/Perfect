// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { StatisticsWindow } from './StatisticsWindow';

const mockStats = {
  success: true,
  taskStatistics: [
    { flowName: 'Flow A', taskName: 'step1', avgDurationMs: 1500, stdDevDurationMs: 200, sampleCount: 5, lastUpdated: new Date().toISOString() },
    { flowName: 'Flow A', taskName: 'step2', avgDurationMs: 800, stdDevDurationMs: 50, sampleCount: 3, lastUpdated: new Date().toISOString() },
  ],
  flowStatistics: [
    { flowName: 'Flow A', avgDurationMs: 2300, stdDevDurationMs: 300, sampleCount: 3, lastUpdated: new Date().toISOString() },
  ],
};

function mockFetchSuccess(data = mockStats) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  }));
}

function mockFetchEmpty() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, taskStatistics: [], flowStatistics: [] }),
  }));
}

describe('StatisticsWindow', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('calls GET /api/statistics on mount', async () => {
    mockFetchSuccess();
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(expect.stringContaining('/statistics')));
  });

  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<StatisticsWindow onClose={vi.fn()} />);
    expect(screen.getByText('Loading statistics...')).toBeTruthy();
  });

  it('shows empty state when no statistics', async () => {
    mockFetchEmpty();
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('No statistics available yet')).toBeTruthy());
  });

  it('shows task statistics after fetch', async () => {
    mockFetchSuccess();
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('step1')).toBeTruthy());
  });

  it('shows flow statistics section', async () => {
    mockFetchSuccess();
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Flow Statistics')).toBeTruthy());
  });

  it('renders summary cards with correct counts', async () => {
    mockFetchSuccess();
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Total Flows')).toBeTruthy();
      expect(screen.getByText('Total Tasks')).toBeTruthy();
      expect(screen.getByText('Total Samples')).toBeTruthy();
    });
  });

  it('shows grouped by flow by default', async () => {
    mockFetchSuccess();
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText('Flow A').length).toBeGreaterThan(0));
    // In grouped view, "Ungroup" button is shown
    expect(screen.getByText('Ungroup')).toBeTruthy();
  });

  it('clicking Ungroup toggles to flat view', async () => {
    mockFetchSuccess();
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Ungroup'));
    fireEvent.click(screen.getByText('Ungroup'));
    expect(screen.getByText('Group by Flow')).toBeTruthy();
  });

  it('shows Clear All button when stats exist', async () => {
    mockFetchSuccess();
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Clear All')).toBeTruthy());
  });

  it('Clear All opens confirm dialog', async () => {
    mockFetchSuccess();
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Clear All'));
    fireEvent.click(screen.getByText('Clear All'));
    expect(screen.getByText('Clear All Statistics')).toBeTruthy();
  });

  it('confirming Clear All calls DELETE /api/statistics', async () => {
    mockFetchSuccess();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockStats })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    );
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText('Clear All'));
    // Click the first "Clear All" button (in the stats window header)
    fireEvent.click(screen.getAllByText('Clear All')[0]);
    await waitFor(() => screen.getByText('Clear All Statistics'));
    // Click the confirm button in the dialog — it has same text, use the second one
    const clearAllBtns = screen.getAllByText('Clear All');
    fireEvent.click(clearAllBtns[clearAllBtns.length - 1]);
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/statistics'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('shows View button per task row (opens history modal)', async () => {
    mockFetchSuccess();
    render(<StatisticsWindow onClose={vi.fn()} />);
    await waitFor(() => screen.getAllByText('View'));
    const viewButtons = screen.getAllByText('View');
    expect(viewButtons.length).toBeGreaterThan(0);
  });

  it('close button calls onClose after animation', async () => {
    mockFetchSuccess();
    const onClose = vi.fn();
    render(<StatisticsWindow onClose={onClose} />);
    await waitFor(() => screen.getByText('Task Statistics'));
    const closeBtn = screen.getByTitle ? null : null;
    // Find the X button
    const buttons = document.querySelectorAll('button');
    const xBtn = Array.from(buttons).find(b => b.querySelector('svg') && !b.textContent?.trim());
    if (xBtn) {
      fireEvent.click(xBtn);
      act(() => { vi.advanceTimersByTime(250); });
      expect(onClose).toHaveBeenCalledTimes(1);
    } else {
      // Fallback: click backdrop
      const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
      fireEvent.click(backdrop);
      act(() => { vi.advanceTimersByTime(250); });
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });
});
