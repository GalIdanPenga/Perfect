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
      if (value === null) {
        localStorage.removeItem(key);
        setStoredValue(initialValue);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        setStoredValue(value);
      }
    },
    [key, initialValue]
  );

  return [storedValue, setValue];
}
