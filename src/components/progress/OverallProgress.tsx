import React from 'react';
import { Activity, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { FlowRun, TaskState } from '../../types';
import { useAnimatedProgress } from '../../hooks/useAnimatedProgress';
import { calculateOverallProgress } from '../../utils/progressUtils';

interface OverallProgressProps {
  flowCount: number;
  activeRuns: FlowRun[];
  themeColor: string;
}

export const OverallProgress: React.FC<OverallProgressProps> = ({
  flowCount,
  activeRuns,
  themeColor
}) => {
  const completedCount = activeRuns.filter(r => r.state === TaskState.COMPLETED).length;
  const failedCount = activeRuns.filter(r => r.state === TaskState.FAILED).length;
  const isFinished = activeRuns.length > 0 && completedCount + failedCount === activeRuns.length;

  const { localProgress, countdownRef } = useAnimatedProgress(
    () => calculateOverallProgress(activeRuns),
    !isFinished,
    { countdownSuffix: 'remaining', inactiveProgress: isFinished ? 100 : 0 }
  );

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
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                <Activity
                  size={16}
                  className={isFinished ? '' : 'animate-pulse'}
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
              {isFinished && (
                <>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                  >
                    <CheckCircle2 size={12} />
                    {completedCount} completed
                  </span>
                  {failedCount > 0 && (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-rose-500/15 text-rose-300 border-rose-500/40"
                    >
                      <XCircle size={12} />
                      {failedCount} failed
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              {!isFinished && (
                <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                  <Clock size={14} className="text-slate-400" />
                  <span ref={countdownRef} />
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
            {/* Animated shimmer effect - only while flows are running */}
            {!isFinished && (() => {
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
