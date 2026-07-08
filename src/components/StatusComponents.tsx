import { CheckCircle, XCircle, RotateCw } from 'lucide-react';
import { TaskState } from '../types';

interface StatusIconProps {
  state: TaskState;
  size?: number;
}

export const StatusIcon = ({ state, size = 16 }: StatusIconProps) => {
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

interface PerformanceWarningBadgeProps {
  severity: 'warning' | 'critical';
  isRunning?: boolean;
  size?: 'sm' | 'md';
}

export const PerformanceWarningBadge = ({ severity, isRunning = false, size = 'sm' }: PerformanceWarningBadgeProps) => {
  const isCritical = severity === 'critical';
  const colorClasses = isCritical
    ? 'bg-red-500/20 text-red-300 border-red-500/40'
    : 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-md border font-semibold flex items-center gap-1 ${colorClasses} ${isRunning ? 'animate-pulse' : ''}`}
      title={isCritical ? 'Critical performance issue' : 'Performance warning'}
    >
      <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      {isCritical ? 'CRITICAL' : 'SLOW'}
    </span>
  );
};

interface StatusBadgeProps {
  state: TaskState;
}

export const StatusBadge = ({ state }: StatusBadgeProps) => {
  const styles = {
    [TaskState.COMPLETED]: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    [TaskState.FAILED]: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    [TaskState.RUNNING]: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    [TaskState.PENDING]: "bg-slate-700/30 text-slate-400 border-slate-700/50",
    [TaskState.RETRYING]: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${styles[state] || styles[TaskState.PENDING]} flex items-center gap-1.5 shadow-sm`}>
      {state === TaskState.RUNNING && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"/>}
      {state}
    </span>
  );
};
