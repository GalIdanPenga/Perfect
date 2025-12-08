import React, { useState } from 'react';
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
  BarChart3
} from 'lucide-react';
import { TaskState } from './types';
import { PerfectLogo } from './components/PerfectLogo';
import { StatusIcon, StatusBadge } from './components/StatusComponents';
import { TagBadges } from './components/TagBadges';
import { ActiveRunCard } from './components/ActiveRunCard';
import { StatisticsWindow } from './components/StatisticsWindow';
import { useFlowRuns } from './hooks/useFlowRuns';
import { useClientStatus } from './hooks/useClientStatus';
import { useClientConfigs } from './hooks/useClientConfigs';
import { useClientActions } from './hooks/useClientActions';
import { getThemeColor } from './utils/themeUtils';
import {
  getActiveRuns,
  getHistoryRuns,
  applyAllFilters,
  getUniqueFlowNames
} from './utils/filterUtils';

// --- Main Layout ---

export default function App() {
  // Custom hooks for data fetching
  const runs = useFlowRuns();
  const { clientStatus, setClientStatus, activeClient } = useClientStatus();
  const { availableClients, selectedClientId, setSelectedClientId } = useClientConfigs();
  const { isStartingClient, handleStartClient, handleStopClient } = useClientActions(setClientStatus);

  // Local UI state
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | null>(null);
  const [closingHistoryRunId, setClosingHistoryRunId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | TaskState.COMPLETED | TaskState.FAILED>('all');
  const [flowNameFilter, setFlowNameFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Theme color based on selected client
  const selectedClient = availableClients.find(c => c.id === selectedClientId);
  const themeColor = getThemeColor(selectedClient, activeClient);

  // Get active and history runs using utility functions
  const activeRuns = getActiveRuns(runs);
  const allHistoryRuns = getHistoryRuns(runs);

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

        .animate-selectPulse {
          animation: selectPulse 0.3s ease-out;
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
        className="backdrop-blur-md border-b h-16 flex-none px-6 flex items-center justify-between shadow-sm z-20 relative transition-all duration-700"
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
            className="text-[10px] px-2 py-0.5 rounded-full border font-mono tracking-wide transition-all duration-700"
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
             className="p-5 border-b flex justify-between items-center shadow-sm backdrop-blur-sm transition-all duration-700"
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
                style={{ color: activeRuns.length > 0 ? themeColor : '#64748b' }}
              />
              Live Monitor
              {activeRuns.length > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all duration-700"
                  style={{
                    backgroundColor: `${themeColor}15`,
                    color: themeColor,
                    borderColor: `${themeColor}40`,
                    boxShadow: `0 0 15px ${themeColor}25`
                  }}
                >
                  {activeRuns.length} ACTIVE
                </span>
              )}
              {/* Active Client Indicator */}
              {activeClient && activeClient.color && (
                <span
                  className="px-2.5 py-1 rounded-md text-[10px] font-bold border-2 flex items-center gap-1.5 transition-all duration-700"
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
              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-700"
                  style={{ backgroundColor: themeColor }}
                ></span>
                Real-time feed
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {activeRuns.length === 0 ? (
              <div className="h-[70vh] flex flex-col items-center justify-center text-slate-600 space-y-8">
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
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center max-w-md w-full shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-300 mb-2">Python Client</h3>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Start the Python client to register and automatically execute workflows.
                  </p>

                  {/* Client Selector */}
                  {availableClients.length > 0 && (
                    <div className="mb-6 text-left">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                        Select Client Configuration
                      </label>
                      <div className="space-y-2">
                        {availableClients.map(client => {
                          const isSelected = selectedClientId === client.id;
                          const clientColor = client.color || '#0ea5e9'; // default sky-500

                          return (
                            <button
                              key={client.id}
                              onClick={() => setSelectedClientId(client.id)}
                              disabled={clientStatus === 'running' || clientStatus === 'starting'}
                              className="w-full text-left p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
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

                              <div className="flex items-start gap-3">
                                {/* Large color indicator */}
                                {client.color && (
                                  <div
                                    className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg relative"
                                    style={{
                                      background: `linear-gradient(135deg, ${client.color} 0%, ${client.color}cc 100%)`,
                                      boxShadow: `0 4px 12px ${client.color}60, inset 0 1px 0 rgba(255,255,255,0.2)`
                                    }}
                                  >
                                    <div className="w-3 h-3 bg-white/90 rounded-full"></div>
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div
                                    className="text-sm font-bold mb-0.5 transition-colors"
                                    style={{ color: isSelected ? clientColor : '#cbd5e1' }}
                                  >
                                    {client.name}
                                  </div>
                                  <div className="text-xs text-slate-500 leading-relaxed">
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

                  {/* Status Display */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        clientStatus === 'starting' ? 'animate-pulse' :
                        clientStatus === 'running' ? 'animate-pulse' : ''
                      }`}
                      style={{
                        backgroundColor:
                          clientStatus === 'running' && activeClient?.color ? activeClient.color :
                          clientStatus === 'running' ? '#10b981' :
                          clientStatus === 'starting' ? '#f59e0b' :
                          clientStatus === 'error' ? '#ef4444' :
                          '#475569'
                      }}
                    ></div>
                    <span className="text-sm text-slate-400 font-mono">
                      Status: <span
                        className="uppercase font-bold"
                        style={{
                          color:
                            clientStatus === 'running' && activeClient?.color ? activeClient.color :
                            clientStatus === 'running' ? '#34d399' :
                            clientStatus === 'starting' ? '#fbbf24' :
                            clientStatus === 'error' ? '#f87171' :
                            '#64748b'
                        }}
                      >{clientStatus}</span>
                    </span>
                  </div>

                  {/* Action Buttons */}
                  {clientStatus === 'stopped' || clientStatus === 'error' ? (
                    <button
                      onClick={() => handleStartClient(selectedClientId)}
                      disabled={isStartingClient}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 text-white rounded-lg font-medium text-base transition-all shadow-lg disabled:text-slate-500 disabled:cursor-not-allowed active:scale-95 disabled:bg-slate-700"
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
                      onClick={handleStopClient}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-rose-500 text-slate-300 hover:text-white rounded-lg font-medium text-base transition-all shadow-lg active:scale-95"
                    >
                      <XCircle size={20} />
                      Stop Client
                    </button>
                  )}

                  <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                    {clientStatus === 'running'
                      ? 'Client is connected. Flows will auto-execute upon registration.'
                      : 'Once started, all registered flows will execute automatically.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 pb-12">
                {activeRuns.map(run => (
                  <ActiveRunCard key={run.id} run={run} clientColor={activeClient?.color} />
                ))}
              </div>
            )}
            
            {/* History Section */}
            {allHistoryRuns.length > 0 && (
              <div className="mt-12 border-t border-slate-800 pt-8 mb-8">
                 <div className="flex items-center justify-between mb-4">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                     <Clock size={14} /> Execution History
                     <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-mono">
                       {historyRuns.length}
                     </span>
                   </h3>
                   {hasActiveFilters && (
                     <button
                       onClick={clearFilters}
                       className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-[10px] font-bold text-slate-400 hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all shadow-sm group"
                     >
                       <X size={12} className="group-hover:text-rose-400" />
                       Clear Filters
                     </button>
                   )}
                 </div>

                 {/* Filter Controls */}
                 <div className="flex flex-wrap gap-3 mb-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                   {/* Search Input */}
                   <div className="relative flex-1 min-w-[200px]">
                     <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
                     <input
                       type="text"
                       placeholder="Search by flow name or ID..."
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
                     <div className="flex flex-col gap-2">
                       {historyRuns.slice(0, showAllHistory ? historyRuns.length : 10).map(run => {
                        const runColor = run.clientColor || themeColor;
                        const isSelected = selectedHistoryRunId === run.id;
                        return (
                          <React.Fragment key={run.id}>
                            <div
                              onClick={() => handleHistoryClick(run.id)}
                              className={`bg-slate-800/40 p-3 rounded-lg border transition-all cursor-pointer hover:bg-slate-800/60 ${isSelected ? 'animate-selectPulse' : ''}`}
                              style={{
                                borderColor: isSelected ? runColor : '#475569',
                                backgroundColor: isSelected ? `${runColor}15` : 'rgba(30, 41, 59, 0.4)',
                                boxShadow: isSelected ? `0 0 20px ${runColor}30` : 'none'
                              }}
                            >
                              <div className="flex items-center justify-between gap-4">
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

                                {/* Configuration Badge */}
                                {run.configuration && (
                                  <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-700/50 text-sky-400 uppercase tracking-wider">
                                    {run.configuration}
                                  </span>
                                )}

                                {/* Run ID */}
                                <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-900/50 text-slate-400">
                                  {run.id.split('-')[0]}
                                </span>

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
                              </div>
                            </div>

                            {/* Expanded Details - Inline */}
                            {(isSelected || closingHistoryRunId === run.id) && (
                              <div
                                className="ml-6 overflow-hidden"
                                style={{
                                  animation: closingHistoryRunId === run.id
                                    ? 'smoothCollapse 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                                    : 'smoothExpand 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                                }}
                              >
                                <div className="pt-3">
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
                       <div className="flex justify-center mt-4">
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
    </div>
    </>
  );
}
