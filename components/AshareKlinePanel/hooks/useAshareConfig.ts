import { useCallback, useEffect, useState } from 'react';

import type { RegimeConfig } from '../types';
import { getAutoTuneLatest, getConfig, postAutoTuneStart, postConfig } from '../services/ashareApi';

export function useAshareConfig(symbol: string, freq: string) {
  const [regimeConfig, setRegimeConfig] = useState<RegimeConfig | null>(null);
  const [configDraft, setConfigDraft] = useState<RegimeConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);

  const [autoTuneLoading, setAutoTuneLoading] = useState(false);
  const [autoTuneError, setAutoTuneError] = useState<string | null>(null);
  const [autoTuneResult, setAutoTuneResult] = useState<any>(null);
  const [autoTuneBackup, setAutoTuneBackup] = useState<RegimeConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      setConfigLoading(true);
      try {
        const res = await getConfig(symbol);
        if (!res.ok) return;
        const json = await res.json();
        const cfg = json?.config as RegimeConfig | undefined;
        if (!cfg || cancelled) return;
        setRegimeConfig(cfg);
        setConfigDraft(cfg);
        setConfigVersion((v) => v + 1);
      } catch {
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    }
    if (symbol) loadConfig();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const applyConfig = useCallback(
    async (override?: RegimeConfig) => {
      const payload = override ?? configDraft;
      if (!payload) return false;
      setConfigLoading(true);
      try {
        const res = await postConfig(symbol, payload);
        if (!res.ok) {
          return false;
        }
        const json = await res.json();
        const cfg = json?.config as RegimeConfig | undefined;
        if (cfg) {
          setRegimeConfig(cfg);
          setConfigDraft(cfg);
          setConfigVersion((v) => v + 1);
          return true;
        }
      } finally {
        setConfigLoading(false);
      }
      return false;
    },
    [configDraft, symbol]
  );

  const loadAutoTune = useCallback(async () => {
    if (!symbol) return;
    try {
      const res = await getAutoTuneLatest(symbol, freq);
      if (!res.ok) return;
      const json = await res.json();
      setAutoTuneResult(json?.latest ?? null);
    } catch {
    }
  }, [symbol, freq]);

  useEffect(() => {
    loadAutoTune();
  }, [loadAutoTune]);

  const startAutoTune = useCallback(async () => {
    if (!symbol) return;
    setAutoTuneLoading(true);
    setAutoTuneError(null);
    try {
      const res = await postAutoTuneStart(symbol, freq, 180, 80);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setAutoTuneError(text || `HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      setAutoTuneResult({
        trainDays: json.trainDays,
        trials: json.trials,
        objective: json.objective,
        bestParams: json.bestParams,
        metrics: json.metrics,
        createdAt: new Date(json.serverTime).toISOString(),
      });
    } catch (e: any) {
      setAutoTuneError(String(e?.message ?? e));
    } finally {
      setAutoTuneLoading(false);
    }
  }, [symbol, freq]);

  const applyRecommended = useCallback(async () => {
    if (!autoTuneResult?.bestParams) return false;
    if (regimeConfig) setAutoTuneBackup(regimeConfig);
    const best = autoTuneResult.bestParams;
    const nextConfig = {
      weights: best.weights,
      thresholds: best.thresholds,
      positionCaps: best.positionCaps,
    } as RegimeConfig;
    setConfigDraft(nextConfig);
    return applyConfig(nextConfig);
  }, [autoTuneResult, applyConfig, regimeConfig]);

  const rollbackConfig = useCallback(async () => {
    if (!autoTuneBackup) return false;
    setConfigDraft(autoTuneBackup);
    return applyConfig(autoTuneBackup);
  }, [autoTuneBackup, applyConfig]);

  return {
    regimeConfig,
    configDraft,
    setConfigDraft,
    configLoading,
    applyConfig,
    loadAutoTune,
    startAutoTune,
    applyRecommended,
    rollbackConfig,
    autoTuneResult,
    autoTuneLoading,
    autoTuneError,
    autoTuneBackup,
    configVersion,
  };
}
