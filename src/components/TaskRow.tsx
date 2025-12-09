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
            <div className={`text-sm font-medium flex items-center gap-2 ${task.state === TaskState.PENDING ? 'text-slate-300' : 'text-slate-100'}`}>
              {task.taskName}
              {isRunning && (
                <span className="text-xs bg-sky-500/20 text-sky-300 px-1.5 rounded-md border border-sky-500/30 font-mono">
                  {Math.floor(task.progress)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
              <span>W: {(task.weight * 100).toFixed(1)}%</span>
              <span className="text-slate-600">•</span>
              <span>EST: {task.estimatedTime}ms</span>
              {task.durationMs && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-300">TOOK: {task.durationMs}ms</span>
                </>
              )}
            </div>
          </div>
        </div>
        {task.state !== TaskState.PENDING && (
          <div className="text-xs text-slate-500 font-mono">
            {task.id.split('-')[1]}
          </div>
        )}
      </div>

      {/* Live Logs */}
      {(isRunning || task.state === TaskState.FAILED) && task.logs.length > 0 && (
        <div ref={logsRef} className="mx-4 mb-3 p-2.5 bg-slate-950/50 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 max-h-24 overflow-y-auto custom-scrollbar shadow-inner">
          {task.logs.slice(-5).map((log, i) => (
            <div key={i} className="truncate mb-0.5 opacity-90">{log}</div>
          ))}
        </div>
      )}

      {/* Task Result */}
      {task.result && task.state === TaskState.COMPLETED && (
        <div className="mx-4 mb-3">
          {/* Note Section */}
          {task.result.note && (
            <div className={`mb-2 p-2.5 rounded-lg border text-sm ${
              task.result.passed
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${task.result.passed ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className="font-medium">{task.result.passed ? 'PASSED' : 'FAILED'}</span>
                <span className="text-slate-300">•</span>
                <span>{task.result.note}</span>
              </div>
            </div>
          )}

          {/* Table Section */}
          {task.result.table && task.result.table.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700">
                    {Object.keys(task.result.table[0]).map((key) => (
                      <th key={key} className="text-left px-2 py-1.5 text-slate-300 font-semibold uppercase tracking-wider">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {task.result.table.map((row, i) => (
                    <tr key={i} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30">
                      {Object.values(row).map((value, j) => (
                        <td key={j} className="px-2 py-1.5 text-slate-200">
                          {typeof value === 'boolean' ? (
                            <span className={value ? 'text-emerald-400' : 'text-rose-400'}>
                              {value ? '✓' : '✗'}
                            </span>
                          ) : typeof value === 'number' ? (
                            <span className="text-sky-400">{value.toLocaleString()}</span>
                          ) : (
                            <span>{String(value)}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
