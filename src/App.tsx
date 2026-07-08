import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  BarChart3,
  ChevronRight,
  XCircle,
} from 'lucide-react';
import { TaskState, FlowRun } from './types';
import { DEFAULT_THEME_COLOR, API_BASE_URL } from './constants';
import { PerfectLogo } from './components/PerfectLogo';
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

  // Initialize to current state so the sound doesn't re-fire when the page reloads
  // while flows are already finished.
  const prevAllFlowsFinishedRef = useRef<boolean>(allFlowsFinished);

  // Play sound notification when all flows complete
  useEffect(() => {
    // Check if flows just finished (transition from false to true)
    if (allFlowsFinished && !prevAllFlowsFinishedRef.current) {
      playCompletionSound();
    }
    // Update the ref to current state
    prevAllFlowsFinishedRef.current = allFlowsFinished;
  }, [allFlowsFinished]);

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
    <>
      <style>{`
        @keyframes smoothExpand {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            max-height: 2000px;
            transform: translateY(0);
          }
        }

        @keyframes smoothCollapse {
          from {
            opacity: 1;
            max-height: 2000px;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
        }

        @keyframes selectPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }

        @keyframes shimmer {
          0% { left: -50%; }
          100% { left: 100%; }
        }

        .animate-selectPulse {
          animation: selectPulse 0.3s ease-out;
        }

        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
      <div
        className="h-screen flex flex-col overflow-hidden text-slate-200 font-sans transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse at top, ${themeColor}12 0%, #0f172a 50%, #0f172a 100%)`,
          backgroundColor: '#0f172a'
        }}
      >

      {/* Top Navigation Bar */}
      <header
        className="backdrop-blur-md border-b h-14 flex-none px-5 flex items-center justify-between shadow-sm z-20 relative transition-all duration-700"
        style={{
          backgroundColor: `${themeColor}12`,
          borderBottomColor: `${themeColor}50`,
          boxShadow: `0 4px 20px ${themeColor}25`
        }}
      >
        <div className="flex items-center gap-3">
          <PerfectLogo />
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Perfect</h1>
          <span
            className="text-xs px-2 py-0.5 rounded-full border font-mono tracking-wide transition-all duration-700"
            style={{
              backgroundColor: `${themeColor}18`,
              color: themeColor,
              borderColor: `${themeColor}50`
            }}
          >v2.0</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span
              className="w-2 h-2 rounded-full animate-pulse transition-colors duration-700"
              style={{ backgroundColor: themeColor }}
            ></span>
            <span
              className="transition-colors duration-700"
              style={{ color: activeClient ? themeColor : '#64748b' }}
            >
              {activeClient ? 'Client Active' : 'System Online'}
            </span>
          </div>
          <button
            className="p-2 rounded-lg transition-all text-slate-400 hover:text-white duration-300"
            style={{
              background: 'transparent',
              ['--hover-bg' as any]: `${themeColor}20`
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = `${themeColor}20`}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Activity size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">

        {/* Live Monitoring Dashboard */}
        <div className="flex-1 flex flex-col relative">
          {/* Dashboard Header */}
           <div
             className="p-3 border-b flex justify-between items-center shadow-sm backdrop-blur-sm transition-all duration-700"
             style={{
               borderBottomColor: `${themeColor}30`,
               backgroundColor: `${themeColor}10`,
               boxShadow: `0 4px 15px ${themeColor}15`
             }}
           >
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Activity
                size={14}
                className={`animate-pulse transition-colors duration-700`}
                style={{ color: runningFlowsCount > 0 ? themeColor : '#64748b' }}
              />
              Live Monitor
              {runningFlowsCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold border transition-all duration-700"
                  style={{
                    backgroundColor: `${themeColor}15`,
                    color: themeColor,
                    borderColor: `${themeColor}40`,
                    boxShadow: `0 0 15px ${themeColor}25`
                  }}
                >
                  {runningFlowsCount} ACTIVE
                </span>
              )}
              {/* Active Client Indicator */}
              {activeClient && activeClient.color && (
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-bold border-2 flex items-center gap-1.5 transition-all duration-700"
                  style={{
                    backgroundColor: `${activeClient.color}18`,
                    borderColor: activeClient.color,
                    color: activeClient.color,
                    boxShadow: `0 0 20px ${activeClient.color}40`
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: activeClient.color }}
                  ></div>
                  {activeClient.name}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowStatistics(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200 hover:border-sky-500/50"
                style={{
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <BarChart3 size={14} />
                Statistics
              </button>
              <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-700"
                  style={{ backgroundColor: themeColor }}
                ></span>
                Real-time feed
              </div>
            </div>
          </div>
          
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
                <div className="flex justify-center mt-4 mb-6">
                  {allFlowsFinished ? (
                    // Show "Return to Client Selection" when all flows are finished
                    <button
                      onClick={handleReturnToClients}
                      className="group relative px-8 py-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 active:scale-95"
                      style={{
                        borderColor: themeColor,
                        background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
                        boxShadow: `0 8px 32px ${themeColor}30`
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight
                          size={20}
                          className="transform group-hover:-translate-x-1 transition-transform"
                          style={{ color: themeColor }}
                        />
                        <span
                          className="text-sm font-bold tracking-wide"
                          style={{ color: themeColor }}
                        >
                          Return to Client Selection
                        </span>
                        <ChevronRight
                          size={20}
                          className="transform group-hover:translate-x-1 transition-transform"
                          style={{ color: themeColor }}
                        />
                      </div>

                      {/* Animated border glow */}
                      <div
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300 -z-10"
                        style={{ background: themeColor }}
                      ></div>
                    </button>
                  ) : (
                    // Show "Stop" button when flows are running
                    <button
                      onClick={handleStopClientClick}
                      className="group relative px-8 py-4 rounded-xl border-2 transition-all duration-300 hover:scale-105 active:scale-95"
                      style={{
                        borderColor: '#ef4444',
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
                        boxShadow: '0 8px 32px rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <XCircle
                          size={20}
                          className="transition-transform group-hover:rotate-90"
                          style={{ color: '#ef4444' }}
                        />
                        <span
                          className="text-sm font-bold tracking-wide"
                          style={{ color: '#ef4444' }}
                        >
                          Stop
                        </span>
                      </div>

                      {/* Animated border glow */}
                      <div
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300 -z-10"
                        style={{ background: '#ef4444' }}
                      ></div>
                    </button>
                  )}
                </div>
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
    </>
  );
}
