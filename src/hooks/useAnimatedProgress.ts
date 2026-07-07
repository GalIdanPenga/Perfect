import React, { useEffect, useRef, useState } from 'react';
import { formatTimeRemaining } from '../utils/formatUtils';

interface Options {
  countdownSuffix?: string;
  inactiveProgress?: number;
}

export function useAnimatedProgress(
  computeFn: () => { progress: number; remainingMs: number },
  active: boolean,
  options?: Options
): { localProgress: number; countdownRef: React.RefObject<HTMLSpanElement> } {
  const [localProgress, setLocalProgress] = useState(0);
  const countdownRef = useRef<HTMLSpanElement>(null);
  const computeRef = useRef(computeFn);
  computeRef.current = computeFn;

  const suffix = options?.countdownSuffix ?? 'left';
  const inactiveProgress = options?.inactiveProgress ?? 0;

  useEffect(() => {
    if (!active) {
      if (countdownRef.current) countdownRef.current.textContent = '';
      return;
    }
    let id: number;
    const tick = () => {
      const { progress, remainingMs } = computeRef.current();
      setLocalProgress(progress);
      if (countdownRef.current) {
        countdownRef.current.textContent =
          remainingMs > 0 ? `~${formatTimeRemaining(remainingMs)} ${suffix}` : '';
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, suffix]);

  useEffect(() => {
    if (!active) setLocalProgress(inactiveProgress);
  }, [active, inactiveProgress]);

  return { localProgress, countdownRef };
}
