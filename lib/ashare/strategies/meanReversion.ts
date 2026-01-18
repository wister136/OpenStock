import { rsi } from '@/lib/ashare/indicators';
import type { StrategyContext, StrategyDecision } from './types';

export function meanReversionStrategy(ctx: StrategyContext): StrategyDecision {
  const { bars } = ctx;
  if (bars.length < 30) {
    return { action: 'HOLD', reasons: ['Insufficient bars for mean reversion'] };
  }

  const closes = bars.map((b) => b.close);
  const rsiArr = rsi(closes, 14);
  const lastIdx = closes.length - 1;
  const lastRsi = rsiArr[lastIdx];

  if (Number.isFinite(lastRsi) && lastRsi < 30) {
    return { action: 'BUY', reasons: [`RSI oversold (${lastRsi.toFixed(1)})`] };
  }
  if (Number.isFinite(lastRsi) && lastRsi > 70) {
    return { action: 'SELL', reasons: [`RSI overbought (${lastRsi.toFixed(1)})`] };
  }
  return { action: 'HOLD', reasons: ['RSI neutral zone'] };
}
