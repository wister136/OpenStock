import type { StrategyConfig } from '@/lib/ashare/config';
import type { NewsSignal, RealtimeSignal } from '@/lib/ashare/providers/types';
import { atr, rollingMax, sma, slope } from './indicators';

export type MarketRegime = 'TREND' | 'RANGE' | 'PANIC';

export type RegimeInputs = {
  bars: { ts: number; open: number; high: number; low: number; close: number; volume: number; amount?: number }[];
  news?: NewsSignal | null;
  realtime?: RealtimeSignal | null;
  config: StrategyConfig;
  lastRegime?: MarketRegime | null;
};

type RegimeScores = { trend: number; range: number; panic: number };

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function detectRegime(inputs: RegimeInputs): {
  regime: MarketRegime;
  confidence: number;
  scores: RegimeScores;
  metrics: Record<string, number>;
  reasons: string[];
  external_used: { news: boolean; realtime: boolean };
} {
  const { bars, news, realtime, config, lastRegime } = inputs;
  const reasons: string[] = [];

  if (!bars.length) {
    return {
      regime: 'RANGE',
      confidence: 0,
      scores: { trend: 0, range: 1, panic: 0 },
      metrics: {},
      reasons: ['No bars available, fallback to RANGE'],
      external_used: { news: false, realtime: false },
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

  const trendScale = Math.max(0.2, Math.abs(config.thresholds.trendScoreThreshold) * 0.6);
  const panicVolScale = Math.max(0.3, Math.abs(config.thresholds.panicVolRatio) * 0.5);
  const panicDdScale = Math.max(0.02, Math.abs(config.thresholds.panicDrawdown) * 0.5);

  const scoreTrendK = clamp01((trendScore - config.thresholds.trendScoreThreshold) / trendScale);
  const scorePanicK = clamp01(
    (volRatio - config.thresholds.panicVolRatio) / panicVolScale +
      (-drawdown - config.thresholds.panicDrawdown) / panicDdScale
  );
  const scoreRangeK = clamp01(1 - Math.max(scoreTrendK, scorePanicK));

  let scoreTrendNews = 0;
  let scorePanicNews = 0;
  let wNews = config.weights.w_news;
  const mockRatio = news?.mockRatio;
  if (mockRatio != null && mockRatio >= 0.8) {
    wNews = wNews * 0.1;
    reasons.push('News is MOCK -> weight reduced (dev mode)');
  }
  if (news) {
    if (news.score < -config.thresholds.newsPanicThreshold) {
      scorePanicNews = clamp01(Math.abs(news.score) * news.confidence);
      reasons.push('News sentiment indicates panic risk');
    }
    if (news.score > config.thresholds.newsTrendThreshold) {
      scoreTrendNews = clamp01(news.score * news.confidence);
      reasons.push('News sentiment supports trend');
    }
  }

  let scorePanicRT = 0;
  let scoreTrendRT = 0;
  if (realtime) {
    const surprise = Math.max(realtime.volSurprise, realtime.amtSurprise);
    const rtScale = Math.max(0.1, Math.max(config.thresholds.realtimeVolSurprise, config.thresholds.realtimeAmtSurprise));
    const lastClose = closes[lastIdx] ?? 0;
    const prevClose = closes[lastIdx - 1] ?? lastClose;
    const priceUp = lastClose >= prevClose;

    if (surprise > 0 && priceUp && lastClose > ma60) {
      scoreTrendRT = clamp01(surprise / rtScale);
      reasons.push('Realtime surprise confirms trend direction');
    } else if (surprise > 0 && !priceUp && lastClose < ma60) {
      scorePanicRT = clamp01(surprise / rtScale);
      reasons.push('Realtime surprise indicates downside risk');
    }
  }

  const trend = config.weights.w_trend * scoreTrendK + wNews * scoreTrendNews + config.weights.w_realtime * scoreTrendRT;
  const panic = config.weights.w_panic * scorePanicK + wNews * scorePanicNews + config.weights.w_realtime * scorePanicRT;
  const range = config.weights.w_range * scoreRangeK;

  const scores: RegimeScores = { trend, range, panic };
  const sorted = [trend, range, panic].sort((a, b) => b - a);
  const confidence = clamp01((sorted[0] ?? 0) - (sorted[1] ?? 0));

  let candidate: MarketRegime = 'RANGE';
  if (scores.panic >= scores.trend && scores.panic >= scores.range) candidate = 'PANIC';
  else if (scores.trend >= scores.range) candidate = 'TREND';

  let regime = candidate;
  if (lastRegime && candidate !== lastRegime && confidence < config.thresholds.hysteresisThreshold) {
    regime = lastRegime;
    reasons.push('Hysteresis hold: confidence below threshold');
  }

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
      mockRatio: mockRatio ?? 0,
      scorePanicRT,
      scoreTrendRT,
    },
    reasons,
    external_used: { news: Boolean(news), realtime: Boolean(realtime) },
  };
}
