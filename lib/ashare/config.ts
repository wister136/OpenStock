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
  const legacy = (input as any).thresholds || {};
  const migratedThresholds: Partial<StrategyThresholds> = {
    trendScoreThreshold: legacy.trendScoreThreshold ?? legacy.trendScore,
    minLiquidityAmountRatio: legacy.minLiquidityAmountRatio ?? legacy.minLiquidityRatio,
  };
  return {
    userId,
    symbol,
    weights: { ...base.weights, ...(input.weights || {}) },
    thresholds: { ...base.thresholds, ...(input.thresholds || {}), ...migratedThresholds },
    positionCaps: { ...base.positionCaps, ...(input.positionCaps || {}) },
  };
}
