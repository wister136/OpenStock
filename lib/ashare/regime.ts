import type { StrategyConfig } from '@/lib/ashare/config';
import type { NewsSignal, RealtimeSignal } from '@/lib/ashare/providers/types';
import { atr, rollingMax, sma, slope } from './indicators';

export type MarketRegime = 'TREND' | 'RANGE' | 'PANIC';

export type RegimeInputs = {
  bars: { ts: number; open: number; high: number; low: number; close: number; volume: number; amount?: number }[];
  news?: NewsSignal | null;
  realtime?: RealtimeSignal | null;
  config: StrategyConfig;
};

type RegimeScores = { trend: number; range: number; panic: number };

type RegimeState = { stable: MarketRegime; recent: MarketRegime[] };

const hysteresisMap = new Map<string, RegimeState>();
const HYSTERESIS_BARS = 5;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function applyHysteresis(symbol: string, candidate: MarketRegime, reasons: string[]): MarketRegime {
  const state = hysteresisMap.get(symbol) ?? { stable: candidate, recent: [] };
  state.recent.push(candidate);
  if (state.recent.length > HYSTERESIS_BARS) state.recent.shift();

  const allSame = state.recent.length >= HYSTERESIS_BARS && state.recent.every((r) => r === candidate);
  if (candidate !== state.stable && !allSame) {
    reasons.push('Hysteresis: waiting for regime stability');
  } else if (candidate !== state.stable && allSame) {
    state.stable = candidate;
    reasons.push('Hysteresis: regime switch confirmed');
  }

  hysteresisMap.set(symbol, state);
  return state.stable;
}

export function detectRegime(inputs: RegimeInputs): {
  regime: MarketRegime;
  confidence: number;
  scores: RegimeScores;
  metrics: Record<string, number>;
  reasons: string[];
} {
  const { bars, news, realtime, config } = inputs;
  const reasons: string[] = [];

  if (!bars.length) {
    return {
      regime: 'RANGE',
      confidence: 0,
      scores: { trend: 0, range: 1, panic: 0 },
      metrics: {},
      reasons: ['No bars available, fallback to RANGE'],
    };
  }

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const vols = bars.map((b) => b.volume);
  const lastIdx = bars.length - 1;

  const ma20Arr = sma(closes, 20);
  const ma60Arr = sma(closes, 60);
  const atrArr = atr(highs, lows, closes, 14);
  const slopeArr = slope(ma20Arr, 10);
  const rollingMaxArr = rollingMax(closes, 60);

  const ma20 = ma20Arr[lastIdx] ?? closes[lastIdx];
  const ma60 = ma60Arr[lastIdx] ?? closes[lastIdx];
  const currAtr = atrArr[lastIdx] ?? 0;
  const currClose = closes[lastIdx] ?? 0;
  const atrPct = currClose > 0 ? (currAtr / currClose) * 100 : 0;

  const trendScore = (slopeArr[lastIdx] ?? 0) * 100;

  const volAvg = vols.length >= 20 ? vols.slice(-20).reduce((a, b) => a + b, 0) / 20 : vols.reduce((a, b) => a + b, 0) / Math.max(1, vols.length);
  const volRatio = volAvg > 0 ? vols[lastIdx] / volAvg : 0;

  const peak = rollingMaxArr[lastIdx] ?? currClose;
  const drawdown = peak > 0 ? currClose / peak - 1 : 0;

  const trendScale = Math.max(0.2, Math.abs(config.thresholds.trendScore) * 0.6);
  const panicVolScale = Math.max(0.3, Math.abs(config.thresholds.panicVolRatio) * 0.5);
  const panicDdScale = Math.max(0.02, Math.abs(config.thresholds.panicDrawdown) * 0.5);

  const scoreTrendK = clamp01((trendScore - config.thresholds.trendScore) / trendScale);
  const scorePanicK = clamp01(
    (volRatio - config.thresholds.panicVolRatio) / panicVolScale +
      (-drawdown - config.thresholds.panicDrawdown) / panicDdScale
  );
  const scoreRangeK = clamp01(1 - Math.max(scoreTrendK, scorePanicK));

  let scoreTrendNews = 0;
  let scorePanicNews = 0;
  if (news) {
    if (news.score < -config.thresholds.newsPanicThreshold) {
      scorePanicNews = clamp01(Math.abs(news.score) * news.confidence);
      reasons.push('News sentiment indicates panic risk');
    }
    if (news.score > config.thresholds.newsTrendThreshold) {
      scoreTrendNews = clamp01(news.score * news.confidence);
      reasons.push('News sentiment supports trend');
    }
  } else {
    reasons.push('News sentiment missing -> degrade to Kline only');
  }

  let scorePanicRT = 0;
  if (realtime) {
    const surprise = Math.max(realtime.volSurprise, realtime.amtSurprise);
    const rtScale = Math.max(0.1, Math.max(config.thresholds.realtimeVolSurprise, config.thresholds.realtimeAmtSurprise));
    scorePanicRT = clamp01(surprise / rtScale);
    if (scorePanicRT > 0) reasons.push('Realtime volume/amount surprise detected');
  } else {
    reasons.push('Realtime signal missing -> degrade to Kline only');
  }

  const trend = config.weights.w_trend * scoreTrendK + config.weights.w_news * scoreTrendNews;
  const panic = config.weights.w_panic * scorePanicK + config.weights.w_news * scorePanicNews + config.weights.w_realtime * scorePanicRT;
  const range = config.weights.w_range * scoreRangeK;

  const scores: RegimeScores = { trend, range, panic };
  const sorted = [trend, range, panic].sort((a, b) => b - a);
  const confidence = clamp01((sorted[0] ?? 0) - (sorted[1] ?? 0));

  let candidate: MarketRegime = 'RANGE';
  if (scores.panic >= scores.trend && scores.panic >= scores.range) candidate = 'PANIC';
  else if (scores.trend >= scores.range) candidate = 'TREND';

  const regime = applyHysteresis(config.symbol, candidate, reasons);

  return {
    regime,
    confidence,
    scores,
    metrics: {
      trendScore,
      ma20,
      ma60,
      atrPct,
      volRatio,
      drawdown,
      scoreTrendK,
      scorePanicK,
      scoreRangeK,
      scoreTrendNews,
      scorePanicNews,
      scorePanicRT,
    },
    reasons,
  };
}
