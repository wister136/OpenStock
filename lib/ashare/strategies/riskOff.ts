import { ema } from '@/lib/ashare/indicators';
import type { StrategyContext, StrategyDecision } from './types';

export function riskOffStrategy(ctx: StrategyContext): StrategyDecision {
  const { bars } = ctx;
  if (bars.length < 30) {
    return { action: 'HOLD', reasons: ['Insufficient bars for risk-off'] };
  }

  const closes = bars.map((b) => b.close);
  const ema20 = ema(closes, 20);
  const lastIdx = closes.length - 1;
  const lastClose = closes[lastIdx];
  const lastEma20 = ema20[lastIdx];

  if (Number.isFinite(lastEma20) && lastClose < lastEma20) {
    return { action: 'SELL', reasons: ['Risk-off: price below EMA20'] };
  }
  return { action: 'HOLD', reasons: ['Risk-off: hold cash'] };
}
