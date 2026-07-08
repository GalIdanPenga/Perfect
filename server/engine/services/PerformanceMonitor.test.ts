import { describe, it, expect } from 'vitest'
import { PerformanceMonitor } from './PerformanceMonitor'

// ---------------------------------------------------------------------------
// PerformanceMonitor.detectOutlier
//
// Threshold reference (zScore must be STRICTLY GREATER THAN threshold):
//   conservative: lowSamples=7.0 (n<20), highSamples=5.0 (n>=20)
//   normal:       lowSamples=5.0 (n<20), highSamples=3.3 (n>=20)
//   aggressive:   lowSamples=3.0 (n<20), highSamples=2.5 (n>=20)
//
// minSamples=2: sampleCount < 2 → null
// sampleThreshold=20: n < 20 uses lowSamples, n >= 20 uses highSamples
// ---------------------------------------------------------------------------

describe('PerformanceMonitor.detectOutlier', () => {
  const monitor = new PerformanceMonitor()

  // ---- Early-exit guards ---------------------------------------------------

  it('returns null when sampleCount < 2 (minSamples guard)', () => {
    expect(monitor.detectOutlier(2000, 1000, 100, 1)).toBeNull()
  })

  it('returns null when stdDevMs === 0 (prevents division by zero)', () => {
    expect(monitor.detectOutlier(2000, 1000, 0, 5)).toBeNull()
  })

  it('returns null when actual is faster than average (diff <= 0)', () => {
    expect(monitor.detectOutlier(800, 1000, 100, 5)).toBeNull()
  })

  it('returns null when actual exactly equals average', () => {
    expect(monitor.detectOutlier(1000, 1000, 100, 5)).toBeNull()
  })

  // ---- Within-threshold (no warning) --------------------------------------

  it('returns null when overage is below the normal threshold (zScore=2.0 < 5.0)', () => {
    // avg=1000, stdDev=100, actual=1200 → diff=200, zScore=2.0
    // normal + sampleCount=5 (low) → threshold=5.0; 2.0 < 5.0 → null
    expect(monitor.detectOutlier(1200, 1000, 100, 5, 'normal')).toBeNull()
  })

  // ---- Outlier detected (warning) -----------------------------------------

  it('returns a warning for a large overage under normal sensitivity (zScore=6.0 > 5.0)', () => {
    // avg=1000, stdDev=100, actual=1600 → diff=600, zScore=6.0
    // normal + sampleCount=5 (low) → threshold=5.0; 6.0 > 5.0 → warning
    const result = monitor.detectOutlier(1600, 1000, 100, 5, 'normal')
    expect(result).not.toBeNull()
  })

  it('returns a warning when sampleCount >= 20 (uses highSamples=3.3; zScore=4.0 > 3.3)', () => {
    // avg=1000, stdDev=100, actual=1400 → diff=400, zScore=4.0
    // normal + sampleCount=25 (>=20) → threshold=3.3; 4.0 > 3.3 → warning
    const result = monitor.detectOutlier(1400, 1000, 100, 25, 'normal')
    expect(result).not.toBeNull()
  })

  // ---- Sensitivity levels --------------------------------------------------

  it('conservative sensitivity: zScore=6.0 < 7.0 → null', () => {
    // avg=1000, stdDev=100, actual=1600 → zScore=6.0
    // conservative + sampleCount=5 (low) → threshold=7.0; 6.0 < 7.0 → null
    expect(monitor.detectOutlier(1600, 1000, 100, 5, 'conservative')).toBeNull()
  })

  it('aggressive sensitivity: zScore=3.5 > 3.0 → warning', () => {
    // avg=1000, stdDev=100, actual=1350 → diff=350, zScore=3.5
    // aggressive + sampleCount=5 (low) → threshold=3.0; 3.5 > 3.0 → warning
    const result = monitor.detectOutlier(1350, 1000, 100, 5, 'aggressive')
    expect(result).not.toBeNull()
  })

  // ---- Warning shape -------------------------------------------------------

  it('returned warning has type="slow" and severity="warning"', () => {
    // avg=1000, stdDev=100, actual=1600, normal, n=5 → warning
    const result = monitor.detectOutlier(1600, 1000, 100, 5, 'normal')
    expect(result).toMatchObject({ type: 'slow', severity: 'warning' })
  })

  it('warning message contains the actual duration in seconds and the avg in seconds', () => {
    // actual=1600ms → "1.6s", avg=1000ms → "1.0s avg"
    // full message: "1.6s (6.0σ from 1.0s avg, n=5)"
    const result = monitor.detectOutlier(1600, 1000, 100, 5, 'normal')
    expect(result).not.toBeNull()
    expect(result!.message).toContain('1.6s')
    expect(result!.message).toContain('1.0s')
  })
})
