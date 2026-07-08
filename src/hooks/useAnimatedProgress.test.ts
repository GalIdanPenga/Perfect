// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAnimatedProgress } from './useAnimatedProgress';

describe('useAnimatedProgress', () => {
  let rafCallback: FrameRequestCallback | null = null;
  let rafId = 0;

  beforeEach(() => {
    rafCallback = null;
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return ++rafId;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('localProgress is 0 when active is false (default inactiveProgress)', () => {
    const computeFn = vi.fn().mockReturnValue({ progress: 50, remainingMs: 1000 });
    const { result } = renderHook(() => useAnimatedProgress(computeFn, false));
    expect(result.current.localProgress).toBe(0);
  });

  it('localProgress equals custom inactiveProgress when active is false', () => {
    const computeFn = vi.fn().mockReturnValue({ progress: 50, remainingMs: 1000 });
    const { result } = renderHook(() =>
      useAnimatedProgress(computeFn, false, { inactiveProgress: 75 })
    );
    expect(result.current.localProgress).toBe(75);
  });

  it('localProgress updates to computeFn result after one rAF tick when active is true', () => {
    const computeFn = vi.fn().mockReturnValue({ progress: 50, remainingMs: 1000 });
    const { result } = renderHook(() => useAnimatedProgress(computeFn, true));
    act(() => {
      rafCallback?.(0);
    });
    expect(result.current.localProgress).toBe(50);
  });

  it('computeFn is called on rAF tick and localProgress reflects its progress value', () => {
    const computeFn = vi.fn().mockReturnValue({ progress: 50, remainingMs: 1000 });
    const { result } = renderHook(() => useAnimatedProgress(computeFn, true));
    // rAF is scheduled on mount but not yet fired
    expect(computeFn).not.toHaveBeenCalled();
    act(() => {
      rafCallback?.(0);
    });
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(result.current.localProgress).toBe(50);
  });

  it('localProgress reflects 0 when computeFn returns remainingMs=0', () => {
    const computeFn = vi.fn().mockReturnValue({ progress: 0, remainingMs: 0 });
    const { result } = renderHook(() => useAnimatedProgress(computeFn, true));
    act(() => {
      rafCallback?.(0);
    });
    expect(result.current.localProgress).toBe(0);
  });

  it('localProgress resets to inactiveProgress when active transitions from true to false', () => {
    const computeFn = vi.fn().mockReturnValue({ progress: 80, remainingMs: 500 });
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useAnimatedProgress(computeFn, active, { inactiveProgress: 10 }),
      { initialProps: { active: true } }
    );
    act(() => {
      rafCallback?.(0);
    });
    expect(result.current.localProgress).toBe(80);
    act(() => {
      rerender({ active: false });
    });
    expect(result.current.localProgress).toBe(10);
  });

  it('custom countdownSuffix does not affect localProgress updates', () => {
    const computeFn = vi.fn().mockReturnValue({ progress: 42, remainingMs: 500 });
    const { result } = renderHook(() =>
      useAnimatedProgress(computeFn, true, { countdownSuffix: 'remaining' })
    );
    act(() => {
      rafCallback?.(0);
    });
    expect(result.current.localProgress).toBe(42);
  });
});
