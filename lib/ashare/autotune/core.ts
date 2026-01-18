import type { StrategyConfig } from '@/lib/ashare/config';
import type { Bar } from '@/lib/ashare/indicators';
import { detectRegime } from '@/lib/ashare/regime';
import { meanReversionStrategy } from '@/lib/ashare/strategies/meanReversion';
import { riskOffStrategy } from '@/lib/ashare/strategies/riskOff';
import { tsmomStrategy } from '@/lib/ashare/strategies/tsmom';

type Params = Pick<StrategyConfig, 'weights' | 'thresholds' | 'positionCaps'>;

export type BacktestMetrics = {
  netReturn: number;
  maxDD: number;
  trades: number;
  score: number;
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function pickStrategy(regime: 'TREND' | 'RANGE' | 'PANIC') {
  if (regime === 'TREND') return 'TSMOM';
  if (regime === 'PANIC') return 'RISK_OFF';
  return 'MEAN_REVERSION';
}

export function runBacktest(bars: Bar[], params: Params): BacktestMetrics {
  if (!bars.length) return { netReturn: 0, maxDD: 0, trades: 0, score: -999 };
  let equity = 1;
  let cash = 1;
  let position = 0;
  let entryPrice = 0;
  let trades = 0;
  let peak = 1;
  let maxDD = 0;

  for (let i = 60; i < bars.length; i++) {
    const slice = bars.slice(0, i + 1);
    const regimeRes = detectRegime({ bars: slice, news: null, realtime: null, config: { userId: 'autotune', symbol: 'AUTO', ...params } as any, lastRegime: null });
    const strategyKey = pickStrategy(regimeRes.regime);
    const strategyDecision =
      strategyKey === 'TSMOM'
        ? tsmomStrategy({ bars: slice, config: { userId: 'autotune', symbol: 'AUTO', ...params } as any })
        : strategyKey === 'MEAN_REVERSION'
          ? meanReversionStrategy({ bars: slice, config: { userId: 'autotune', symbol: 'AUTO', ...params } as any })
          : riskOffStrategy({ bars: slice, config: { userId: 'autotune', symbol: 'AUTO', ...params } as any });

    const price = bars[i].close;
    if (strategyDecision.action === 'BUY' && position === 0) {
      const cap = regimeRes.regime === 'TREND' ? params.positionCaps.trend : regimeRes.regime === 'RANGE' ? params.positionCaps.range : params.positionCaps.panic;
      position = (equity * cap) / price;
      cash = equity - position * price;
      entryPrice = price;
      trades += 1;
    } else if (strategyDecision.action === 'SELL' && position > 0) {
      cash = cash + position * price;
      position = 0;
      entryPrice = 0;
      trades += 1;
    }

    equity = cash + position * price;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }

  const netReturn = equity - 1;
  let score = netReturn - 0.7 * maxDD - 0.001 * trades;
  if (maxDD > 0.25) score = -999;
  if (trades < 3) score -= 0.2;
  if (trades > 500) score -= 0.2;
  return { netReturn, maxDD, trades, score };
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function searchParams(bars: Bar[], trials = 80): { bestParams: Params; metrics: BacktestMetrics } {
  const best: { score: number; params: Params; metrics: BacktestMetrics } = {
    score: -Infinity,
    params: {
      weights: { w_trend: 0.6, w_range: 0.4, w_panic: 0.9, w_news: 0.2, w_realtime: 0.3 },
      thresholds: {
        trendScoreThreshold: 0.6,
        panicVolRatio: 2.2,
        panicDrawdown: 0.08,
        volRatioLow: 0.6,
        volRatioHigh: 1.6,
        minLiquidityAmountRatio: 0.3,
        minLiquidityVolumeRatio: 0.25,
        realtimeVolSurprise: 0.8,
        realtimeAmtSurprise: 0.8,
        newsPanicThreshold: 0.35,
        newsTrendThreshold: 0.35,
        hysteresisThreshold: 0.15,
      },
      positionCaps: { trend: 1, range: 0.5, panic: 0.2 },
    },
    metrics: { netReturn: 0, maxDD: 0, trades: 0, score: -999 },
  };

  for (let i = 0; i < trials; i++) {
    const params: Params = {
      weights: {
        w_trend: randRange(0.4, 0.9),
        w_range: randRange(0.2, 0.8),
        w_panic: randRange(0.5, 1.0),
        w_news: randRange(0, 0.6),
        w_realtime: randRange(0, 0.6),
      },
      thresholds: {
        trendScoreThreshold: randRange(0.55, 0.75),
        panicVolRatio: randRange(1.5, 3.0),
        panicDrawdown: randRange(0.03, 0.1),
        volRatioLow: randRange(0.4, 0.8),
        volRatioHigh: randRange(1.2, 2.5),
        minLiquidityAmountRatio: randRange(0.2, 0.6),
        minLiquidityVolumeRatio: randRange(0.2, 0.6),
        realtimeVolSurprise: randRange(0.4, 1.2),
        realtimeAmtSurprise: randRange(0.4, 1.2),
        newsPanicThreshold: randRange(0.2, 0.5),
        newsTrendThreshold: randRange(0.2, 0.5),
        hysteresisThreshold: randRange(0.1, 0.3),
      },
      positionCaps: {
        trend: randRange(0.5, 1.0),
        range: randRange(0.2, 0.6),
        panic: randRange(0.0, 0.3),
      },
    };

    params.weights.w_trend = clamp(params.weights.w_trend, 0, 1);
    params.weights.w_range = clamp(params.weights.w_range, 0, 1);
    params.weights.w_panic = clamp(params.weights.w_panic, 0, 1);
    params.weights.w_news = clamp(params.weights.w_news, 0, 1);
    params.weights.w_realtime = clamp(params.weights.w_realtime, 0, 1);

    const metrics = runBacktest(bars, params);
    if (metrics.score > best.score) {
      best.score = metrics.score;
      best.params = params;
      best.metrics = metrics;
    }
  }

  return { bestParams: best.params, metrics: best.metrics };
}
