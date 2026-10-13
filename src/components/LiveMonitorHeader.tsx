import { Activity, BarChart3 } from 'lucide-react';
import { WorkerConfig } from '../types';

interface LiveMonitorHeaderProps {
  themeColor: string;
  runningFlowsCount: number;
  activeWorker: WorkerConfig | null;
  onShowStatistics: () => void;
}

/** Dashboard header bar: live-monitor title, active badges, and Statistics button. */
export function LiveMonitorHeader({ themeColor, runningFlowsCount, activeWorker, onShowStatistics }: LiveMonitorHeaderProps) {
  return (
    <div
      className="p-3 border-b flex justify-between items-center shadow-sm backdrop-blur-sm transition-all duration-700"
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
          style={{ color: runningFlowsCount > 0 ? themeColor : '#64748b' }}
        />
        Live Monitor
        {runningFlowsCount > 0 && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold border transition-all duration-700"
            style={{
              backgroundColor: `${themeColor}15`,
              color: themeColor,
              borderColor: `${themeColor}40`,
              boxShadow: `0 0 15px ${themeColor}25`
            }}
          >
            {runningFlowsCount} ACTIVE
          </span>
        )}
        {/* Active Worker Indicator */}
        {activeWorker && activeWorker.color && (
          <span
            className="px-2.5 py-1 rounded-md text-xs font-bold border-2 flex items-center gap-1.5 transition-all duration-700"
            style={{
              backgroundColor: `${activeWorker.color}18`,
              borderColor: activeWorker.color,
              color: activeWorker.color,
              boxShadow: `0 0 20px ${activeWorker.color}40`
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: activeWorker.color }}
            ></div>
            {activeWorker.name}
          </span>
        )}
      </h2>
      <div className="flex items-center gap-3">
        <button
          onClick={onShowStatistics}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200 hover:border-sky-500/50"
          style={{
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <BarChart3 size={14} />
          Statistics
        </button>
        <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-700"
            style={{ backgroundColor: themeColor }}
          ></span>
          Real-time feed
        </div>
      </div>
    </div>
  );
}
