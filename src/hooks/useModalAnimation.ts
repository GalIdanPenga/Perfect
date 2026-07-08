import { useState, useEffect, useRef } from 'react';

export function useModalAnimation(onClose: () => void, durationMs = 200) {
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);
  const rafRef = useRef<number | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => {
      setIsOpening(false);
    });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function handleClose() {
    // Guard against double-invocation (e.g. rapid clicks) so onClose fires once.
    if (closeTimerRef.current !== null) return;
    setIsClosing(true);
    closeTimerRef.current = setTimeout(onClose, durationMs);
  }

  return { isClosing, isOpening, handleClose };
}
