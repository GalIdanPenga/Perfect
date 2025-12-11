import { PerformanceWarning } from '../../types';

export type PerformanceSensitivity = 'conservative' | 'normal' | 'aggressive';

/**
 * PerformanceMonitor Service
 *
 * Handles performance outlier detection using statistical analysis.
 */
export class PerformanceMonitor {
  private readonly sensitivityThresholds = {
    conservative: { lowSamples: 7.0, highSamples: 5.0 },
    normal: { lowSamples: 5.0, highSamples: 3.3 },
    aggressive: { lowSamples: 3.0, highSamples: 2.5 },
  };
  private readonly minSamples = 2;
  private readonly sampleThreshold = 20;

  /**
   * Detect if a task duration is an outlier based on statistical analysis
   *
   * Uses z-score with sample-size-adjusted thresholds.
   * Only detects tasks that are SLOWER than expected (not faster).
   *
   * @param actualMs - Actual task duration in milliseconds
   * @param avgMs - Average duration from historical data
   * @param stdDevMs - Standard deviation from historical data
   * @param sampleCount - Number of historical samples
   * @param sensitivity - Sensitivity level for detection (default: 'normal')
   * @returns PerformanceWarning if outlier detected, null otherwise
   */
  detectOutlier(
    actualMs: number,
    avgMs: number,
    stdDevMs: number,
    sampleCount: number,
    sensitivity: PerformanceSensitivity = 'normal'
  ): PerformanceWarning | null {
    // Need at least minimum samples to calculate variance
    if (sampleCount < this.minSamples || stdDevMs === 0) {
      return null;
    }

    // Calculate difference (only care about slower tasks)
    const diff = actualMs - avgMs;

    // If task is faster or on-time, no warning needed
    if (diff <= 0) {
      return null;
    }

    // Calculate z-score: how many standard deviations SLOWER than mean
    const zScore = diff / stdDevMs;

    // Get threshold based on sensitivity level and sample count
    const thresholds = this.sensitivityThresholds[sensitivity];
    const threshold = sampleCount < this.sampleThreshold
      ? thresholds.lowSamples
      : thresholds.highSamples;

    if (zScore > threshold) {
      return {
        type: 'slow',
        severity: 'warning',
        message: `${(actualMs / 1000).toFixed(1)}s (${zScore.toFixed(1)}σ from ${(avgMs / 1000).toFixed(1)}s avg, n=${sampleCount})`
      };
    }

    return null;
  }
}
