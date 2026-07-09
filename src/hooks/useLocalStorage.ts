import { useState, useCallback } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | null) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return initialValue;
      try {
        return JSON.parse(item) as T;
      } catch {
        // A value that isn't valid JSON is either a legacy raw (unquoted) string
        // written before this hook JSON-encoded values, or corrupt data. For a
        // string-typed store, keep it so it survives the migration (it'll be
        // re-written as JSON on the next setValue); otherwise treat it as
        // corrupt and fall back to initialValue.
        if (typeof initialValue === 'string') return item as unknown as T;
        return initialValue;
      }
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
