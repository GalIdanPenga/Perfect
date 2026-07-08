import { useState, useEffect, useRef } from 'react';

export function useModalAnimation(onClose: () => void, durationMs = 200) {
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => {
      setIsOpening(false);
    });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function handleClose() {
    setIsClosing(true);
    setTimeout(onClose, durationMs);
  }

  return { isClosing, isOpening, handleClose };
}
