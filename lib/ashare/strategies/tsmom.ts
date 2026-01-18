import { ema, slope } from '@/lib/ashare/indicators';
import type { StrategyContext, StrategyDecision } from './types';

export function tsmomStrategy(ctx: StrategyContext): StrategyDecision {
  const { bars } = ctx;
  if (bars.length < 60) {
    return { action: 'HOLD', reasons: ['Insufficient bars for TSMOM'] };
  }

  const closes = bars.map((b) => b.close);
  const ema20 = ema(closes, 20);
  const ema60 = ema(closes, 60);
  const slopeArr = slope(ema20, 10);
  const lastIdx = closes.length - 1;

  const lastClose = closes[lastIdx];
  const lastEma20 = ema20[lastIdx];
  const lastEma60 = ema60[lastIdx];
  const lastSlope = slopeArr[lastIdx] ?? 0;

  if (Number.isFinite(lastEma20) && Number.isFinite(lastEma60) && lastClose > lastEma20 && lastEma20 > lastEma60 && lastSlope > 0) {
    return { action: 'BUY', reasons: ['Price above EMA20/EMA60 with positive slope'] };
  }
  if (Number.isFinite(lastEma20) && lastClose < lastEma20) {
    return { action: 'SELL', reasons: ['Price below EMA20'] };
  }
  return { action: 'HOLD', reasons: ['TSMOM neutral signal'] };
}
