import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import AshareBar, { type AshareBarFreq } from '@/database/models/ashareBar.model';
import { resolveConfig, scoreSignals } from '@/lib/ta/scoring';
import { computeDailyTrendFilter, computeRsiReversionSignal, computeTrendFollowingSignal } from '@/lib/ta/signals';
import type { Bar, RecommendationResponse, ResonanceConfig, StrategyKey, Timeframe } from '@/types/resonance';

const CACHE_TTL_MS = 20000;
const cache = new Map<string, { ts: number; data: RecommendationResponse }>();

const TIMEFRAME_MAP: Array<{ timeframe: Timeframe; freq: AshareBarFreq; strategy: StrategyKey }> = [
  { timeframe: '5m', freq: '5m', strategy: 'rsi_reversion' },
  { timeframe: '15m', freq: '15m', strategy: 'rsi_reversion' },
  { timeframe: '30m', freq: '30m', strategy: 'trend_following' },
  { timeframe: '1d', freq: '1d', strategy: 'trend_following' },
];

function normalizeSymbol(input: string | null): string {
  const s = (input || '').trim().toUpperCase();
  if (!s.includes(':')) return s;
  const [ex, tk] = s.split(':');
  return `${ex}:${tk}`;
}

function normalizeIsoCandidate(s: string): string {
  let x = (s || '').trim();
  if (x.includes(' ') && !x.includes('T')) x = x.replace(' ', 'T');
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(x);
  if (!hasTimezone && /^\d{4}-\d{2}-\d{2}T/.test(x)) x = `${x}Z`;
  return x;
}

function toEpochSeconds(ts: unknown): number | null {
  if (ts == null) return null;
  if (ts instanceof Date) {
    const ms = ts.getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  if (typeof ts === 'number') {
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(normalizeIsoCandidate(ts));
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }
  try {
    const ms = new Date(ts as any).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  } catch {
    return null;
  }
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseConfig(searchParams: URLSearchParams): ResonanceConfig {
  let config: Partial<ResonanceConfig> = {};
  const packed = searchParams.get('config');
  if (packed) {
    try {
      const json = Buffer.from(packed, 'base64').toString('utf8');
      config = JSON.parse(json);
    } catch {
      config = {};
    }
  }

  const merged = resolveConfig({
    ...config,
    adxThreshold: parseOptionalNumber(searchParams.get('adxThreshold')) ?? config.adxThreshold,
    emaPeriod: parseOptionalNumber(searchParams.get('emaPeriod')) ?? config.emaPeriod,
    rsiPeriod: parseOptionalNumber(searchParams.get('rsiPeriod')) ?? config.rsiPeriod,
    rsiBuy: parseOptionalNumber(searchParams.get('rsiBuy')) ?? config.rsiBuy,
    rsiSell: parseOptionalNumber(searchParams.get('rsiSell')) ?? config.rsiSell,
    minBars: parseOptionalNumber(searchParams.get('minBars')) ?? config.minBars,
  });

  return merged;
}

async function fetchBars(symbol: string, freq: AshareBarFreq, limit: number): Promise<Bar[]> {
  const docs = await AshareBar.find({ symbol, freq }).sort({ ts: -1 }).limit(limit).lean();
  const asc = docs.reverse();
  return asc
    .map((d: any) => {
      const t = toEpochSeconds(d.ts);
      if (!Number.isFinite(t)) return null;
      return {
        ts: t as number,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
        volume: Number(d.volume),
        amount: d.amount == null ? undefined : Number(d.amount),
      } as Bar;
    })
    .filter(Boolean) as Bar[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol'));
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '300', 10) || 300, 100), 5000);

  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Missing symbol' }, { status: 400 });
  }

  const config = parseConfig(searchParams);
  const cacheKey = `${symbol}|${JSON.stringify(config)}|${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    await connectToDatabase();

    const barMap = new Map<AshareBarFreq, Bar[]>();
    for (const item of TIMEFRAME_MAP) {
      const bars = await fetchBars(symbol, item.freq, limit);
      barMap.set(item.freq, bars);
    }

    const dailyBars = barMap.get('1d') || [];
    const dailyTrend = computeDailyTrendFilter(dailyBars, config);

    const signals = TIMEFRAME_MAP.map((item) => {
      const bars = barMap.get(item.freq) || [];
      const signal =
        item.strategy === 'rsi_reversion'
          ? computeRsiReversionSignal(bars, config)
          : computeTrendFollowingSignal(bars, config);
      return { timeframe: item.timeframe, strategy: item.strategy, signal };
    });

    const { candidates, recommendation } = scoreSignals(dailyTrend, signals, config);

    const response: RecommendationResponse = {
      symbol,
      asOf: new Date().toISOString(),
      dailyTrend,
      candidates,
      recommendation,
    };

    cache.set(cacheKey, { ts: Date.now(), data: response });

    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
