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
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[state] || styles[TaskState.PENDING]} flex items-center gap-1.5 shadow-sm`}>
      {state === TaskState.RUNNING && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"/>}
      {state}
    </span>
  );
};
