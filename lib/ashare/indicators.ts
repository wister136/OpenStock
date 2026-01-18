import { atr as baseAtr, bollingerBands as baseBollingerBands, ema as baseEma, rsi as baseRsi, rollingMax as baseRollingMax, sma as baseSma } from '@/lib/indicators';

export type Bar = { ts: number; open: number; high: number; low: number; close: number; volume: number; amount?: number };

export function sma(values: number[], period: number): number[] {
  return baseSma(values, period);
}

export function ema(values: number[], period: number): number[] {
  return baseEma(values, period);
}

export function atr(highs: number[], lows: number[], closes: number[], period: number): number[] {
  return baseAtr(highs, lows, closes, period);
}

export function rsi(values: number[], period = 14): number[] {
  return baseRsi(values, period);
}

export function bollinger(values: number[], period = 20, mult = 2): { mid: number[]; upper: number[]; lower: number[] } {
  return baseBollingerBands(values, period, mult);
}

export function rollingMax(values: number[], period: number): number[] {
  return baseRollingMax(values, period);
}

export function slope(values: number[], lookback = 10): number[] {
  const out = new Array(values.length).fill(NaN);
  if (lookback <= 0) return out;
  for (let i = lookback; i < values.length; i++) {
    const prev = values[i - lookback];
    const curr = values[i];
    if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev === 0) continue;
    out[i] = (curr - prev) / Math.abs(prev);
  }
  return out;
}
