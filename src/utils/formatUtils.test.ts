import { describe, it, expect } from 'vitest';
import { formatTimeRemaining, formatDuration } from './formatUtils';

describe('formatTimeRemaining', () => {
  it('formats sub-1000ms as ms', () => {
    expect(formatTimeRemaining(500)).toBe('500ms');
    expect(formatTimeRemaining(0)).toBe('0ms');
    expect(formatTimeRemaining(999)).toBe('999ms');
  });

  it('formats exactly 1000ms as seconds', () => {
    expect(formatTimeRemaining(1000)).toBe('1.0s');
  });

  it('formats seconds range correctly', () => {
    expect(formatTimeRemaining(59900)).toBe('59.9s');
    expect(formatTimeRemaining(2500)).toBe('2.5s');
  });

  it('formats exactly 60000ms as "1m 0s" (not "0m 60s")', () => {
    expect(formatTimeRemaining(60000)).toBe('1m 0s');
  });

  it('formats 90000ms correctly', () => {
    expect(formatTimeRemaining(90000)).toBe('1m 30s');
  });

  it('uses Math.floor to prevent "1m 60s" at minute boundary', () => {
    // 119500ms: minutes=1, seconds=floor(59500/1000)=59 (not round=60)
    expect(formatTimeRemaining(119500)).toBe('1m 59s');
  });

  it('formats 60 minutes', () => {
    expect(formatTimeRemaining(3600000)).toBe('60m 0s');
  });
});

describe('formatDuration', () => {
  it('formats sub-1000ms', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds with 2 decimal places', () => {
    expect(formatDuration(2500)).toBe('2.50s');
    expect(formatDuration(1000)).toBe('1.00s');
  });

  it('formats minutes with 2 decimal places', () => {
    expect(formatDuration(90000)).toBe('1.50m');
  });

  it('formats hours with 2 decimal places', () => {
    expect(formatDuration(3600000)).toBe('1.00h');
  });
});
