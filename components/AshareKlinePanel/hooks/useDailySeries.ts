// Placeholder hook: daily series / indicators (future refactor target)
import { useMemo } from 'react';
import type { OHLCVBar } from '@/lib/indicators';
import { ema } from '@/lib/indicators';

export function useDailySeries(bars1d: OHLCVBar[] | null, emaPeriod: number = 20) {
  return useMemo(() => {
    const bars = bars1d ?? [];
    const closes = bars.map((b) => b.c);
    const emaArr = ema(closes, emaPeriod);
    return { bars, ema: emaArr };
  }, [bars1d, emaPeriod]);
}
