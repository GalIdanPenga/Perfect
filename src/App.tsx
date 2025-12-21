import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Play,
  ChevronDown,
  Filter,
  X,
  Search,
  Hash,
  Calendar,
  ChevronRight,
  XCircle,
  Clock,
  BarChart3,
  Trash2
} from 'lucide-react';
import { TaskState, FlowRun } from './types';
import { DEFAULT_THEME_COLOR, API_BASE_URL } from './constants';
import { PerfectLogo } from './components/PerfectLogo';
import { StatusIcon } from './components/StatusComponents';
import { TagBadges } from './components/TagBadges';
import { ActiveRunCard } from './components/ActiveRunCard';
import { StatisticsWindow } from './components/StatisticsWindow';
import { useFlowRuns } from './hooks/useFlowRuns';
import { useClientStatus } from './hooks/useClientStatus';
import { useClientConfigs } from './hooks/useClientConfigs';
import { useClientActions } from './hooks/useClientActions';
import {
  getActiveRuns,
  getHistoryRuns,
  applyAllFilters,
  getUniqueFlowNames
} from './utils/filterUtils';
import { playCompletionSound } from './utils/audioUtils';
import { ConfirmDialog } from './components/dialogs/ConfirmDialog';
import { OverallProgress } from './components/progress/OverallProgress';

// Helper functions
const calculateTotalTimeRemaining = (activeRuns: FlowRun[]): number => {
  let maxTimeRemaining = 0;
  activeRuns.forEach(run => {
    let runTimeRemaining = 0;
    run.tasks.forEach(task => {
      if (task.state === TaskState.PENDING) {
        runTimeRemaining += task.estimatedTime;
      } else if (task.state === TaskState.RUNNING || task.state === TaskState.RETRYING) {
        runTimeRemaining += task.estimatedTime * (1 - task.progress / 100);
      }
    });
    maxTimeRemaining = Math.max(maxTimeRemaining, runTimeRemaining);
  });
  return maxTimeRemaining;
};

// --- Main Layout ---

