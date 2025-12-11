import React, { useEffect, useRef } from 'react';
import { TaskState, TaskRun } from '../types';
import { StatusIcon } from './StatusComponents';

interface TaskRowProps {
  task: TaskRun;
}

export const TaskRow: React.FC<TaskRowProps> = ({ task }) => {
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
              {task.performanceWarning && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-md border font-semibold flex items-center gap-1 ${
                    task.performanceWarning.severity === 'critical'
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  } ${isRunning ? 'animate-pulse' : ''}`}
                  title={task.performanceWarning.message}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {task.performanceWarning.severity === 'critical' ? 'CRITICAL' : 'SLOW'}
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
      {task.result && (task.state === TaskState.COMPLETED || task.state === TaskState.FAILED) && (
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

      {/* Performance Warning Details */}
      {task.performanceWarning && (
        <div className="mx-4 mb-3">
          <div className={`p-2.5 rounded-lg border text-sm ${
            task.performanceWarning.severity === 'critical'
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">
                {task.performanceWarning.severity === 'critical' ? 'Critical Performance Issue' : 'Performance Warning'}
              </span>
              <span className="text-slate-300">•</span>
              <span className={task.performanceWarning.severity === 'critical' ? 'text-red-200' : 'text-amber-200'}>
                {task.performanceWarning.message}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
