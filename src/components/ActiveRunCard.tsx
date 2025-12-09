import { useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { FlowRun, TaskState } from '../types';
import { StatusBadge } from './StatusComponents';
import { TagBadges } from './TagBadges';
import { TaskRow } from './TaskRow';

interface ActiveRunCardProps {
  run: FlowRun;
  clientColor?: string;
}

export const ActiveRunCard = ({ run, clientColor }: ActiveRunCardProps) => {
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
        className="p-4 border-b flex justify-between items-center"
        style={{
          borderBottomColor: clientColor ? `${clientColor}30` : '#475569',
          background: clientColor ? `${clientColor}08` : 'rgba(30, 41, 59, 0.3)'
        }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">{run.flowName}</h3>
            <StatusBadge state={run.state} />
          </div>
          <TagBadges tags={run.tags} />
        </div>
        <div className="text-right">
           <div className="flex flex-col items-end gap-1">
             <span className={`text-2xl font-bold font-mono tracking-tight ${run.state === TaskState.FAILED ? 'text-rose-400' : 'text-sky-400'}`}>
               {run.progress}%
             </span>
             {isRunning && timeRemaining > 0 && (
               <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                 <Clock size={12} className="text-slate-400" />
                 <span>~{formatTimeRemaining(timeRemaining)} left</span>
               </div>
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
        <div ref={flowLogsRef} className="mx-4 mt-3 p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs font-mono max-h-24 overflow-y-auto custom-scrollbar shadow-inner">
          {run.logs.map((log, i) => (
            <div key={i} className="text-slate-200 mb-0.5 leading-relaxed">
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
