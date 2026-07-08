import React, { useEffect, useRef, useState } from 'react';
import { Clock, ChevronLeft } from 'lucide-react';
import { FlowRun, TaskState } from '../types';
import { StatusBadge, PerformanceWarningBadge } from './StatusComponents';
import { TagBadges } from './TagBadges';
import { TaskRow } from './TaskRow';
import { useAnimatedProgress } from '../hooks/useAnimatedProgress';
import { calculateRunProgress } from '../utils/progressUtils';

interface ActiveRunCardProps {
  run: FlowRun;
  clientColor?: string;
}

export const ActiveRunCard: React.FC<ActiveRunCardProps> = ({ run, clientColor }) => {
  const flowLogsRef = useRef<HTMLDivElement>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const isRunning = run.state === TaskState.RUNNING || run.state === TaskState.PENDING || run.state === TaskState.RETRYING;

  const { localProgress, countdownRef } = useAnimatedProgress(
    () => calculateRunProgress(run),
    isRunning,
    { countdownSuffix: 'left', inactiveProgress: run.progress }
  );

  // Check if any task has a performance warning
  const hasPerformanceWarning = run.tasks.some(task => task.performanceWarning);
  const hasCriticalWarning = run.tasks.some(task => task.performanceWarning?.severity === 'critical');

  useEffect(() => {
    if (isRunning && flowLogsRef.current) {
      flowLogsRef.current.scrollTop = flowLogsRef.current.scrollHeight;
    }
  }, [run.logs.length, isRunning]);

  // Create dynamic styles based on client color (more subtle)
  const glowColor = clientColor ? `${clientColor}20` : 'rgba(71, 85, 105, 0.15)'; // Reduced opacity
  const bgGradient = clientColor
    ? `linear-gradient(135deg, ${clientColor}05 0%, transparent 50%)`
    : 'rgba(30, 41, 59, 0.4)';

  return (
    <div
      className="backdrop-blur-md rounded-xl shadow-lg overflow-hidden flex flex-col transition-all group"
      style={{
        border: `1px solid ${clientColor ? `${clientColor}60` : '#475569'}`, // Thinner border, more transparent
        boxShadow: clientColor ? `0 0 20px ${glowColor}, 0 4px 20px rgba(0,0,0,0.3)` : '0 4px 20px rgba(0,0,0,0.3)',
        background: bgGradient,
        backgroundColor: 'rgba(30, 41, 59, 0.4)'
      }}
    >
      {/* Header */}
      <div
        className="p-3 border-b flex justify-between items-center"
        style={{
          borderBottomColor: clientColor ? `${clientColor}30` : '#475569',
          background: clientColor ? `${clientColor}08` : 'rgba(30, 41, 59, 0.3)'
        }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">{run.flowName}</h3>
            <StatusBadge state={run.state} />
            {hasPerformanceWarning && (
              <PerformanceWarningBadge
                severity={hasCriticalWarning ? 'critical' : 'warning'}
                isRunning={isRunning}
              />
            )}
          </div>
          <TagBadges tags={run.tags} />
        </div>
        <div className="text-right">
           <div className="flex flex-col items-end gap-2">
             <span className={`text-2xl font-bold font-mono tracking-tight ${run.state === TaskState.FAILED ? 'text-rose-400' : 'text-sky-400'}`}>
               {Math.floor(localProgress)}%
             </span>
             {isRunning && (
               <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                 <Clock size={12} className="text-slate-400" />
                 <span ref={countdownRef} />
               </div>
             )}
             {!isRunning && run.reportPath && (
               <a
                 href={`http://localhost:3000/${run.reportPath}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all hover:scale-105 active:scale-95 shadow-sm"
                 style={{
                   backgroundColor: clientColor ? `${clientColor}15` : 'rgba(56, 189, 248, 0.1)',
                   borderColor: clientColor || '#38bdf8',
                   color: clientColor || '#38bdf8'
                 }}
               >
                 Open Report
               </a>
             )}
           </div>
        </div>
      </div>

      {/* Smooth Progress Bar */}
      <div className="h-1 bg-slate-800 w-full relative">
        <div
          className="h-full relative"
          style={{
            width: `${localProgress}%`,
            background: run.state === TaskState.FAILED
              ? '#ef4444' // rose-500
              : clientColor
                ? `linear-gradient(90deg, ${clientColor} 0%, ${clientColor}cc 100%)`
                : 'linear-gradient(90deg, #0ea5e9 0%, #6366f1 100%)' // sky-500 to indigo-500
          }}
        >
          {run.state === TaskState.RUNNING && (
            <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 blur-sm"></div>
          )}
        </div>
      </div>

      {/* Tasks and Logs Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tasks List */}
        <div className={`flex-1 overflow-y-auto max-h-[260px] custom-scrollbar bg-slate-900/20 ${run.logs && run.logs.length > 0 ? 'border-r border-slate-700/50' : ''}`}>
          {run.tasks.map(task => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>

        {/* Flow Logs - Right Side (Collapsible) */}
        {run.logs && run.logs.length > 0 && (
          <div className="flex relative">
            {/* Toggle Button - Small circle */}
            <button
              onClick={() => setLogsExpanded(!logsExpanded)}
              className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors z-10 shadow-md border border-slate-600"
              title={logsExpanded ? "Collapse logs" : `Expand logs (${run.logs.length})`}
            >
              <ChevronLeft
                size={10}
                className={`text-slate-300 transition-transform duration-200 ${logsExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Logs Panel */}
            <div
              ref={flowLogsRef}
              className={`bg-slate-950/70 text-xs font-mono max-h-[260px] overflow-y-auto custom-scrollbar border-l border-slate-700/50 transition-all duration-200 ease-out ${
                logsExpanded ? 'w-64 p-2 opacity-100' : 'w-0 p-0 opacity-0 overflow-hidden'
              }`}
            >
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-2 font-semibold whitespace-nowrap">Logs ({run.logs.length})</div>
              {run.logs.map((log, i) => (
                <div key={i} className="text-slate-300 py-1 px-1.5 mb-1 bg-slate-800/50 rounded border-l-2 border-slate-600 break-words">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
