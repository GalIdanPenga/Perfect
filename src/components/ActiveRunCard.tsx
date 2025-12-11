import React, { useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { FlowRun, TaskState } from '../types';
import { StatusBadge } from './StatusComponents';
import { TagBadges } from './TagBadges';
import { TaskRow } from './TaskRow';

interface ActiveRunCardProps {
  run: FlowRun;
  clientColor?: string;
}

export const ActiveRunCard: React.FC<ActiveRunCardProps> = ({ run, clientColor }) => {
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
              <span
                className={`text-xs px-2 py-0.5 rounded-md border font-semibold flex items-center gap-1 ${
                  hasCriticalWarning
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                } ${isRunning ? 'animate-pulse' : ''}`}
                title={hasCriticalWarning ? "Flow has critical performance issues" : "Flow has performance warnings"}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {hasCriticalWarning ? 'CRITICAL' : 'SLOW'}
              </span>
            )}
          </div>
          <TagBadges tags={run.tags} />
        </div>
        <div className="text-right">
           <div className="flex flex-col items-end gap-2">
             <span className={`text-2xl font-bold font-mono tracking-tight ${run.state === TaskState.FAILED ? 'text-rose-400' : 'text-sky-400'}`}>
               {run.progress}%
             </span>
             {isRunning && timeRemaining > 0 && (
               <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                 <Clock size={12} className="text-slate-400" />
                 <span>~{formatTimeRemaining(timeRemaining)} left</span>
               </div>
             )}
             {!isRunning && run.reportPath && (
               <a
                 href={`http://localhost:3001/${run.reportPath}`}
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
          className="h-full transition-all duration-300 ease-out relative"
          style={{
            width: `${run.progress}%`,
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

      {/* Flow Logs */}
      {run.logs && run.logs.length > 0 && (
        <div ref={flowLogsRef} className="mx-3 mt-2 p-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs font-mono max-h-20 overflow-y-auto custom-scrollbar shadow-inner">
          {run.logs.map((log, i) => (
            <div key={i} className="text-slate-200 mb-0.5 leading-relaxed">
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto max-h-[260px] custom-scrollbar bg-slate-900/20">
        {run.tasks.map(task => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
};
