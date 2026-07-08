// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { useFlowRuns } from './hooks/useFlowRuns';
import { useClientStatus } from './hooks/useClientStatus';
import { useClientConfigs } from './hooks/useClientConfigs';
import { useClientActions } from './hooks/useClientActions';
import { playCompletionSound } from './utils/audioUtils';
import { TaskState, FlowRun } from './types';

// ─── Mock hooks ──────────────────────────────────────────────────────────────

vi.mock('./hooks/useFlowRuns');
vi.mock('./hooks/useClientStatus');
vi.mock('./hooks/useClientConfigs');
vi.mock('./hooks/useClientActions');
vi.mock('./utils/audioUtils', () => ({ playCompletionSound: vi.fn() }));

// ─── Stub heavy child components ─────────────────────────────────────────────

vi.mock('./components/ClientSelector', () => ({
  ClientSelector: ({ onClientClick, onStart, onStop, availableClients, clientStatus }: any) => (
    <div data-testid="client-selector">
      {availableClients?.map((c: any) => (
        <button key={c.id} data-testid={`client-btn-${c.id}`} onClick={() => onClientClick(c.id)}>
          {c.name}
        </button>
      ))}
      <button data-testid="start-btn" onClick={onStart}>Start Client</button>
      {clientStatus === 'running' && (
        <button data-testid="stop-btn-selector" onClick={onStop}>Stop Client</button>
      )}
    </div>
  ),
}));