export default function App() {
  // Local UI state (must be before hooks that use it)
  const [currentSessionStartTime, setCurrentSessionStartTime] = useState<string | null>(() => {
    // Restore session start time from localStorage on initial load
    return localStorage.getItem('currentSessionStartTime');
  });

  // Track previous state to detect completion transition
  const prevAllFlowsFinishedRef = useRef<boolean>(false);

  // Custom hooks for data fetching
  const { runs, refreshRuns } = useFlowRuns();
  const { clientStatus, setClientStatus, activeClient } = useClientStatus();
  const { availableClients, selectedClientId, setSelectedClientId } = useClientConfigs();

  // Function to set session start time
  const setSessionStartTime = (time: string | null) => {
    setCurrentSessionStartTime(time);
    if (time) {
      localStorage.setItem('currentSessionStartTime', time);
    } else {
      localStorage.removeItem('currentSessionStartTime');
    }
  };

  const { isStartingClient, handleStartClient, handleStopClient } = useClientActions(setClientStatus, setSessionStartTime, refreshRuns);

  // More local UI state
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | null>(null);
  const [closingHistoryRunId, setClosingHistoryRunId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showClientConfirmation, setShowClientConfirmation] = useState(false);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [pendingDeleteRunId, setPendingDeleteRunId] = useState<string | null>(null);
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirmation, setShowBulkDeleteConfirmation] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | TaskState.COMPLETED | TaskState.FAILED>('all');
  const [flowNameFilter, setFlowNameFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

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

  // Apply filters to history runs using utility function
  const historyRuns = applyAllFilters(allHistoryRuns, {
    status: statusFilter,
    flowName: flowNameFilter,
    searchQuery,
    date: dateFilter
  });

  // Get unique flow names for the flow name filter dropdown
  const uniqueFlowNames = getUniqueFlowNames(runs);

  // Helper to clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
    setFlowNameFilter('all');
    setSearchQuery('');
    setDateFilter('all');
    setShowAllHistory(false);
  };

  // Check if any filters are active
  const hasActiveFilters = statusFilter !== 'all' || flowNameFilter !== 'all' || searchQuery.trim() !== '' || dateFilter !== 'all';

  // Check if all flows are finished (completed or failed)
  const allFlowsFinished = activeRuns.length > 0 && activeRuns.every(
    run => run.state === TaskState.COMPLETED || run.state === TaskState.FAILED
  );

  // Calculate time remaining using utility function
  const totalTimeRemaining = calculateTotalTimeRemaining(activeRuns);

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

  // Handler to show delete confirmation dialog
  const handleDeleteRunClick = (e: React.MouseEvent, runId: string) => {
    e.stopPropagation(); // Prevent triggering the row click
    setPendingDeleteRunId(runId);
    setShowDeleteConfirmation(true);
  };

  // Handler to confirm and delete run
  const handleConfirmDeleteRun = async () => {
    if (pendingDeleteRunId) {
      try {
        const response = await fetch(`${API_BASE_URL}/runs/${pendingDeleteRunId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          // If the deleted run was selected, deselect it
          if (selectedHistoryRunId === pendingDeleteRunId) {
            setSelectedHistoryRunId(null);
          }
          // Refresh runs to update the list
          if (refreshRuns) {
            await refreshRuns();
          }
        }
      } catch (error) {
        console.error('Failed to delete run:', error);
      }
    }
    setShowDeleteConfirmation(false);
    setPendingDeleteRunId(null);
  };

  // Handler to cancel delete
  const handleCancelDeleteRun = () => {
    setShowDeleteConfirmation(false);
    setPendingDeleteRunId(null);
  };

  // Handler to toggle run selection for bulk delete
  const handleToggleRunSelection = (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    setSelectedRunIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(runId)) {
        newSet.delete(runId);
      } else {
        newSet.add(runId);
      }
      return newSet;
    });
  };

  // Handler to select/deselect all visible runs
  const handleSelectAllRuns = (historyRunsList: FlowRun[]) => {
    if (selectedRunIds.size === historyRunsList.length) {
      // Deselect all
      setSelectedRunIds(new Set());
    } else {
      // Select all
      setSelectedRunIds(new Set(historyRunsList.map(r => r.id)));
    }
  };

  // Handler to show bulk delete confirmation
  const handleBulkDeleteClick = () => {
    if (selectedRunIds.size > 0) {
      setShowBulkDeleteConfirmation(true);
    }
  };

  // Handler to confirm bulk delete
  const handleConfirmBulkDelete = async () => {
    try {
      const deletePromises = Array.from(selectedRunIds).map(runId =>
        fetch(`${API_BASE_URL}/runs/${runId}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);

      // Clear selection
      setSelectedRunIds(new Set());

      // If any deleted run was the selected history run, deselect it
      if (selectedHistoryRunId && selectedRunIds.has(selectedHistoryRunId)) {
        setSelectedHistoryRunId(null);
      }

      // Refresh runs
      if (refreshRuns) {
        await refreshRuns();
      }
    } catch (error) {
      console.error('Failed to delete runs:', error);
    }
    setShowBulkDeleteConfirmation(false);
  };

  // Handler to cancel bulk delete
  const handleCancelBulkDelete = () => {
    setShowBulkDeleteConfirmation(false);
  };

  const handleHistoryClick = (runId: string) => {
    if (runId === selectedHistoryRunId) {
      // Start closing animation
      setClosingHistoryRunId(runId);
      // Wait for animation to complete before clearing selection
      setTimeout(() => {
        setSelectedHistoryRunId(null);
        setClosingHistoryRunId(null);
      }, 300); // Match animation duration
    } else {
      setClosingHistoryRunId(null);
      setSelectedHistoryRunId(runId);
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
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .animate-selectPulse {
          animation: selectPulse 0.3s ease-out;
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
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
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center max-w-md w-full shadow-2xl">
                  <h3 className="text-base font-bold text-slate-300 mb-1">Python Client</h3>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Start the Python client to register and automatically execute workflows.
                  </p>

                  {/* Client Selector */}
                  {availableClients.length > 0 && (
                    <div className="mb-4 text-left">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Select Client Configuration
                      </label>
                      <div className="space-y-1.5">
                        {availableClients.map(client => {
                          const isSelected = selectedClientId === client.id;
                          const clientColor = client.color || '#0ea5e9'; // default sky-500

                          return (
                            <button
                              key={client.id}
                              onClick={() => handleClientClick(client.id)}
                              disabled={clientStatus === 'running' || clientStatus === 'starting'}
                              className="w-full text-left p-3 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                              style={{
                                borderColor: isSelected ? clientColor : '#334155',
                                background: isSelected
                                  ? `linear-gradient(135deg, ${clientColor}18 0%, ${clientColor}08 100%)`
                                  : 'rgba(15, 23, 42, 0.5)',
                                boxShadow: isSelected
                                  ? `0 0 25px ${clientColor}40, inset 0 1px 0 ${clientColor}20`
                                  : 'none'
                              }}
                            >
                              {/* Animated border glow for selected */}
                              {isSelected && client.color && (
                                <div
                                  className="absolute inset-0 rounded-lg opacity-50 blur-md -z-10"
                                  style={{ background: clientColor }}
                                ></div>
                              )}

                              <div className="flex items-start gap-2.5">
                                {/* Compact color indicator */}
                                {client.color && (
                                  <div
                                    className="mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shadow-lg relative"
                                    style={{
                                      background: `linear-gradient(135deg, ${client.color} 0%, ${client.color}cc 100%)`,
                                      boxShadow: `0 2px 8px ${client.color}60, inset 0 1px 0 rgba(255,255,255,0.2)`
                                    }}
                                  >
                                    <div className="w-2 h-2 bg-white/90 rounded-full"></div>
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div
                                    className="text-sm font-bold mb-0.5 transition-colors"
                                    style={{ color: isSelected ? clientColor : '#cbd5e1' }}
                                  >
                                    {client.name}
                                  </div>
                                  <div className="text-xs text-slate-500 leading-snug">
                                    {client.description}
                                  </div>
                                </div>
                                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'border-white/50'
                                    : 'border-slate-600 bg-slate-900'
                                }`}
                                style={{
                                  backgroundColor: isSelected ? clientColor : undefined
                                }}
                                >
                                  {isSelected && (
                                    <div className="w-2 h-2 rounded-full bg-white"></div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {clientStatus === 'stopped' || clientStatus === 'error' ? (
                    <button
                      onClick={() => handleStartClient(selectedClientId)}
                      disabled={isStartingClient}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-white rounded-lg font-medium text-sm transition-all shadow-lg disabled:text-slate-500 disabled:cursor-not-allowed active:scale-95 disabled:bg-slate-700"
                      style={{
                        backgroundColor: isStartingClient ? '#334155' : themeColor,
                        boxShadow: isStartingClient ? 'none' : `0 10px 30px ${themeColor}40, 0 0 20px ${themeColor}30`
                      }}
                      onMouseEnter={(e) => {
                        if (!isStartingClient) {
                          const r = parseInt(themeColor.slice(1, 3), 16);
                          const g = parseInt(themeColor.slice(3, 5), 16);
                          const b = parseInt(themeColor.slice(5, 7), 16);
                          e.currentTarget.style.backgroundColor = `rgb(${Math.max(0, r-20)}, ${Math.max(0, g-20)}, ${Math.max(0, b-20)})`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isStartingClient) {
                          e.currentTarget.style.backgroundColor = themeColor;
                        }
                      }}
                    >
                      <Play size={20} className="fill-current" />
                      {isStartingClient ? 'Starting...' : 'Start Python Client'}
                    </button>
                  ) : (
                    <button
                      onClick={handleStopClientClick}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-rose-500 text-slate-300 hover:text-white rounded-lg font-medium text-sm transition-all shadow-lg active:scale-95"
                    >
                      <XCircle size={18} />
                      Stop Client
                    </button>
                  )}

                  <p className="text-xs text-slate-500 mt-3 leading-snug">
                    {clientStatus === 'running'
                      ? 'Client is connected. Flows will auto-execute upon registration.'
                      : 'Once started, all registered flows will execute automatically.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Overall Progress Bar - Show when flows are running */}
                {!allFlowsFinished && activeRuns.length > 0 && (
                  <OverallProgress
                    flowCount={activeRuns.length}
                    activeRuns={activeRuns}
                    timeRemaining={totalTimeRemaining}
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

            {/* History Section */}
            {allHistoryRuns.length > 0 && (
              <div className="mt-6 border-t border-slate-800 pt-4 mb-4">
                 <div className="flex items-center justify-between mb-3">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                     <Clock size={14} /> Execution History
                     <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs font-mono">
                       {historyRuns.length}
                     </span>
                   </h3>
                   <div className="flex items-center gap-2">
                     {/* Bulk Delete Button - Show when items are selected */}
                     {selectedRunIds.size > 0 && (
                       <button
                         onClick={handleBulkDeleteClick}
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 border border-rose-500/50 rounded-md text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition-all shadow-sm"
                       >
                         <Trash2 size={12} />
                         Delete ({selectedRunIds.size})
                       </button>
                     )}
                     {/* Select All Checkbox */}
                     {historyRuns.length > 0 && (
                       <button
                         onClick={() => handleSelectAllRuns(historyRuns)}
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-xs font-bold text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-all shadow-sm"
                       >
                         {selectedRunIds.size === historyRuns.length && historyRuns.length > 0 ? 'Deselect All' : 'Select All'}
                       </button>
                     )}
                     {hasActiveFilters && (
                       <button
                         onClick={clearFilters}
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-xs font-bold text-slate-400 hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all shadow-sm group"
                       >
                         <X size={12} className="group-hover:text-rose-400" />
                         Clear Filters
                       </button>
                     )}
                   </div>
                 </div>

                 {/* Filter Controls */}
                 <div className="flex flex-wrap gap-2 mb-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                   {/* Search Input */}
                   <div className="relative flex-1 min-w-[200px]">
                     <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
                     <input
                       type="text"
                       placeholder="Search by flow name, ID, or tag values..."
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-md py-2 pl-9 pr-3 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors placeholder:text-slate-600"
                     />
                   </div>

                   {/* Status Filter */}
                   <div className="relative">
                     <Filter size={12} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
                     <select
                       value={statusFilter}
                       onChange={(e) => setStatusFilter(e.target.value as any)}
                       className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-md py-2 pl-9 pr-8 appearance-none focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer hover:border-slate-600 transition-colors"
                     >
                       <option value="all">All Status</option>
                       <option value={TaskState.COMPLETED}>Completed</option>
                       <option value={TaskState.FAILED}>Failed</option>
                     </select>
                     <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
                   </div>

                   {/* Flow Name Filter */}
                   {uniqueFlowNames.length > 0 && (
                     <div className="relative">
                       <Hash size={12} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
                       <select
                         value={flowNameFilter}
                         onChange={(e) => setFlowNameFilter(e.target.value)}
                         className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-md py-2 pl-9 pr-8 appearance-none focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer hover:border-slate-600 transition-colors"
                       >
                         <option value="all">All Flows</option>
                         {uniqueFlowNames.map(name => (
                           <option key={name} value={name}>{name}</option>
                         ))}
                       </select>
                       <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
                     </div>
                   )}

                   {/* Date Filter */}
                   <div className="relative">
                     <Calendar size={12} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
                     <select
                       value={dateFilter}
                       onChange={(e) => setDateFilter(e.target.value as any)}
                       className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-md py-2 pl-9 pr-8 appearance-none focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer hover:border-slate-600 transition-colors"
                     >
                       <option value="all">All Time</option>
                       <option value="today">Today</option>
                       <option value="week">Last 7 Days</option>
                       <option value="month">Last 30 Days</option>
                     </select>
                     <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
                   </div>
                 </div>

                 {historyRuns.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                     <Filter size={32} className="mb-3 text-slate-700" />
                     <p className="text-sm font-medium text-slate-400">No matching runs found</p>
                     <p className="text-xs text-slate-600 mt-1">Try adjusting your filters</p>
                   </div>
                 ) : (
                   <>
                     <div className="flex flex-col gap-1.5">
                       {historyRuns.slice(0, showAllHistory ? historyRuns.length : 10).map(run => {
                        const runColor = run.clientColor || themeColor;
                        const isSelected = selectedHistoryRunId === run.id;
                        return (
                          <React.Fragment key={run.id}>
                            <div
                              onClick={() => handleHistoryClick(run.id)}
                              className={`group bg-slate-800/40 p-2.5 rounded-lg border transition-all cursor-pointer hover:bg-slate-800/60 ${isSelected ? 'animate-selectPulse' : ''} relative overflow-hidden`}
                              style={{
                                borderColor: isSelected ? runColor : selectedRunIds.has(run.id) ? '#94a3b8' : '#475569',
                                backgroundColor: isSelected ? `${runColor}15` : selectedRunIds.has(run.id) ? 'rgba(148, 163, 184, 0.1)' : 'rgba(30, 41, 59, 0.4)',
                                boxShadow: isSelected ? `0 0 20px ${runColor}30` : 'none'
                              }}
                            >
                              {/* Left edge hover zone with sliding checkbox */}
                              <div
                                className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center z-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => handleToggleRunSelection(e, run.id)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                                    selectedRunIds.has(run.id)
                                      ? 'bg-sky-500 border-sky-500 text-white translate-x-0 opacity-100'
                                      : 'border-slate-500 bg-slate-800 -translate-x-8 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 hover:border-sky-400'
                                  }`}
                                >
                                  {selectedRunIds.has(run.id) && (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              </div>

                              <div className={`flex items-center justify-between gap-4 transition-all duration-200 ${selectedRunIds.has(run.id) ? 'ml-8' : 'group-hover:ml-8'}`}>
                                {/* Flow Name and Status */}
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <StatusIcon state={run.state} size={16} />
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span
                                      className="font-semibold text-sm transition-colors"
                                      style={{
                                        color: isSelected ? runColor : '#cbd5e1'
                                      }}
                                      title={run.flowName}
                                    >
                                      {run.flowName}
                                    </span>
                                    {run.tags && Object.keys(run.tags).length > 0 && (
                                      <TagBadges tags={run.tags} />
                                    )}
                                  </div>
                                </div>

                                {/* Time */}
                                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                                  <Clock size={12} />
                                  <span>{new Date(run.startTime).toLocaleTimeString()}</span>
                                </div>

                                {/* Progress */}
                                <span
                                  className="text-sm font-bold font-mono w-12 text-right"
                                  style={{
                                    color: run.state === TaskState.FAILED ? '#f87171' : isSelected ? runColor : '#38bdf8'
                                  }}
                                >
                                  {run.progress}%
                                </span>

                                {/* Delete Button */}
                                <button
                                  onClick={(e) => handleDeleteRunClick(e, run.id)}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                  title="Delete run"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Expanded Details - Inline */}
                            {(isSelected || closingHistoryRunId === run.id) && (
                              <div
                                className="ml-4 overflow-hidden"
                                style={{
                                  animation: closingHistoryRunId === run.id
                                    ? 'smoothCollapse 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                                    : 'smoothExpand 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                                }}
                              >
                                <div className="pt-2">
                                  <ActiveRunCard run={run} clientColor={run.clientColor} />
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                     </div>

                     {/* Show All / Show Less Button */}
                     {historyRuns.length > 10 && (
                       <div className="flex justify-center mt-3">
                         <button
                           onClick={() => setShowAllHistory(!showAllHistory)}
                           className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border rounded-lg text-xs font-medium transition-all shadow-sm group"
                           style={{
                             borderColor: '#475569',
                             color: '#94a3b8'
                           }}
                           onMouseEnter={(e) => {
                             e.currentTarget.style.color = themeColor;
                             e.currentTarget.style.borderColor = `${themeColor}80`;
                             e.currentTarget.style.backgroundColor = `${themeColor}10`;
                           }}
                           onMouseLeave={(e) => {
                             e.currentTarget.style.color = '#94a3b8';
                             e.currentTarget.style.borderColor = '#475569';
                             e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.5)';
                           }}
                         >
                           <span>
                             {showAllHistory ? `Show Less` : `Show All (${historyRuns.length} total)`}
                           </span>
                           <ChevronRight
                             size={14}
                             className={`transition-transform ${showAllHistory ? 'rotate-90' : 'rotate-0'} group-hover:translate-x-0.5`}
                           />
                         </button>
                       </div>
                     )}
                   </>
                 )}
              </div>
            )}
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

      {/* Delete Run Confirmation Dialog */}
      {showDeleteConfirmation && pendingDeleteRunId && (() => {
        const runToDelete = runs.find(r => r.id === pendingDeleteRunId);
        return (
          <ConfirmDialog
            isOpen={showDeleteConfirmation}
            title="Delete Run"
            icon={Trash2}
            message="Are you sure you want to delete"
            highlightText={runToDelete?.flowName || 'this run'}
            themeColor="#ef4444"
            confirmLabel="Delete"
            onConfirm={handleConfirmDeleteRun}
            onCancel={handleCancelDeleteRun}
          />
        );
      })()}

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showBulkDeleteConfirmation}
        title="Delete Multiple Runs"
        icon={Trash2}
        message={`Are you sure you want to delete ${selectedRunIds.size} selected runs? This action cannot be undone.`}
        themeColor="#ef4444"
        confirmLabel={`Delete ${selectedRunIds.size} Runs`}
        onConfirm={handleConfirmBulkDelete}
        onCancel={handleCancelBulkDelete}
      />
    </div>
    </>
  );
}
