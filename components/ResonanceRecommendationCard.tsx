"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/components/AshareKlinePanel/hooks/useLocalStorageState";
import { DEFAULT_RESONANCE_CONFIG } from "@/lib/ta/scoring";
import type { RecommendationResponse, ResonanceConfig } from "@/types/resonance";

const CONFIG_KEY = "resonance_config_v1";

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function parseNumberInput(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function ResonanceRecommendationCard({ symbol }: { symbol: string }) {
  const [config, setConfig] = useState<ResonanceConfig>(() => {
    const stored = safeLocalStorageGet(CONFIG_KEY);
    if (stored && typeof stored === "object") {
      return { ...DEFAULT_RESONANCE_CONFIG, ...(stored as Partial<ResonanceConfig>) };
    }
    return DEFAULT_RESONANCE_CONFIG;
  });
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    safeLocalStorageSet(CONFIG_KEY, config);
  }, [config]);

  const configEncoded = useMemo(() => {
    try {
      return btoa(JSON.stringify(config));
    } catch {
      return "";
    }
  }, [config]);

  const fetchData = async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ashare/resonance?symbol=${encodeURIComponent(symbol)}&config=${encodeURIComponent(
        configEncoded
      )}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as RecommendationResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const debouncedFetch = useDebounce(fetchData, 400);

  useEffect(() => {
    debouncedFetch();
  }, [symbol, configEncoded, debouncedFetch]);

  const recommendation = data?.recommendation;
  const candidates = data?.candidates ?? [];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5 space-y-4">
      <div className="flex flex-col gap-2">
        <div className="text-sm text-gray-400">Resonance Recommendation</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-2xl font-semibold text-white">
            {recommendation?.action ?? "HOLD"}
          </div>
          <div className="text-sm text-gray-400">
            {recommendation?.timeframe ?? "--"} / {recommendation?.strategy ?? "--"}
          </div>
          <div className="text-sm text-emerald-400">
            Score {recommendation?.score ?? 0}
          </div>
        </div>
      </div>

      <div>
        <div className="h-2 w-full rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${clampNumber(recommendation?.score ?? 0, 0, 100)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-400">
          {recommendation?.reasons?.length ? recommendation.reasons.join(" · ") : "No reasons"}
        </div>
      </div>

      {loading && <div className="text-xs text-gray-500">Loading resonance...</div>}
      {error && <div className="text-xs text-red-400">Error: {error}</div>}

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-sm text-gray-300">Candidates</summary>
        <div className="mt-3 space-y-2 text-sm text-gray-300">
          {candidates.map((c) => (
            <div
              key={`${c.timeframe}-${c.strategy}`}
              className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-white">{c.timeframe}</div>
                <div className="text-gray-400">{c.strategy}</div>
                <div className="text-emerald-400">Score {c.score}</div>
                <div className="text-xs text-gray-500">
                  {c.rawAction} → {c.gatedAction}
                </div>
              </div>
              <div className="text-xs text-gray-400">
                {c.reasons?.length ? c.reasons.join(" · ") : "No reasons"}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-sm text-gray-300">Parameters</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-300">
          <label className="space-y-1">
            <div className="text-xs text-gray-500">ADX threshold</div>
            <input
              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
              type="number"
              value={config.adxThreshold}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  adxThreshold: clampNumber(parseNumberInput(e.target.value, prev.adxThreshold), 5, 80),
                }))
              }
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-gray-500">EMA period</div>
            <input
              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
              type="number"
              value={config.emaPeriod}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  emaPeriod: clampNumber(parseNumberInput(e.target.value, prev.emaPeriod), 5, 100),
                }))
              }
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-gray-500">RSI period</div>
            <input
              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
              type="number"
              value={config.rsiPeriod}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  rsiPeriod: clampNumber(parseNumberInput(e.target.value, prev.rsiPeriod), 5, 50),
                }))
              }
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-gray-500">RSI buy</div>
            <input
              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
              type="number"
              value={config.rsiBuy}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  rsiBuy: clampNumber(parseNumberInput(e.target.value, prev.rsiBuy), 5, 45),
                }))
              }
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-gray-500">RSI sell</div>
            <input
              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
              type="number"
              value={config.rsiSell}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  rsiSell: clampNumber(parseNumberInput(e.target.value, prev.rsiSell), 55, 95),
                }))
              }
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-gray-500">Min bars</div>
            <input
              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
              type="number"
              value={config.minBars}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  minBars: clampNumber(parseNumberInput(e.target.value, prev.minBars), 50, 1000),
                }))
              }
            />
          </label>
        </div>
      </details>
    </div>
  );
}
