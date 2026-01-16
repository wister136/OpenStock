// Placeholder hook: visible range + buffer (future refactor target)
import { useMemo } from 'react';

export type VisibleRange = { from: number; to: number };

export function useVisibleRange(length: number, rawFrom: number | null, rawTo: number | null, buffer: number = 20) {
  return useMemo(() => {
    if (!Number.isFinite(length) || length <= 0) return { from: 0, to: -1 } as VisibleRange;
    const from = rawFrom == null ? 0 : Math.max(0, Math.floor(rawFrom) - buffer);
    const to = rawTo == null ? length - 1 : Math.min(length - 1, Math.ceil(rawTo) + buffer);
    return { from, to } as VisibleRange;
  }, [length, rawFrom, rawTo, buffer]);
}
