import { useCallback, useEffect, useState } from 'react';

import type { OHLCVBar } from '@/lib/indicators';
import { mapRawBarsToOHLCV } from '../utils/mapBars';

function getBarLimitByFreq(freq: string): number {
  switch (freq) {
    case '1m':
      return 18000;
    case '5m':
      return 9000;
    case '15m':
      return 4500;
    case '30m':
      return 2400;
    case '60m':
      return 1800;
    case '1d':
    default:
      return 1200;
  }
}

export function useAshareBars(symbol: string, freq: string) {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const limit = getBarLimitByFreq(freq);
      const url = `/api/ashare/bars?symbol=${encodeURIComponent(symbol)}&freq=${encodeURIComponent(freq)}&limit=${limit}`;
      console.log(`[bars] fetching symbol=${symbol} freq=${freq}`);

      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error(`[bars] API HTTP ${res.status} ${res.statusText}`, text);
          if (cancelled) return;
          setBars([]);
          setUpdatedAt(null);
          setError(text || `HTTP ${res.status}`);
          return;
        }

        const json = await res.json();
        const count = json?.count ?? json?.bars?.length ?? 0;
        console.log(`[bars] fetched ok=${json?.ok} count=${count}`);

        const rawBars = (json?.bars ?? []) as any[];
        const mapped = mapRawBarsToOHLCV(rawBars);

        const bad = mapped.slice(0, 5).filter((b) => !Number.isFinite(b.t));
        if (bad.length) console.error('[bars] BAD timestamp sample:', bad);

        if (cancelled) return;
        setBars(mapped);
        setUpdatedAt(new Date().toLocaleString());
      } catch (e: any) {
        console.error('[bars] fetch error', e);
        if (cancelled) return;
        setBars([]);
        setUpdatedAt(null);
        setError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol, freq, reloadToken]);

  return { bars, loading, error, updatedAt, reload };
}