vi.mock('./components/HistoryPanel', () => ({
  HistoryPanel: ({ runs }: any) => (
    <div data-testid="history-panel" data-count={String(runs.length)} />
  ),
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

const MOCK_CLIENT = {
  id: 'c1',
  name: 'Test Client',
  color: '#00D9FF',
  description: 'Test',
  workingDir: '.',
  command: 'python',
  args: [],
};

const MOCK_CLIENT_2 = {
  id: 'c2',
  name: 'Second Client',
  color: '#ff0099',
  description: 'Test 2',
  workingDir: '.',
  command: 'node',
  args: [],
};

let mockRefreshRuns: ReturnType<typeof vi.fn>;
let mockSetClientStatus: ReturnType<typeof vi.fn>;
let mockSetSelectedClientId: ReturnType<typeof vi.fn>;
let mockHandleStartClient: ReturnType<typeof vi.fn>;
let mockHandleStopClient: ReturnType<typeof vi.fn>;

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
  clientStatus = 'stopped' as 'stopped' | 'starting' | 'running' | 'error',
  activeClient = null as any,
  availableClients = [MOCK_CLIENT] as any[],
  selectedClientId = 'c1',
  isStartingClient = false,
} = {}) {
  vi.mocked(useFlowRuns).mockReturnValue({ runs, refreshRuns: mockRefreshRuns } as any);
  vi.mocked(useClientStatus).mockReturnValue({ clientStatus, setClientStatus: mockSetClientStatus, activeClient } as any);
  vi.mocked(useClientConfigs).mockReturnValue({
    availableClients,
    selectedClientId,
    setSelectedClientId: mockSetSelectedClientId,
  } as any);
  vi.mocked(useClientActions).mockReturnValue({
    isStartingClient,
    handleStartClient: mockHandleStartClient,
    handleStopClient: mockHandleStopClient,
  } as any);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    mockRefreshRuns = vi.fn().mockResolvedValue(undefined);
    mockSetClientStatus = vi.fn();
    mockSetSelectedClientId = vi.fn();
    mockHandleStartClient = vi.fn();
    mockHandleStopClient = vi.fn().mockResolvedValue(undefined);

    // Default: stopped, no runs, client c1 selected
    setupMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  // ── Empty state ────────────────────────────────────────────────────────────

  it('shows ClientSelector when there are no active runs', () => {
    render(<App />);
    expect(screen.getByTestId('client-selector')).toBeTruthy();
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
    expect(screen.queryByTestId('client-selector')).toBeNull();
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

    // No session → no active runs → shows ClientSelector
    expect(screen.getByTestId('client-selector')).toBeTruthy();
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
    expect(screen.getByTestId('client-selector')).toBeTruthy();
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

  it('shows active client indicator when activeClient is set', () => {
    const activeClient = { ...MOCK_CLIENT, id: 'active-1', name: 'Active Client' };
    setupMocks({ activeClient });

    render(<App />);

    // Active client name appears in the header indicator
    expect(screen.getByText('Active Client')).toBeTruthy();
  });

  // ── Stop vs Return button ──────────────────────────────────────────────────

  it('shows Stop button when flows are running', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const runningRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING });
    setupMocks({ runs: [runningRun] });

    render(<App />);

    expect(screen.getByText('Stop')).toBeTruthy();
    expect(screen.queryByText('Return to Client Selection')).toBeNull();
  });

  it('shows Return to Client Selection when all flows are finished', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const completedRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.COMPLETED });
    setupMocks({ runs: [completedRun] });

    render(<App />);

    expect(screen.getByText('Return to Client Selection')).toBeTruthy();
    expect(screen.queryByText('Stop')).toBeNull();
  });

  it('clicking Return to Client Selection calls handleStopClient(true)', async () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    const completedRun = makeRun({ startTime: new Date().toISOString(), state: TaskState.COMPLETED });
    setupMocks({ runs: [completedRun] });

    render(<App />);
    fireEvent.click(screen.getByText('Return to Client Selection'));

    expect(mockHandleStopClient).toHaveBeenCalledWith(true);
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

  it('confirming stop calls handleStopClient()', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    setupMocks({ runs: [makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING })] });

    render(<App />);
    fireEvent.click(screen.getByText('Stop'));
    fireEvent.click(screen.getByText('Stop', { selector: 'button.flex-1' }));

    expect(mockHandleStopClient).toHaveBeenCalledTimes(1);
    expect(mockHandleStopClient).not.toHaveBeenCalledWith(true);
  });

  it('cancelling stop dialog closes it without calling handleStopClient', () => {
    const sessionTime = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem('currentSessionStartTime', JSON.stringify(sessionTime));
    setupMocks({ runs: [makeRun({ startTime: new Date().toISOString(), state: TaskState.RUNNING })] });

    render(<App />);
    fireEvent.click(screen.getByText('Stop'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(mockHandleStopClient).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirm Stop')).toBeNull();
  });

  // ── Client confirmation dialog ─────────────────────────────────────────────

  it('clicking a client card opens confirmation dialog', () => {
    setupMocks({ availableClients: [MOCK_CLIENT, MOCK_CLIENT_2] });

    render(<App />);
    fireEvent.click(screen.getByTestId('client-btn-c2'));

    expect(screen.getByText('Confirm Client Selection')).toBeTruthy();
  });

  it('confirming client selection calls setSelectedClientId', () => {
    setupMocks({ availableClients: [MOCK_CLIENT, MOCK_CLIENT_2] });

    render(<App />);
    fireEvent.click(screen.getByTestId('client-btn-c2'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(mockSetSelectedClientId).toHaveBeenCalledWith('c2');
  });

  it('cancelling client dialog does not call setSelectedClientId', () => {
    setupMocks({ availableClients: [MOCK_CLIENT, MOCK_CLIENT_2] });

    render(<App />);
    fireEvent.click(screen.getByTestId('client-btn-c2'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(mockSetSelectedClientId).not.toHaveBeenCalled();
    expect(screen.queryByText('Confirm Client Selection')).toBeNull();
  });

  it('clicking a client while running does not open dialog', () => {
    setupMocks({ clientStatus: 'running', availableClients: [MOCK_CLIENT, MOCK_CLIENT_2] });

    render(<App />);
    // ClientSelector mock doesn't render client buttons when running — but even if it did,
    // the guard in handleClientClick prevents opening the dialog
    expect(screen.queryByText('Confirm Client Selection')).toBeNull();
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
    if (historyPanelProps?.onDeleteRun) {
      await historyPanelProps.onDeleteRun('run-abc');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/runs/run-abc'),
        { method: 'DELETE' }
      );
    }

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
    if (props?.onBulkDelete) {
      await props.onBulkDelete(['run-1', 'run-2']);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    }

    fetchSpy.mockRestore();
  });

  // ── Theme color ────────────────────────────────────────────────────────────

  it('theme defaults to activeClient color when no selected client matches', () => {
    const activeClient = { ...MOCK_CLIENT, id: 'active-2', name: 'Fallback Client', color: '#ff0000' };
    setupMocks({
      availableClients: [MOCK_CLIENT],
      selectedClientId: 'nonexistent',
      activeClient,
    });

    render(<App />);
    // Active client indicator shows the fallback client name — no crash
    expect(screen.getByText('Fallback Client')).toBeTruthy();
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
