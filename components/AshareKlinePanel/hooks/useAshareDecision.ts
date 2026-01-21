import { useCallback, useEffect, useState } from 'react';

import type { DecisionMeta, DecisionPayload, RegimeConfig } from '../types';

export function useAshareDecision(
  symbol: string,
  freq: string,
  regimeConfig: RegimeConfig | null,
  configVersion: number,
  refreshInterval: '3s' | '5s' | '10s' | 'manual'
) {
  const [decision, setDecision] = useState<DecisionPayload | null>(null);
  const [meta, setMeta] = useState<DecisionMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDecision = useCallback(async () => {
    if (!symbol || !regimeConfig) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ashare/decision?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(freq)}&limit=500`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setError(text || `HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      if (json?.decision) {
        setDecision(json.decision as DecisionPayload);
        setMeta({
          cacheHit: Boolean(json?.cacheHit),
          dataFreshness: json?.dataFreshness ?? { barsAgeMs: 0, newsAgeMs: null, realtimeAgeMs: null },
          serverTime: json?.serverTime ?? Date.now(),
          external_used: json?.external_used ?? { news: false, realtime: false },
          news_source: json?.news_source ?? 'none',
        });
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [symbol, freq, regimeConfig]);

  useEffect(() => {
    let cancelled = false;
    if (!symbol || !regimeConfig) return;
    refreshDecision();
    if (refreshInterval === 'manual') return;
    const ms = refreshInterval === '3s' ? 3000 : refreshInterval === '10s' ? 10000 : 5000;
    const id = setInterval(() => {
      if (!cancelled) refreshDecision();
    }, ms);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, freq, regimeConfig, configVersion, refreshDecision, refreshInterval]);

  return { decision, meta, loading, error, refreshDecision };
}
