// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useModalAnimation } from './useModalAnimation';

// vi.useRealTimers() inside afterEach causes a vitest hook "timeout" in the
// happy-dom environment. Fake-timer setup/teardown is inlined per test instead.

describe('useModalAnimation', () => {
  it('isOpening is true immediately on mount before rAF fires', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { result } = renderHook(() => useModalAnimation(onClose));
      expect(result.current.isOpening).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('isOpening becomes false after rAF fires', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { result } = renderHook(() => useModalAnimation(onClose));
      act(() => {
        vi.runAllTimers();
      });
      expect(result.current.isOpening).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('isClosing starts as false', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { result } = renderHook(() => useModalAnimation(onClose));
      expect(result.current.isClosing).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('handleClose sets isClosing to true', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { result } = renderHook(() => useModalAnimation(onClose));
      act(() => {
        result.current.handleClose();
      });
      expect(result.current.isClosing).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('handleClose calls onClose after default durationMs (200ms)', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { result } = renderHook(() => useModalAnimation(onClose));
      act(() => {
        result.current.handleClose();
      });
      expect(onClose).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls onClose after custom durationMs (100ms), not before', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { result } = renderHook(() => useModalAnimation(onClose, 100));
      act(() => {
        result.current.handleClose();
      });
      act(() => {
        vi.advanceTimersByTime(99);
      });
      expect(onClose).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cleanup on unmount does not throw', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { unmount } = renderHook(() => useModalAnimation(onClose));
      expect(() => unmount()).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});
