import { Schema, model, models, type Document } from 'mongoose';

export type StrategyWeights = {
  w_trend: number;
  w_range: number;
  w_panic: number;
  w_news: number;
  w_realtime: number;
};

export type StrategyThresholds = {
  trendScoreThreshold: number;
  panicVolRatio: number;
  panicDrawdown: number;
  volRatioLow: number;
  volRatioHigh: number;
  minLiquidityAmountRatio: number;
  minLiquidityVolumeRatio?: number;
  realtimeVolSurprise: number;
  realtimeAmtSurprise: number;
  newsPanicThreshold: number;
  newsTrendThreshold: number;
  hysteresisThreshold: number;
};

export type PositionCaps = {
  trend: number;
  range: number;
  panic: number;
};

export interface IAshareStrategyConfig extends Document {
  userId: string;
  symbol: string;
  weights: StrategyWeights;
  thresholds: StrategyThresholds;
  positionCaps: PositionCaps;
}

const StrategyWeightsSchema = new Schema<StrategyWeights>(
  {
    w_trend: { type: Number, required: true },
    w_range: { type: Number, required: true },
    w_panic: { type: Number, required: true },
    w_news: { type: Number, required: true },
    w_realtime: { type: Number, required: true },
  },
  { _id: false }
);

const StrategyThresholdsSchema = new Schema<StrategyThresholds>(
  {
    trendScoreThreshold: { type: Number, required: true },
    panicVolRatio: { type: Number, required: true },
    panicDrawdown: { type: Number, required: true },
    volRatioLow: { type: Number, required: true },
    volRatioHigh: { type: Number, required: true },
    minLiquidityAmountRatio: { type: Number, required: true },
    minLiquidityVolumeRatio: { type: Number, required: false, default: undefined },
    realtimeVolSurprise: { type: Number, required: true },
    realtimeAmtSurprise: { type: Number, required: true },
    newsPanicThreshold: { type: Number, required: true },
    newsTrendThreshold: { type: Number, required: true },
    hysteresisThreshold: { type: Number, required: true },
  },
  { _id: false }
);

const PositionCapsSchema = new Schema<PositionCaps>(
  {
    trend: { type: Number, required: true },
    range: { type: Number, required: true },
    panic: { type: Number, required: true },
  },
  { _id: false }
);

const AshareStrategyConfigSchema = new Schema<IAshareStrategyConfig>(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    weights: { type: StrategyWeightsSchema, required: true },
    thresholds: { type: StrategyThresholdsSchema, required: true },
    positionCaps: { type: PositionCapsSchema, required: true },
  },
  { timestamps: true }
);

AshareStrategyConfigSchema.index({ userId: 1, symbol: 1 }, { unique: true });

const AshareStrategyConfig =
  models.AshareStrategyConfig ||
  model<IAshareStrategyConfig>('AshareStrategyConfig', AshareStrategyConfigSchema, 'ashare_strategy_configs');

export default AshareStrategyConfig;
