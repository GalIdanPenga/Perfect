import { describe, it, expect } from 'vitest'
import { PerformanceMonitor, DEFAULT_MIN_OVERAGE_MS, isValidMinOverageMs, isValidSensitivity } from './PerformanceMonitor'

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
//
// Noise floor: the stdDev used for the z-score is
//   max(stdDev, 10% of avg, 100ms)
// so a handful of near-identical samples can't turn jitter into many sigma.
// Every existing case below uses avg=1000, stdDev=100, where the floor equals
// the measured stdDev and changes nothing.
//
// Absolute gate: diff must also be >= minOverageMs (default 1000ms). The
// sigma cases below pass minOverageMs=0 through `detect` so they test the
// z-score alone; the gate has its own section.
// ---------------------------------------------------------------------------

describe('PerformanceMonitor.detectOutlier', () => {
  const monitor = new PerformanceMonitor()
  const detect = (actual: number, avg: number, sd: number, n: number, sens: any = 'normal') =>
    monitor.detectOutlier(actual, avg, sd, n, sens, 0)

  // ---- Early-exit guards ---------------------------------------------------

  it('returns null when sampleCount < 2 (minSamples guard)', () => {
    expect(detect(2000, 1000, 100, 1)).toBeNull()
  })

  it('still scores when stdDevMs === 0, using the noise floor instead of dividing by zero', () => {
    // avg=1000, stdDev=0 → floor=100; actual=2000 → diff=1000, zScore=10 > 5 → warning
    expect(detect(2000, 1000, 0, 5, 'normal')).not.toBeNull()
    // actual=1200 → diff=200, zScore=2.0 < 5 → null
    expect(detect(1200, 1000, 0, 5, 'normal')).toBeNull()
  })

  it('returns null when actual is faster than average (diff <= 0)', () => {
    expect(detect(800, 1000, 100, 5)).toBeNull()
  })

  it('returns null when actual exactly equals average', () => {
    expect(detect(1000, 1000, 100, 5)).toBeNull()
  })

  // ---- Within-threshold (no warning) --------------------------------------

  it('returns null when overage is below the normal threshold (zScore=2.0 < 5.0)', () => {
    // avg=1000, stdDev=100, actual=1200 → diff=200, zScore=2.0
    // normal + sampleCount=5 (low) → threshold=5.0; 2.0 < 5.0 → null
    expect(detect(1200, 1000, 100, 5, 'normal')).toBeNull()
  })

  // ---- Outlier detected (warning) -----------------------------------------

  it('returns a warning for a large overage under normal sensitivity (zScore=6.0 > 5.0)', () => {
    // avg=1000, stdDev=100, actual=1600 → diff=600, zScore=6.0
    // normal + sampleCount=5 (low) → threshold=5.0; 6.0 > 5.0 → warning
    const result = detect(1600, 1000, 100, 5, 'normal')
    expect(result).not.toBeNull()
  })

  it('returns a warning when sampleCount >= 20 (uses highSamples=3.3; zScore=4.0 > 3.3)', () => {
    // avg=1000, stdDev=100, actual=1400 → diff=400, zScore=4.0
    // normal + sampleCount=25 (>=20) → threshold=3.3; 4.0 > 3.3 → warning
    const result = detect(1400, 1000, 100, 25, 'normal')
    expect(result).not.toBeNull()
  })

  // ---- Sensitivity levels --------------------------------------------------

  it('conservative sensitivity: zScore=6.0 < 7.0 → null', () => {
    // avg=1000, stdDev=100, actual=1600 → zScore=6.0
    // conservative + sampleCount=5 (low) → threshold=7.0; 6.0 < 7.0 → null
    expect(detect(1600, 1000, 100, 5, 'conservative')).toBeNull()
  })

  it('aggressive sensitivity: zScore=3.5 > 3.0 → warning', () => {
    // avg=1000, stdDev=100, actual=1350 → diff=350, zScore=3.5
    // aggressive + sampleCount=5 (low) → threshold=3.0; 3.5 > 3.0 → warning
    const result = detect(1350, 1000, 100, 5, 'aggressive')
    expect(result).not.toBeNull()
  })

  // ---- Noise floor (false-positive guard) ---------------------------------

  it('does not flag ordinary jitter when the measured stdDev is tiny', () => {
    // Seen live: a 2.0s task with two samples 2ms apart was reported as 6.4σ slow.
    // avg=2000, stdDev=2 → floor=200; actual=2014 → diff=14, zScore=0.07 → null
    expect(detect(2014, 2000, 2, 2, 'normal')).toBeNull()
    expect(detect(2014, 2000, 2, 2, 'aggressive')).toBeNull()
  })

  it('still flags a genuinely slow run when the measured stdDev is tiny', () => {
    // avg=2000, stdDev=2 → floor=200; actual=3100 → diff=1100, zScore=5.5 > 5 → warning
    expect(detect(3100, 2000, 2, 2, 'normal')).not.toBeNull()
  })

  it('uses the relative floor (10% of avg) for long tasks', () => {
    // avg=60000, stdDev=50 → floor=6000; under normal n<20 warns above 5σ = 30s over
    expect(detect(89000, 60000, 50, 5, 'normal')).toBeNull()
    expect(detect(91000, 60000, 50, 5, 'normal')).not.toBeNull()
  })

  it('uses the absolute floor (100ms) for very short tasks', () => {
    // avg=50, stdDev=1 → floor=100 (10% of avg is only 5ms); under normal n<20 warns above 500ms over
    expect(detect(500, 50, 1, 5, 'normal')).toBeNull()
    expect(detect(600, 50, 1, 5, 'normal')).not.toBeNull()
  })

  it('leaves a wide measured stdDev untouched', () => {
    expect(monitor.effectiveStdDev(1000, 400)).toBe(400)
    expect(monitor.effectiveStdDev(1000, 100)).toBe(100)
    expect(monitor.effectiveStdDev(1000, 3)).toBe(100)
    expect(monitor.effectiveStdDev(5000, 3)).toBe(500)
    expect(monitor.effectiveStdDev(50, 0)).toBe(100)
  })

  // ---- Absolute gate (minOverageMs) ---------------------------------------

  describe('absolute overage gate', () => {
    it('defaults to 1000ms', () => {
      expect(DEFAULT_MIN_OVERAGE_MS).toBe(1000)
      // avg=1000, stdDev=100, actual=1600 → diff=600, zScore=6.0 > 5: sigma says slow
      expect(monitor.detectOutlier(1600, 1000, 100, 5, 'normal')).toBeNull()        // 600 < 1000 default
      expect(monitor.detectOutlier(2100, 1000, 100, 5, 'normal')).not.toBeNull()    // 1100 >= 1000
    })

    it('blocks a warning that clears the sigma threshold but not the absolute one', () => {
      // avg=50, stdDev=1 → floor=100; actual=600 → diff=550, zScore=5.5 > 5
      expect(monitor.detectOutlier(600, 50, 1, 5, 'normal', 1000)).toBeNull()
      expect(monitor.detectOutlier(600, 50, 1, 5, 'normal', 0)).not.toBeNull()
    })

    it('blocks a warning that clears the absolute threshold but not the sigma one', () => {
      // avg=60000, stdDev=50 → floor=6000; actual=62000 → diff=2000 >= 1000 but zScore=0.33 < 5
      expect(monitor.detectOutlier(62000, 60000, 50, 5, 'normal', 1000)).toBeNull()
    })

    it('warns only when both are exceeded', () => {
      // avg=2000, stdDev=2 → floor=200; threshold 5σ = 1000ms over
      expect(monitor.detectOutlier(2999, 2000, 2, 5, 'normal', 1000)).toBeNull()      // 999ms: fails absolute
      expect(monitor.detectOutlier(3001, 2000, 2, 5, 'normal', 1000)).not.toBeNull()  // 1001ms: both pass
    })

    it('treats the absolute threshold as inclusive', () => {
      // avg=1000, stdDev=100, actual=1600 → diff=600, zScore=6.0 > 5
      expect(monitor.detectOutlier(1600, 1000, 100, 5, 'normal', 600)).not.toBeNull()
      expect(monitor.detectOutlier(1600, 1000, 100, 5, 'normal', 601)).toBeNull()
    })

    it('is a per-call value', () => {
      expect(monitor.detectOutlier(1600, 1000, 100, 5, 'normal', 100)).not.toBeNull()
      expect(monitor.detectOutlier(1600, 1000, 100, 5, 'normal', 5000)).toBeNull()
    })
  })

  describe('sensitivity fallback', () => {
    it('treats an unknown sensitivity as normal instead of throwing', () => {
      // zScore=6.0: warns under normal (5.0) and aggressive (3.0), not conservative (7.0)
      expect(() => detect(1600, 1000, 100, 5, 'high')).not.toThrow()
      expect(detect(1600, 1000, 100, 5, 'high')).not.toBeNull()
      expect(detect(1400, 1000, 100, 5, 'high')).toBeNull()   // zScore=4.0 < 5.0 (normal), would pass aggressive
    })

    it('isValidSensitivity accepts only the three levels', () => {
      for (const ok of ['conservative', 'normal', 'aggressive']) expect(isValidSensitivity(ok)).toBe(true)
      for (const bad of ['high', 'Normal', '', undefined, null, 3]) expect(isValidSensitivity(bad)).toBe(false)
    })
  })

  describe('isValidMinOverageMs', () => {
    it('accepts finite numbers >= 0', () => {
      for (const ok of [0, 1, 500, 1000.5]) expect(isValidMinOverageMs(ok)).toBe(true)
    })
    it('rejects negatives, non-finite values and non-numbers', () => {
      for (const bad of [-1, NaN, Infinity, -Infinity, '1000', null, undefined, true, {}]) {
        expect(isValidMinOverageMs(bad)).toBe(false)
      }
    })
  })

  // ---- Warning shape -------------------------------------------------------

  it('returned warning has type="slow" and severity="warning"', () => {
    // avg=1000, stdDev=100, actual=1600, normal, n=5 → warning
    const result = detect(1600, 1000, 100, 5, 'normal')
    expect(result).toMatchObject({ type: 'slow', severity: 'warning' })
  })

  it('warning message contains the actual duration in seconds and the avg in seconds', () => {
    // actual=1600ms → "1.6s", avg=1000ms → "1.0s avg", 60% slower
    // full message: "1.6s (+60%, 6.0σ from 1.0s avg, n=5)"
    const result = detect(1600, 1000, 100, 5, 'normal')
    expect(result).not.toBeNull()
    expect(result!.message).toContain('1.6s')
    expect(result!.message).toContain('1.0s')
    expect(result!.message).toContain('+60%')
  })

  it('omits the percentage when the average is 0ms', () => {
    // avg=0, stdDev=0 → floor=100; actual=1500 → diff=1500, zScore=15 → warning
    const result = detect(1500, 0, 0, 5)
    expect(result).not.toBeNull()
    expect(result!.message).not.toContain('%')
    expect(result!.message).toContain('0.0s avg')
  })
})
