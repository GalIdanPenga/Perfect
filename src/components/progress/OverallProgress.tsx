import React from 'react';
import { Activity, Clock } from 'lucide-react';

const formatTimeRemaining = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

interface OverallProgressProps {
  /**
   * Number of active flow runs
   */
  flowCount: number;

  /**
   * Overall progress percentage (0-100)
   */
  progress: number;

  /**
   * Total estimated time remaining in milliseconds
   */
  timeRemaining: number;

  /**
   * Theme color for the component (hex color)
   */
  themeColor: string;
}

/**
 * Overall Progress Display Component
 *
 * Displays a progress bar showing the combined progress of all active flows,
 * along with the number of flows and estimated time remaining.
 *
 * @example
 * ```tsx
 * <OverallProgress
 *   flowCount={3}
 *   progress={45}
 *   timeRemaining={120000}
 *   themeColor="#0ea5e9"
 * />
 * ```
 */
export const OverallProgress: React.FC<OverallProgressProps> = ({
  flowCount,
  progress,
  timeRemaining,
  themeColor
}) => {
  return (
    <div className="mb-6 mx-auto max-w-4xl">
      <div
        className="backdrop-blur-md rounded-xl shadow-lg overflow-hidden border-2 transition-all"
        style={{
          borderColor: `${themeColor}60`,
          boxShadow: `0 0 30px ${themeColor}20`,
          background: `linear-gradient(135deg, ${themeColor}08 0%, transparent 100%)`
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                <Activity
                  size={16}
                  className="animate-pulse"
                  style={{ color: themeColor }}
                />
                Overall Progress
              </div>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                style={{
                  backgroundColor: `${themeColor}15`,
                  color: themeColor,
                  borderColor: `${themeColor}40`
                }}
              >
                {flowCount} {flowCount === 1 ? 'Flow' : 'Flows'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {timeRemaining > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                  <Clock size={14} className="text-slate-400" />
                  <span>~{formatTimeRemaining(timeRemaining)} remaining</span>
                </div>
              )}
              <span
                className="text-3xl font-bold font-mono tracking-tight"
                style={{ color: themeColor }}
              >
                {progress}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-slate-900/60 rounded-full overflow-hidden border border-slate-700/50 relative">
            <div
              className="h-full transition-all duration-500 ease-out relative"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${themeColor} 0%, ${themeColor}cc 100%)`
              }}
            >
              {/* Animated shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
