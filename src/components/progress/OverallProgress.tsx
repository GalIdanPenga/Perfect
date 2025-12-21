import React, { useEffect, useState } from 'react';
import { Activity, Clock } from 'lucide-react';
import { FlowRun, TaskState } from '../../types';

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
   * Active flow runs for smooth progress calculation
   */
  activeRuns: FlowRun[];

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
 * Calculate smooth progress for a single flow run
 */
const calculateFlowProgress = (run: FlowRun): number => {
  let totalWeightedProgress = 0;

  for (const task of run.tasks) {
    if (task.state === TaskState.COMPLETED || task.state === TaskState.FAILED) {
      totalWeightedProgress += task.weight * 100;
    } else if ((task.state === TaskState.RUNNING || task.state === TaskState.RETRYING) && task.startTime) {
      const elapsedMs = Date.now() - new Date(task.startTime).getTime();
      const taskProgress = Math.min(99, (elapsedMs / task.estimatedTime) * 100);
      totalWeightedProgress += task.weight * taskProgress;
    }
  }

  return Math.min(99, totalWeightedProgress);
};

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
 *   activeRuns={runs}
 *   timeRemaining={120000}
 *   themeColor="#0ea5e9"
 * />
 * ```
 */
export const OverallProgress: React.FC<OverallProgressProps> = ({
  flowCount,
  activeRuns,
  timeRemaining,
  themeColor
}) => {
  const [localProgress, setLocalProgress] = useState(0);

  // Calculate overall progress locally for smooth updates
  useEffect(() => {
    if (activeRuns.length === 0) {
      setLocalProgress(0);
      return;
    }

    let animationFrameId: number;

    const updateProgress = () => {
      const totalProgress = activeRuns.reduce((sum, run) => sum + calculateFlowProgress(run), 0);
      const avgProgress = totalProgress / activeRuns.length;
      setLocalProgress(avgProgress);
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    animationFrameId = requestAnimationFrame(updateProgress);

    return () => cancelAnimationFrame(animationFrameId);
  }, [activeRuns]);

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
                {Math.floor(localProgress)}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-slate-900/60 rounded-full overflow-hidden border border-slate-700/50 relative">
            <div
              className="h-full"
              style={{
                width: `${localProgress}%`,
                background: `linear-gradient(90deg, ${themeColor} 0%, ${themeColor}cc 100%)`
              }}
            />
            {/* Animated shimmer effect */}
            {(() => {
              const shimmerWidth = Math.max(10, localProgress * 0.5);
              // Keep constant visual speed: duration based on container width / shimmer width
              // translateX(1000%) means shimmer travels 10x its own width
              // To maintain constant speed, we need same time to cross 100% of container
              const duration = 3;
              return (
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  style={{
                    width: `${shimmerWidth}%`,
                    animation: `shimmer ${duration}s infinite linear`,
                    animationTimingFunction: 'linear'
                  }}
                />
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
