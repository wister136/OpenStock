import type { IAshareStrategyConfig, PositionCaps, StrategyThresholds, StrategyWeights } from '@/database/models/AshareStrategyConfig';

export type StrategyConfig = Pick<IAshareStrategyConfig, 'userId' | 'symbol' | 'weights' | 'thresholds' | 'positionCaps'>;

export const DEFAULT_WEIGHTS: StrategyWeights = {
  w_trend: 0.6,
  w_range: 0.4,
  w_panic: 0.9,
  w_news: 0.4,
  w_realtime: 0.6,
};

export const DEFAULT_THRESHOLDS: StrategyThresholds = {
  trendScore: 0.6,
  panicVolRatio: 2.2,
  panicDrawdown: 0.08,
  volRatioLow: 0.6,
  volRatioHigh: 1.6,
  minLiquidityRatio: 0.3,
  realtimeVolSurprise: 0.8,
  realtimeAmtSurprise: 0.8,
  newsPanicThreshold: 0.35,
  newsTrendThreshold: 0.35,
};

export const DEFAULT_POSITION_CAPS: PositionCaps = {
  trend: 1,
  range: 0.5,
  panic: 0.2,
};

export function buildDefaultConfig(userId: string, symbol: string): StrategyConfig {
  return {
    userId,
    symbol,
    weights: { ...DEFAULT_WEIGHTS },
    thresholds: { ...DEFAULT_THRESHOLDS },
    positionCaps: { ...DEFAULT_POSITION_CAPS },
  };
}

export function normalizeConfig(input: Partial<StrategyConfig> | null | undefined, userId: string, symbol: string): StrategyConfig {
  const base = buildDefaultConfig(userId, symbol);
  if (!input) return base;
  return {
    userId,
    symbol,
    weights: { ...base.weights, ...(input.weights || {}) },
    thresholds: { ...base.thresholds, ...(input.thresholds || {}) },
    positionCaps: { ...base.positionCaps, ...(input.positionCaps || {}) },
  };
}
