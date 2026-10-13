import { PerformanceWarning } from '../../types';

export type PerformanceSensitivity = 'conservative' | 'normal' | 'aggressive';

/**
 * PerformanceMonitor Service
 *
 * Handles performance outlier detection using statistical analysis.
 */
/** Default minimum overage, in ms, before any task can be flagged slow. */
export const DEFAULT_MIN_OVERAGE_MS = 1000;

export class PerformanceMonitor {
  private readonly sensitivityThresholds = {
    conservative: { lowSamples: 7.0, highSamples: 5.0 },
    normal: { lowSamples: 5.0, highSamples: 3.3 },
    aggressive: { lowSamples: 3.0, highSamples: 2.5 },
  };
  private readonly minSamples = 2;
  private readonly sampleThreshold = 20;

  // Noise floor for the standard deviation. With only a few samples of a
  // deterministic task, the measured deviation can be a couple of
  // milliseconds, and then ordinary jitter shows up as many sigma. The
  // deviation used for the z-score is never smaller than these floors, so a
  // task must be meaningfully slower than its average before it can warn.
  private readonly minStdDevRatio = 0.10;   // 10% of the average duration
  private readonly minStdDevMs = 100;       // absolute floor for very short tasks

  // Absolute gate. A task must be over its sigma threshold AND at least this
  // many milliseconds slower than its average. This keeps short tasks from
  // warning over overages nobody would notice, however many sigma they are.
  private readonly minOverageMs: number;

  constructor(options: { minOverageMs?: number } = {}) {
    const minOverageMs = options.minOverageMs ?? DEFAULT_MIN_OVERAGE_MS;
    if (minOverageMs < 0) {
      throw new Error(`minOverageMs must be >= 0, got ${minOverageMs}`);
    }
    this.minOverageMs = minOverageMs;
  }

  /**
   * Detect if a task duration is an outlier based on statistical analysis
   *
   * Uses z-score with sample-size-adjusted thresholds, plus an absolute
   * minimum overage. Both must be exceeded.
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
    if (sampleCount < this.minSamples) {
      return null;
    }

    // Calculate difference (only care about slower tasks)
    const diff = actualMs - avgMs;

    // If task is faster or on-time, no warning needed
    if (diff <= 0) {
      return null;
    }

    // Absolute gate: small overages are never worth a warning
    if (diff < this.minOverageMs) {
      return null;
    }

    // Calculate z-score: how many standard deviations SLOWER than mean,
    // using a deviation that is never below the noise floor.
    const effectiveStdDevMs = this.effectiveStdDev(avgMs, stdDevMs);
    const zScore = diff / effectiveStdDevMs;

    // Get threshold based on sensitivity level and sample count
    const thresholds = this.sensitivityThresholds[sensitivity];
    const threshold = sampleCount < this.sampleThreshold
      ? thresholds.lowSamples
      : thresholds.highSamples;

    if (zScore > threshold) {
      const percentSlower = avgMs > 0 ? Math.round((diff / avgMs) * 100) : 0;
      return {
        type: 'slow',
        severity: 'warning',
        message: `${(actualMs / 1000).toFixed(1)}s (+${percentSlower}%, ${zScore.toFixed(1)}σ from ${(avgMs / 1000).toFixed(1)}s avg, n=${sampleCount})`
      };
    }

    return null;
  }

  /**
   * The standard deviation used for scoring: the measured one, but never
   * below 10% of the average or 100ms, whichever is larger.
   */
  effectiveStdDev(avgMs: number, stdDevMs: number): number {
    return Math.max(stdDevMs, avgMs * this.minStdDevRatio, this.minStdDevMs);
  }
}
