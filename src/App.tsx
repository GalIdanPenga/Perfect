
import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Play,
  Terminal,
  CheckCircle,
  XCircle,
  Clock,
  RotateCw,
  ChevronDown,
  Filter,
  X,
  Search,
  Hash,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { FlowRun, TaskState, TaskRun } from './types';

// --- Types ---

interface ClientConfig {
  id: string;
  name: string;
  description: string;
  workingDir: string;
  command: string;
  args: string[];
}

// --- Icons & Badges ---

const PerfectLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-sky-400">
    {/* Outer circle - thin ring */}
    <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>

    {/* Main perfect circle */}
    <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2.5"/>

    {/* Checkmark - symbol of perfection */}
    <path
      d="M 11 16 L 14.5 19.5 L 21 13"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const StatusIcon = ({ state, size = 16 }: { state: TaskState, size?: number }) => {
  switch (state) {
    case TaskState.COMPLETED:
      return <CheckCircle size={size} className="text-cyber-success" />;
    case TaskState.FAILED:
      return <XCircle size={size} className="text-cyber-danger" />;
    case TaskState.RUNNING:
      return <RotateCw size={size} className="text-cyber-primary animate-spin" />;
    case TaskState.RETRYING:
      return <RotateCw size={size} className="text-cyber-warning animate-spin" />;
    case TaskState.PENDING:
      return <div className={`rounded-full border border-slate-600 bg-slate-800`} style={{ width: size, height: size }} />;
    default:
      return <div className="w-4 h-4 rounded-full bg-slate-600" />;
  }
};

