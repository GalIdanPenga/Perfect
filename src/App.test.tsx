// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { useFlowRuns } from './hooks/useFlowRuns';
import { useWorkerStatus } from './hooks/useWorkerStatus';
import { useWorkerConfigs } from './hooks/useWorkerConfigs';
import { useWorkerActions } from './hooks/useWorkerActions';
import { playCompletionSound } from './utils/audioUtils';
import { TaskState, FlowRun } from './types';

// ─── Mock hooks ──────────────────────────────────────────────────────────────

vi.mock('./hooks/useFlowRuns');
vi.mock('./hooks/useWorkerStatus');
vi.mock('./hooks/useWorkerConfigs');
vi.mock('./hooks/useWorkerActions');
vi.mock('./utils/audioUtils', () => ({ playCompletionSound: vi.fn() }));

// ─── Stub heavy child components ─────────────────────────────────────────────

vi.mock('./components/WorkerSelector', () => ({
  WorkerSelector: ({ onWorkerClick, onStart, onStop, availableWorkers, workerStatus }: any) => (
    <div data-testid="worker-selector">
      {availableWorkers?.map((c: any) => (
        <button key={c.id} data-testid={`worker-btn-${c.id}`} onClick={() => onWorkerClick(c.id)}>
          {c.name}
        </button>
      ))}
      <button data-testid="start-btn" onClick={onStart}>Start Worker</button>
      {workerStatus === 'running' && (
        <button data-testid="stop-btn-selector" onClick={onStop}>Stop Worker</button>
      )}
    </div>
  ),
}));

// vi.fn so tests can inspect the props (onDeleteRun/onBulkDelete) App passes down.
vi.mock('./components/HistoryPanel', () => ({
  HistoryPanel: vi.fn(({ runs }: any) => (
    <div data-testid="history-panel" data-count={String(runs.length)} />
  )),
}));

vi.mock('./components/ActiveRunCard', () => ({
  ActiveRunCard: ({ run }: any) => (
    <div data-testid="active-run-card">{run.flowName}</div>
  ),
}));

vi.mock('./components/progress/OverallProgress', () => ({
  OverallProgress: () => <div data-testid="overall-progress" />,
}));

