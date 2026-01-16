// LocalStorage helpers (safe in SSR) + a small hook wrapper
import { useEffect, useState } from 'react';

export function safeLocalStorageGet(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/**
 * useLocalStorageState
 * - Works like useState, but also syncs to localStorage (client-only).
 */
export function useLocalStorageState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    const v = safeLocalStorageGet(key);
    return (v as T) ?? defaultValue;
  });

  useEffect(() => {
    safeLocalStorageSet(key, state);
  }, [key, state]);

  return [state, setState] as const;
}