const StatusBadge = ({ state }: { state: TaskState }) => {
  const styles = {
    [TaskState.COMPLETED]: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    [TaskState.FAILED]: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    [TaskState.RUNNING]: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    [TaskState.PENDING]: "bg-slate-700/30 text-slate-400 border-slate-700/50",
    [TaskState.RETRYING]: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[state] || styles[TaskState.PENDING]} flex items-center gap-1.5 shadow-sm`}>
      {state === TaskState.RUNNING && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"/>}
      {state}
    </span>
  );
};

// --- Components ---

const TaskRow = ({ task }: { task: TaskRun }) => {
  const isRunning = task.state === TaskState.RUNNING || task.state === TaskState.RETRYING;
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRunning && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [task.logs.length, isRunning]);

  return (
    <div className={`border-b border-slate-700/50 last:border-0 transition-colors duration-300 ${isRunning ? 'bg-sky-500/5' : ''}`}>
      <div className="flex items-center justify-between p-3.5">
        <div className="flex items-center gap-3">
          <StatusIcon state={task.state} size={18} />
          <div>
            <div className={`text-sm font-medium flex items-center gap-2 ${task.state === TaskState.PENDING ? 'text-slate-400' : 'text-slate-200'}`}>
              {task.taskName}
              {isRunning && (
                <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 rounded-md border border-sky-500/30 font-mono">
                  {Math.floor(task.progress)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
              <span>W: {(task.weight * 100).toFixed(1)}%</span>
              <span className="text-slate-700">•</span>
              <span>EST: {task.estimatedTime}ms</span>
              {task.durationMs && (
                <>
                  <span className="text-slate-700">•</span>
                  <span className="text-slate-400">TOOK: {task.durationMs}ms</span>
                </>
              )}
            </div>
          </div>
        </div>
        {task.state !== TaskState.PENDING && (
          <div className="text-xs text-slate-600 font-mono">
            {task.id.split('-')[1]}
          </div>
        )}
      </div>
      
      {/* Live Logs */}
      {(isRunning || task.state === TaskState.FAILED) && task.logs.length > 0 && (
        <div ref={logsRef} className="mx-4 mb-3 p-2.5 bg-slate-950/50 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300 max-h-24 overflow-y-auto custom-scrollbar shadow-inner">
          {task.logs.slice(-5).map((log, i) => (
            <div key={i} className="truncate mb-0.5 opacity-90">{log}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const ActiveRunCard = ({ run }: { run: FlowRun }) => {
  const flowLogsRef = useRef<HTMLDivElement>(null);
  const isRunning = run.state === TaskState.RUNNING || run.state === TaskState.PENDING || run.state === TaskState.RETRYING;

  // Calculate estimated time remaining
  const calculateTimeRemaining = () => {
    let remainingMs = 0;

    for (const task of run.tasks) {
      if (task.state === TaskState.PENDING) {
        // Add full estimated time for pending tasks
        remainingMs += task.estimatedTime;
      } else if (task.state === TaskState.RUNNING || task.state === TaskState.RETRYING) {
        // Add remaining time for running tasks based on progress
        const progressFraction = task.progress / 100;
        remainingMs += task.estimatedTime * (1 - progressFraction);
      }
      // Completed and failed tasks contribute 0
    }

    return remainingMs;
  };

  const formatTimeRemaining = (ms: number) => {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.round((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  };

  const timeRemaining = isRunning ? calculateTimeRemaining() : 0;

  useEffect(() => {
    if (isRunning && flowLogsRef.current) {
      flowLogsRef.current.scrollTop = flowLogsRef.current.scrollHeight;
    }
  }, [run.logs.length, isRunning]);

  return (
    <div className="bg-slate-800/40 backdrop-blur-md rounded-xl border border-slate-700/60 shadow-lg overflow-hidden flex flex-col transition-all hover:border-slate-600/80 group">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-100">{run.flowName}</h3>
            <StatusBadge state={run.state} />
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-2">
            ID: {run.id}
            {run.configuration && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                <span className="text-sky-400 uppercase tracking-wider">{run.configuration}</span>
              </>
            )}
            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
            {new Date(run.startTime).toLocaleTimeString()}
          </p>
        </div>
        <div className="text-right">
           <div className="flex flex-col items-end gap-1">
             <span className={`text-2xl font-bold font-mono tracking-tight ${run.state === TaskState.FAILED ? 'text-rose-400' : 'text-sky-400'}`}>
               {run.progress}%
             </span>
             {isRunning && timeRemaining > 0 && (
               <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                 <Clock size={10} className="text-slate-500" />
                 <span>~{formatTimeRemaining(timeRemaining)} left</span>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Smooth Progress Bar */}
      <div className="h-1 bg-slate-800 w-full relative">
        <div
          className={`h-full transition-all duration-300 ease-out relative ${run.state === TaskState.FAILED ? 'bg-rose-500' : 'bg-gradient-to-r from-sky-500 to-indigo-500'}`}
          style={{ width: `${run.progress}%` }}
        >
          {run.state === TaskState.RUNNING && (
            <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 blur-sm"></div>
          )}
        </div>
      </div>

      {/* Flow Logs */}
      {run.logs && run.logs.length > 0 && (
        <div ref={flowLogsRef} className="mx-4 mt-3 p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-[10px] font-mono max-h-24 overflow-y-auto custom-scrollbar shadow-inner">
          {run.logs.map((log, i) => (
            <div key={i} className="text-slate-300 mb-0.5 opacity-90 leading-relaxed">
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto max-h-[320px] custom-scrollbar bg-slate-900/20">
        {run.tasks.map(task => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
};

// --- Main Layout ---

export default function App() {
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | null>(null);
  const [clientStatus, setClientStatus] = useState<'stopped' | 'starting' | 'running' | 'error'>('stopped');
  const [isStartingClient, setIsStartingClient] = useState(false);

  // Client configuration states
  const [availableClients, setAvailableClients] = useState<ClientConfig[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | TaskState.COMPLETED | TaskState.FAILED>('all');
  const [flowNameFilter, setFlowNameFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Fetch data from backend API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const runsRes = await fetch('http://localhost:3001/api/engine/runs');

        if (runsRes.ok) {
          const runsData = await runsRes.json();
          setRuns(runsData);
        }
      } catch (error) {
        console.error('Failed to fetch data from backend:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 100); // Poll every 100ms for smooth updates
    return () => clearInterval(interval);
  }, []);

  // Poll client status
  useEffect(() => {
    const checkClientStatus = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/client/status');
        const data = await response.json();
        setClientStatus(data.status);
      } catch (error) {
        // Backend not running yet
      }
    };

    checkClientStatus();
    const interval = setInterval(checkClientStatus, 200); // Poll every 200ms for faster updates
    return () => clearInterval(interval);
  }, []);

  // Fetch available client configurations
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/client/configs');
        if (response.ok) {
          const data = await response.json();
          setAvailableClients(data.clients);
          // Set default to first client
          if (data.clients.length > 0) {
            setSelectedClientId(data.clients[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch client configurations:', error);
      }
    };

    fetchClients();
  }, []);

  const handleStartClient = async () => {
    setIsStartingClient(true);
    try {
      const response = await fetch('http://localhost:3001/api/client/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId })
      });
      const data = await response.json();
      if (data.success) {
        setClientStatus('starting');
      }
    } catch (error) {
      console.error('Failed to start client:', error);
      setClientStatus('error');
    } finally {
      setIsStartingClient(false);
    }
  };

  const handleStopClient = async () => {
    try {
      await fetch('http://localhost:3001/api/client/stop', {
        method: 'POST'
      });
      setClientStatus('stopped');
    } catch (error) {
      console.error('Failed to stop client:', error);
    }
  };

  const activeRuns = runs.filter(r => r.state === TaskState.RUNNING || r.state === TaskState.PENDING || r.state === TaskState.RETRYING);

  // Get all history runs (before filtering)
  const allHistoryRuns = runs.filter(r => r.state !== TaskState.RUNNING && r.state !== TaskState.PENDING && r.state !== TaskState.RETRYING);

  // Apply filters to history runs
  let historyRuns = [...allHistoryRuns];

  // Filter by status
  if (statusFilter !== 'all') {
    historyRuns = historyRuns.filter(r => r.state === statusFilter);
  }

  // Filter by flow name
  if (flowNameFilter !== 'all') {
    historyRuns = historyRuns.filter(r => r.flowName === flowNameFilter);
  }

  // Filter by search query (searches in flow name and run ID)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    historyRuns = historyRuns.filter(r =>
      r.flowName.toLowerCase().includes(query) ||
      r.id.toLowerCase().includes(query)
    );
  }

  // Filter by date
  if (dateFilter !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    historyRuns = historyRuns.filter(r => {
      const runDate = new Date(r.startTime);
      if (dateFilter === 'today') {
        return runDate >= today;
      } else if (dateFilter === 'week') {
        return runDate >= weekAgo;
      } else if (dateFilter === 'month') {
        return runDate >= monthAgo;
      }
      return true;
    });
  }

  // Get unique flow names for the flow name filter dropdown
  const uniqueFlowNames = Array.from(new Set(runs.map(r => r.flowName))).sort();

  const selectedHistoryRun = selectedHistoryRunId ? runs.find(r => r.id === selectedHistoryRunId) : null;

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
    setSelectedHistoryRunId(runId === selectedHistoryRunId ? null : runId);
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden text-slate-200 font-sans selection:bg-sky-500/30">
      
      {/* Top Navigation Bar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 h-16 flex-none px-6 flex items-center justify-between shadow-sm z-20 relative">
        <div className="flex items-center gap-3">
          <PerfectLogo />
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Perfect</h1>
          <span className="bg-sky-500/10 text-sky-400 text-[10px] px-2 py-0.5 rounded-full border border-sky-500/20 font-mono tracking-wide">v2.0</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            System Online
          </div>
          <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
            <Activity size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">

        {/* Live Monitoring Dashboard */}
        <div className="flex-1 flex flex-col bg-slate-900/30 relative">
          {/* Dashboard Header */}
           <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shadow-sm backdrop-blur-sm">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Activity size={14} className={activeRuns.length > 0 ? "text-sky-500 animate-pulse" : "text-slate-500"} /> 
              Live Monitor
              {activeRuns.length > 0 && (
                <span className="bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-sky-500/20 shadow-[0_0_10px_rgba(56,189,248,0.2)]">
                  {activeRuns.length} ACTIVE
                </span>
              )}
            </h2>
            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-slate-700 rounded-full animate-pulse"></span>
              Real-time feed
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {activeRuns.length === 0 ? (
              <div className="h-[70vh] flex flex-col items-center justify-center text-slate-600 space-y-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-sky-500/20 blur-xl rounded-full"></div>
                  <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 relative shadow-xl">
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
                        {availableClients.map(client => (
                          <button
                            key={client.id}
                            onClick={() => setSelectedClientId(client.id)}
                            disabled={clientStatus === 'running' || clientStatus === 'starting'}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              selectedClientId === client.id
                                ? 'border-sky-500 bg-sky-500/10 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                                : 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900'
                            } disabled:opacity-50 disabled:cursor-not-allowed group`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                selectedClientId === client.id
                                  ? 'border-sky-500 bg-sky-500'
                                  : 'border-slate-600 bg-slate-900'
                              }`}>
                                {selectedClientId === client.id && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className={`text-sm font-semibold mb-0.5 transition-colors ${
                                  selectedClientId === client.id ? 'text-sky-400' : 'text-slate-300 group-hover:text-slate-200'
                                }`}>
                                  {client.name}
                                </div>
                                <div className="text-xs text-slate-500 leading-relaxed">
                                  {client.description}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Display */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      clientStatus === 'running' ? 'bg-emerald-500 animate-pulse' :
                      clientStatus === 'starting' ? 'bg-amber-500 animate-pulse' :
                      clientStatus === 'error' ? 'bg-rose-500' :
                      'bg-slate-600'
                    }`}></div>
                    <span className="text-sm text-slate-400 font-mono">
                      Status: <span className={`uppercase font-bold ${
                        clientStatus === 'running' ? 'text-emerald-400' :
                        clientStatus === 'starting' ? 'text-amber-400' :
                        clientStatus === 'error' ? 'text-rose-400' :
                        'text-slate-500'
                      }`}>{clientStatus}</span>
                    </span>
                  </div>

                  {/* Action Buttons */}
                  {clientStatus === 'stopped' || clientStatus === 'error' ? (
                    <button
                      onClick={handleStartClient}
                      disabled={isStartingClient}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 text-white rounded-lg font-medium text-base transition-all shadow-lg hover:shadow-sky-500/30 disabled:text-slate-500 disabled:cursor-not-allowed active:scale-95"
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
                  <ActiveRunCard key={run.id} run={run} />
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
                     <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
                       {historyRuns.slice(0, showAllHistory ? historyRuns.length : 12).map(run => (
                         <div
                           key={run.id}
                           onClick={() => handleHistoryClick(run.id)}
                           className={`bg-slate-800/40 p-3 rounded-lg border flex flex-col gap-2 hover:border-slate-600 transition-all cursor-pointer group ${
                             selectedHistoryRunId === run.id
                               ? 'border-sky-500 bg-sky-500/10 shadow-neon'
                               : 'border-slate-700/50'
                           }`}
                         >
                           <div className="flex justify-between items-center">
                             <span className="font-medium text-xs truncate text-slate-300 group-hover:text-sky-400 transition-colors" title={run.flowName}>{run.flowName}</span>
                             <StatusIcon state={run.state} size={14} />
                           </div>
                           <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                             <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{run.id.split('-')[1]}</span>
                             <span>{new Date(run.startTime).toLocaleTimeString()}</span>
                           </div>
                         </div>
                       ))}
                     </div>

                     {/* Show All / Show Less Button */}
                     {historyRuns.length > 12 && (
                       <div className="flex justify-center mt-4">
                         <button
                           onClick={() => setShowAllHistory(!showAllHistory)}
                           className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-xs font-medium text-slate-400 hover:text-sky-400 hover:border-sky-500/50 hover:bg-sky-500/5 transition-all shadow-sm group"
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

                 {/* Selected History Detail */}
                 {selectedHistoryRun && (
                   <div className="mt-6">
                     <div className="flex items-center justify-between mb-4">
                       <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <Terminal size={14} /> Flow Details
                       </h4>
                       <button
                         onClick={() => setSelectedHistoryRunId(null)}
                         className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                       >
                         Close
                       </button>
                     </div>
                     <ActiveRunCard run={selectedHistoryRun} />
                   </div>
                 )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