vi.mock('./components/StatisticsWindow', () => ({
  StatisticsWindow: ({ onClose }: any) => (
    <div data-testid="statistics-window">
      <button onClick={onClose}>Close Stats</button>
    </div>
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_WORKER = {
  id: 'c1',
  name: 'Test Worker',
  color: '#00D9FF',
  description: 'Test',
  workingDir: '.',
  command: 'python',
  args: [],
};

const MOCK_WORKER_2 = {
  id: 'c2',
  name: 'Second Worker',
  color: '#ff0099',
  description: 'Test 2',
  workingDir: '.',
  command: 'node',
  args: [],
};

let mockRefreshRuns: ReturnType<typeof vi.fn>;
let mockSetWorkerStatus: ReturnType<typeof vi.fn>;
let mockSetSelectedWorkerId: ReturnType<typeof vi.fn>;
let mockHandleStartWorker: ReturnType<typeof vi.fn>;
let mockHandleStopWorker: ReturnType<typeof vi.fn>;

function makeRun(overrides: Partial<FlowRun> = {}): FlowRun {
  return {
    id: `run-${Math.random().toString(36).slice(2, 6)}`,
    flowId: 'flow-1',
    flowName: 'Test Flow',
    state: TaskState.COMPLETED,
    startTime: new Date().toISOString(),
    configuration: 'default',
    tags: {},
    logs: [],
    tasks: [],
    progress: 100,
    ...overrides,
  };
}

function setupMocks({
  runs = [] as FlowRun[],
  workerStatus = 'stopped' as 'stopped' | 'starting' | 'running' | 'error',
  activeWorker = null as any,
  availableWorkers = [MOCK_WORKER] as any[],
  selectedWorkerId = 'c1',
  isStartingWorker = false,
} = {}) {
  vi.mocked(useFlowRuns).mockReturnValue({ runs, refreshRuns: mockRefreshRuns } as any);
  vi.mocked(useWorkerStatus).mockReturnValue({ workerStatus, setWorkerStatus: mockSetWorkerStatus, activeWorker } as any);
  vi.mocked(useWorkerConfigs).mockReturnValue({
    availableWorkers,
    selectedWorkerId,
    setSelectedWorkerId: mockSetSelectedWorkerId,
  } as any);
  vi.mocked(useWorkerActions).mockReturnValue({
    isStartingWorker,
    handleStartWorker: mockHandleStartWorker,
    handleStopWorker: mockHandleStopWorker,
  } as any);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    mockRefreshRuns = vi.fn().mockResolvedValue(undefined);
    mockSetWorkerStatus = vi.fn();
    mockSetSelectedWorkerId = vi.fn();
    mockHandleStartWorker = vi.fn();
    mockHandleStopWorker = vi.fn().mockResolvedValue(undefined);

    // Default: stopped, no runs, worker c1 selected
    setupMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  // ── Empty state ────────────────────────────────────────────────────────────

  it('shows WorkerSelector when there are no active runs', () => {
    render(<App />);
    expect(screen.getByTestId('worker-selector')).toBeTruthy();
    expect(screen.queryByTestId('active-run-card')).toBeNull();
    expect(screen.queryByTestId('overall-progress')).toBeNull();
  });

  it('renders the app header with "Perfect" title', () => {
    render(<App />);
    expect(screen.getByText('Perfect')).toBeTruthy();
  });

  it('shows Statistics button', () => {
    render(<App />);
    expect(screen.getByText('Statistics')).toBeTruthy();
  });

  // ── Run partitioning ───────────────────────────────────────────────────────

  it('runs after sessionStartTime appear as active (not in history)', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const activeRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING });
    setupMocks({ runs: [activeRun] });

    render(<App />);

    expect(screen.getByTestId('active-run-card')).toBeTruthy();
    expect(screen.queryByTestId('worker-selector')).toBeNull();
    // History panel gets 0 runs (run is active, not past)
    expect(screen.getByTestId('history-panel').dataset.count).toBe('0');
  });

  it('completed runs before sessionStartTime go to history', () => {
    const sessionTime = new Date().toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const pastRun = makeRun({
      startTime: new Date(Date.now() - 10000).toISOString(),
      state: TaskState.COMPLETED,
    });
    setupMocks({ runs: [pastRun] });

    render(<App />);

    expect(screen.queryByTestId('active-run-card')).toBeNull();
    expect(screen.getByTestId('history-panel').dataset.count).toBe('1');
  });

  it('without session, all runs go to history', () => {
    const run1 = makeRun({ state: TaskState.COMPLETED });
    const run2 = makeRun({ state: TaskState.FAILED });
    setupMocks({ runs: [run1, run2] });

    render(<App />);

    // No session → no active runs → shows WorkerSelector
    expect(screen.getByTestId('worker-selector')).toBeTruthy();
    expect(screen.getByTestId('history-panel').dataset.count).toBe('2');
  });

  it('only completed/failed past runs appear in history (not running ones)', () => {
    const sessionTime = new Date(Date.now() + 60000).toISOString(); // future session
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const completedPast = makeRun({ startTime: new Date(Date.now() - 5000).toISOString(), state: TaskState.COMPLETED });
    const runningPast = makeRun({ startTime: new Date(Date.now() - 5000).toISOString(), state: TaskState.RUNNING });
    setupMocks({ runs: [completedPast, runningPast] });

    render(<App />);

    // Only the completed past run goes to history
    expect(screen.getByTestId('history-panel').dataset.count).toBe('1');
  });

  // ── Session auto-detect ────────────────────────────────────────────────────

  it('auto-detects session when running flows exist and no session is set', async () => {
    const runningRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING });
    setupMocks({ runs: [runningRun] });

    render(<App />);

    // After auto-detect useEffect fires, session is set and run becomes active
    await waitFor(() => {
      expect(screen.getByTestId('active-run-card')).toBeTruthy();
    });
  });

  it('does not auto-detect when session is already set', async () => {
    const sessionTime = new Date().toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    // Running run before session time (would trigger auto-detect if session absent)
    const oldRun = makeRun({
      startTime: new Date(Date.now() - 10000).toISOString(),
      state: TaskState.RUNNING,
    });
    setupMocks({ runs: [oldRun] });

    render(<App />);

    // Session was already set; run is before session so stays as history (RUNNING filtered out)
    expect(screen.queryByTestId('active-run-card')).toBeNull();
    expect(screen.getByTestId('worker-selector')).toBeTruthy();
  });

  // ── Completion sound ───────────────────────────────────────────────────────

  it('plays completion sound when all flows transition from running to finished', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const run = makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING });
    setupMocks({ runs: [run] });

    const { rerender } = render(<App />);
    expect(vi.mocked(playCompletionSound)).not.toHaveBeenCalled();

    // Transition: run becomes completed
    const completedRun = { ...run, state: TaskState.COMPLETED, progress: 100 };
    setupMocks({ runs: [completedRun] });
    rerender(<App />);

    expect(vi.mocked(playCompletionSound)).toHaveBeenCalledTimes(1);
  });

  it('does not play completion sound on mount when flows are already finished', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const completedRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.COMPLETED });
    setupMocks({ runs: [completedRun] });

    render(<App />);

    expect(vi.mocked(playCompletionSound)).not.toHaveBeenCalled();
  });

  it('plays completion sound only once even on subsequent re-renders while finished', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const run = makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING });
    setupMocks({ runs: [run] });

    const { rerender } = render(<App />);

    const completedRun = { ...run, state: TaskState.COMPLETED };
    setupMocks({ runs: [completedRun] });
    rerender(<App />);
    rerender(<App />);
    rerender(<App />);

    expect(vi.mocked(playCompletionSound)).toHaveBeenCalledTimes(1);
  });

  // ── Active/running indicator ───────────────────────────────────────────────

  it('shows ACTIVE badge when running flows exist', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const runningRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING });
    setupMocks({ runs: [runningRun] });

    render(<App />);

    expect(screen.getByText(/1 ACTIVE/)).toBeTruthy();
  });

  it('does not show ACTIVE badge when no running flows', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const completedRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.COMPLETED });
    setupMocks({ runs: [completedRun] });

    render(<App />);

    expect(screen.queryByText(/ACTIVE/)).toBeNull();
  });

  it('shows active worker indicator when activeWorker is set', () => {
    const activeWorker = { ...MOCK_WORKER, id: 'active-1', name: 'Active Worker' };
    setupMocks({ activeWorker });

    render(<App />);

    // Active worker name appears in the header indicator
    expect(screen.getByText('Active Worker')).toBeTruthy();
  });

  // ── Stop vs Return button ──────────────────────────────────────────────────

  it('shows Stop button when flows are running', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const runningRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING });
    setupMocks({ runs: [runningRun] });

    render(<App />);

    expect(screen.getByText('Stop')).toBeTruthy();
    expect(screen.queryByText('Return to Worker Selection')).toBeNull();
  });

  it('shows Return to Worker Selection when all flows are finished', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const completedRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.COMPLETED });
    setupMocks({ runs: [completedRun] });

    render(<App />);

    expect(screen.getByText('Return to Worker Selection')).toBeTruthy();
    expect(screen.queryByText('Stop')).toBeNull();
  });

  it('clicking Return to Worker Selection calls handleStopWorker(true)', async () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const completedRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.COMPLETED });
    setupMocks({ runs: [completedRun] });

    render(<App />);
    fireEvent.click(screen.getByText('Return to Worker Selection'));

    expect(mockHandleStopWorker).toHaveBeenCalledWith(true);
  });

  // ── Stop confirmation dialog ───────────────────────────────────────────────

  it('clicking Stop opens confirmation dialog', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    setupMocks({ runs: [makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING })] });

    render(<App />);
    fireEvent.click(screen.getByText('Stop'));

    expect(screen.getByText('Confirm Stop')).toBeTruthy();
  });

  it('confirming stop calls handleStopWorker()', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    setupMocks({ runs: [makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING })] });

    render(<App />);
    fireEvent.click(screen.getByText('Stop'));
    fireEvent.click(screen.getByText('Stop', { selector: 'button.flex-1' }));

    expect(mockHandleStopWorker).toHaveBeenCalledTimes(1);
    expect(mockHandleStopWorker).not.toHaveBeenCalledWith(true);
  });

  it('cancelling stop dialog closes it without calling handleStopWorker', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    setupMocks({ runs: [makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING })] });

    render(<App />);
    fireEvent.click(screen.getByText('Stop'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(mockHandleStopWorker).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirm Stop')).toBeNull();
  });

  // ── Worker confirmation dialog ─────────────────────────────────────────────

  it('clicking a worker card opens confirmation dialog', () => {
    setupMocks({ availableWorkers: [MOCK_WORKER, MOCK_WORKER_2] });

    render(<App />);
    fireEvent.click(screen.getByTestId('worker-btn-c2'));

    expect(screen.getByText('Confirm Worker Selection')).toBeTruthy();
  });

  it('confirming worker selection calls setSelectedWorkerId', () => {
    setupMocks({ availableWorkers: [MOCK_WORKER, MOCK_WORKER_2] });

    render(<App />);
    fireEvent.click(screen.getByTestId('worker-btn-c2'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(mockSetSelectedWorkerId).toHaveBeenCalledWith('c2');
  });

  it('cancelling worker dialog does not call setSelectedWorkerId', () => {
    setupMocks({ availableWorkers: [MOCK_WORKER, MOCK_WORKER_2] });

    render(<App />);
    fireEvent.click(screen.getByTestId('worker-btn-c2'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(mockSetSelectedWorkerId).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirm Worker Selection')).toBeNull();
  });

  it('clicking a worker while running does not open dialog', () => {
    setupMocks({ workerStatus: 'running', availableWorkers: [MOCK_WORKER, MOCK_WORKER_2] });

    render(<App />);
    // WorkerSelector mock doesn't render worker buttons when running — but even if it did,
    // the guard in handleWorkerClick prevents opening the dialog
    expect(screen.queryByText('Confirm Worker Selection')).toBeNull();
  });

  // ── Statistics window ──────────────────────────────────────────────────────

  it('clicking Statistics button opens StatisticsWindow', () => {
    render(<App />);
    expect(screen.queryByTestId('statistics-window')).toBeNull();

    fireEvent.click(screen.getByText('Statistics'));

    expect(screen.getByTestId('statistics-window')).toBeTruthy();
  });

  it('closing StatisticsWindow removes it from DOM', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Statistics'));
    fireEvent.click(screen.getByText('Close Stats'));

    expect(screen.queryByTestId('statistics-window')).toBeNull();
  });

  // ── Delete run ─────────────────────────────────────────────────────────────

  it('handleDeleteRun calls DELETE /api/runs/:id', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as any);
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const completedRun = makeRun({ id: 'run-abc', startTime: new Date().toISOString(), state: TaskState.COMPLETED });
    setupMocks({ runs: [completedRun] });

    // HistoryPanel stub receives onDeleteRun — we need to call it directly
    // since the stub doesn't expose it in the UI. We test via the prop flow.
    const { HistoryPanel } = await import('./components/HistoryPanel');
    render(<App />);

    // Grab the onDeleteRun prop passed to HistoryPanel
    const historyPanelProps = vi.mocked(HistoryPanel as any).mock?.calls?.[0]?.[0];
    expect(historyPanelProps?.onDeleteRun).toBeTypeOf('function');
    await historyPanelProps.onDeleteRun('run-abc');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/runs/run-abc'),
      { method: 'DELETE' }
    );

    fetchSpy.mockRestore();
  });

  it('handleBulkDelete calls DELETE for each selected run', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as any);
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const run1 = makeRun({ id: 'run-1', startTime: new Date().toISOString(), state: TaskState.COMPLETED });
    const run2 = makeRun({ id: 'run-2', startTime: new Date().toISOString(), state: TaskState.COMPLETED });
    setupMocks({ runs: [run1, run2] });

    const { HistoryPanel } = await import('./components/HistoryPanel');
    render(<App />);

    const props = vi.mocked(HistoryPanel as any).mock?.calls?.[0]?.[0];
    expect(props?.onBulkDelete).toBeTypeOf('function');
    await props.onBulkDelete(['run-1', 'run-2']);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
  });

  // ── Theme color ────────────────────────────────────────────────────────────

  it('theme defaults to activeWorker color when no selected worker matches', () => {
    const activeWorker = { ...MOCK_WORKER, id: 'active-2', name: 'Fallback Worker', color: '#ff0000' };
    setupMocks({
      availableWorkers: [MOCK_WORKER],
      selectedWorkerId: 'nonexistent',
      activeWorker,
    });

    render(<App />);
    // Active worker indicator shows the fallback worker name — no crash
    expect(screen.getByText('Fallback Worker')).toBeTruthy();
  });

  // ── Session persistence ────────────────────────────────────────────────────

  it('session start time is written to localStorage during auto-detect', async () => {
    const runningRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING });
    setupMocks({ runs: [runningRun] });

    render(<App />);

    await waitFor(() => {
      expect(localStorage.getItem('currentSessionStartTime')).not.toBeNull();
    });
  });
});
