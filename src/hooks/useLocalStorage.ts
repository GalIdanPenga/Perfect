import { useState, useCallback } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | null) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return initialValue;
      return JSON.parse(item) as T;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | null) => {
      // Update React state regardless; persistence is best-effort (writes can throw
      // on quota-exceeded or in private-mode/SSR contexts).
      if (value === null) {
        setStoredValue(initialValue);
        try {
          localStorage.removeItem(key);
        } catch { /* ignore persistence failure */ }
      } else {
        setStoredValue(value);
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch { /* ignore persistence failure */ }
      }
    },
    [key, initialValue]
  );

  return [storedValue, setValue];
}
