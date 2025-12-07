import { useEffect, useRef } from 'react';
import { TaskState, TaskRun } from '../types';
import { StatusIcon } from './StatusComponents';

interface TaskRowProps {
  task: TaskRun;
}

export const TaskRow = ({ task }: TaskRowProps) => {
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
