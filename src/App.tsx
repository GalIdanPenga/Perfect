import { useState, useEffect, useRef } from 'react';
import { ChevronRight, XCircle } from 'lucide-react';
import { TaskState } from './types';
import { DEFAULT_THEME_COLOR, API_BASE_URL } from './constants';
import { PerfectLogo } from './components/PerfectLogo';
import { AppHeader } from './components/AppHeader';
import { LiveMonitorHeader } from './components/LiveMonitorHeader';
import { SessionActionButton } from './components/SessionActionButton';
import { ClientSelector } from './components/ClientSelector';
import { HistoryPanel } from './components/HistoryPanel';
import { ActiveRunCard } from './components/ActiveRunCard';
import { StatisticsWindow } from './components/StatisticsWindow';
import { ConfirmDialog } from './components/dialogs/ConfirmDialog';
import { OverallProgress } from './components/progress/OverallProgress';
import { useFlowRuns } from './hooks/useFlowRuns';
import { useClientStatus } from './hooks/useClientStatus';
import { useClientConfigs } from './hooks/useClientConfigs';
import { useClientActions } from './hooks/useClientActions';
import { useLocalStorage } from './hooks/useLocalStorage';
import { playCompletionSound } from './utils/audioUtils';

// --- Main Layout ---

export default function App() {
  // Session start time persisted to localStorage
  const [currentSessionStartTime, setSessionStartTime] = useLocalStorage<string | null>('currentSessionStartTime', null);

  // Custom hooks for data fetching
  const { runs, refreshRuns } = useFlowRuns();
  const { clientStatus, setClientStatus, activeClient } = useClientStatus();
  const { availableClients, selectedClientId, setSelectedClientId } = useClientConfigs();

  const { isStartingClient, handleStartClient, handleStopClient } = useClientActions(setClientStatus, setSessionStartTime, refreshRuns);

  // UI state
  const [showStatistics, setShowStatistics] = useState(false);
  const [showClientConfirmation, setShowClientConfirmation] = useState(false);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);

  // Theme color based on selected client
  const selectedClient = availableClients.find(c => c.id === selectedClientId);
  const themeColor = selectedClient?.color || activeClient?.color || DEFAULT_THEME_COLOR;

  // Auto-detect if client is running externally and flows are being registered
  useEffect(() => {
    // If there's no session start time but we have recent running/pending flows,
    // automatically set the session start time to show the live monitor
    if (!currentSessionStartTime && runs.length > 0) {
      const recentRunningFlows = runs.filter(run =>
        run.state === TaskState.RUNNING ||
        run.state === TaskState.PENDING ||
        run.state === TaskState.RETRYING
      );

      if (recentRunningFlows.length > 0) {
        // Find the earliest start time among running flows
        const earliestStartTime = recentRunningFlows.reduce((earliest, run) => {
          const runTime = new Date(run.startTime);
          return runTime < earliest ? runTime : earliest;
        }, new Date(recentRunningFlows[0].startTime));

        // Set session start time slightly before the earliest flow (2 seconds buffer)
        earliestStartTime.setSeconds(earliestStartTime.getSeconds() - 2);
        setSessionStartTime(earliestStartTime.toISOString());
      }
    }
  }, [runs, currentSessionStartTime, setSessionStartTime]);

  // Separate current session runs from past runs
  const currentSessionRuns = currentSessionStartTime
    ? runs.filter(run => new Date(run.startTime) >= new Date(currentSessionStartTime))
    : [];

  const pastRuns = currentSessionStartTime
    ? runs.filter(run => new Date(run.startTime) < new Date(currentSessionStartTime))
    : runs;

  // Active runs are current session runs (regardless of state)
  const activeRuns = currentSessionRuns;

  // History runs are past runs that are completed/failed
  const allHistoryRuns = pastRuns.filter(
    r => r.state === TaskState.COMPLETED || r.state === TaskState.FAILED
  );

  // Count truly active (running/pending) flows for the badge
  const runningFlowsCount = activeRuns.filter(
    run => run.state === TaskState.RUNNING || run.state === TaskState.PENDING || run.state === TaskState.RETRYING
  ).length;

  // Check if all flows are finished (completed or failed)
  const allFlowsFinished = activeRuns.length > 0 && activeRuns.every(
    run => run.state === TaskState.COMPLETED || run.state === TaskState.FAILED
  );

  const prevAllFlowsFinishedRef = useRef<boolean>(false);
  // Only chime after we've actually observed running flows this session. Runs
  // load asynchronously (empty on first render), so without this guard a reload
  // when flows are already finished looks like a false->true transition and
  // would replay the sound on every reload.
  const hasSeenRunningFlowsRef = useRef<boolean>(false);

  // Play sound notification when all flows complete
  useEffect(() => {
    if (runningFlowsCount > 0) {
      hasSeenRunningFlowsRef.current = true;
    }
    // Fire only on a genuine transition to "all finished" within a session
    // that actually had running flows.
    if (allFlowsFinished && !prevAllFlowsFinishedRef.current && hasSeenRunningFlowsRef.current) {
      playCompletionSound();
    }
    prevAllFlowsFinishedRef.current = allFlowsFinished;
  }, [allFlowsFinished, runningFlowsCount]);

  // Handler to return to client selection
  const handleReturnToClients = async () => {
    // Stop client on server side and clear session to move flows to history
    await handleStopClient(true);
  };

  // Handler to show confirmation dialog when switching clients
  const handleClientClick = (clientId: string) => {
    if (clientStatus === 'running' || clientStatus === 'starting') {
      // Don't allow switching while client is active
      return;
    }
    setPendingClientId(clientId);
    setShowClientConfirmation(true);
  };

  // Handler to confirm client selection
  const handleConfirmClientSelection = () => {
    if (pendingClientId) {
      setSelectedClientId(pendingClientId);
    }
    setShowClientConfirmation(false);
    setPendingClientId(null);
  };

  // Handler to cancel client selection
  const handleCancelClientSelection = () => {
    setShowClientConfirmation(false);
    setPendingClientId(null);
  };

  // Handler to show stop confirmation dialog
  const handleStopClientClick = () => {
    setShowStopConfirmation(true);
  };

  // Handler to confirm and stop client
  const handleConfirmStopClient = () => {
    setShowStopConfirmation(false);
    handleStopClient();
  };

  const handleDeleteRun = async (runId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/runs/${runId}`, { method: 'DELETE' });
      if (response.ok && refreshRuns) await refreshRuns();
    } catch (error) {
      console.error('Failed to delete run:', error);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => fetch(`${API_BASE_URL}/runs/${id}`, { method: 'DELETE' })));
      if (refreshRuns) await refreshRuns();
    } catch (error) {
      console.error('Failed to bulk delete runs:', error);
    }
  };

  return (
      <div
        className="h-screen flex flex-col overflow-hidden text-slate-200 font-sans transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse at top, ${themeColor}12 0%, #0f172a 50%, #0f172a 100%)`,
          backgroundColor: '#0f172a'
        }}
      >

      {/* Top Navigation Bar */}
      <AppHeader themeColor={themeColor} activeClient={activeClient} />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">

        {/* Live Monitoring Dashboard */}
        <div className="flex-1 flex flex-col relative">
          {/* Dashboard Header */}
          <LiveMonitorHeader
            themeColor={themeColor}
            runningFlowsCount={runningFlowsCount}
            activeClient={activeClient}
            onShowStatistics={() => setShowStatistics(true)}
          />

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {activeRuns.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-6">
                <div className="relative">
                  <div
                    className="absolute inset-0 blur-xl rounded-full transition-colors duration-700"
                    style={{ backgroundColor: `${themeColor}30` }}
                  ></div>
                  <div
                    className="bg-slate-800 p-8 rounded-2xl border relative shadow-xl transition-all duration-700"
                    style={{
                      borderColor: `${themeColor}40`,
                      boxShadow: `0 10px 40px ${themeColor}20`
                    }}
                  >
                    <PerfectLogo size={64} />
                  </div>
                </div>

                {/* Client Control - Centered */}
                <ClientSelector
                  availableClients={availableClients}
                  selectedClientId={selectedClientId}
                  clientStatus={clientStatus}
                  themeColor={themeColor}
                  isStartingClient={isStartingClient}
                  onClientClick={handleClientClick}
                  onStart={() => handleStartClient(selectedClientId)}
                  onStop={handleStopClientClick}
                />
              </div>
            ) : (
              <>
                {/* Overall Progress Bar - Stays visible at 100% when flows finish */}
                {activeRuns.length > 0 && (
                  <OverallProgress
                    flowCount={activeRuns.length}
                    activeRuns={activeRuns}
                    themeColor={themeColor}
                  />
                )}

                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 pb-6">
                  {activeRuns.map(run => (
                    <ActiveRunCard key={run.id} run={run} clientColor={activeClient?.color} />
                  ))}
                </div>

                {/* Action Button - Stop or Return to Client Selection */}
                <SessionActionButton
                  allFlowsFinished={allFlowsFinished}
                  themeColor={themeColor}
                  onReturn={handleReturnToClients}
                  onStop={handleStopClientClick}
                />
              </>
            )}

            <HistoryPanel
              runs={allHistoryRuns}
              themeColor={themeColor}
              onDeleteRun={handleDeleteRun}
              onBulkDelete={handleBulkDelete}
            />
          </div>
        </div>
      </main>

      {/* Statistics Window */}
      {showStatistics && (
        <StatisticsWindow onClose={() => setShowStatistics(false)} />
      )}

      {/* Client Confirmation Dialog */}
      {showClientConfirmation && pendingClientId && (() => {
        const pendingClient = availableClients.find((c: any) => c.id === pendingClientId);
        const confirmThemeColor = pendingClient?.color || themeColor;

        return (
          <ConfirmDialog
            isOpen={showClientConfirmation}
            title="Confirm Client Selection"
            icon={ChevronRight}
            message="Are you sure you want to choose"
            highlightText={pendingClient?.name}
            themeColor={confirmThemeColor}
            onConfirm={handleConfirmClientSelection}
            onCancel={handleCancelClientSelection}
          />
        );
      })()}

      {/* Stop Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showStopConfirmation}
        title="Confirm Stop"
        icon={XCircle}
        message="Are you sure you want to stop"
        highlightText={activeClient?.name || 'the client'}
        themeColor="#ef4444"
        confirmLabel="Stop"
        onConfirm={handleConfirmStopClient}
        onCancel={() => setShowStopConfirmation(false)}
      />

    </div>
  );
}
