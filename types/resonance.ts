export type Bar = {
  ts: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  amount?: number;
};

export type Timeframe = '5m' | '15m' | '30m' | '1d';
export type StrategyKey = 'rsi_reversion' | 'trend_following';
export type Action = 'BUY' | 'SELL' | 'HOLD';

export type ResonanceConfig = {
  adxThreshold: number;
  emaPeriod: number;
  rsiPeriod: number;
  rsiBuy: number;
  rsiSell: number;
  minBars: number;
  trendAdxMin: number;
  trendEmaSlopeLookback: number;
  atrPeriod: number;
  atrRiskHighPct: number;
  atrRiskLowPct: number;
};

export type TrendFilterResult = {
  trend: 'BULL' | 'BEAR' | 'SIDEWAYS';
  bullishAllowed: boolean;
  bearishAllowed: boolean;
  metrics: { adx: number; ema20: number; close: number };
  reasons: string[];
};

export type SignalResult = {
  action: Action;
  score: number;
  reasons: string[];
  debug?: {
    rsi?: number;
    ema20?: number;
    close?: number;
    adx?: number;
    atr?: number;
    atrPct?: number;
  };
};

export type CandidateScore = {
  timeframe: Timeframe;
  strategy: StrategyKey;
  rawAction: Action;
  gatedAction: Action;
  score: number;
  reasons: string[];
};

export type Recommendation = {
  action: Action;
  timeframe: Timeframe;
  strategy: StrategyKey;
  score: number;
  reasons: string[];
};

export type RecommendationResponse = {
  symbol: string;
  asOf: string;
  dailyTrend: TrendFilterResult;
  candidates: CandidateScore[];
  recommendation: Recommendation;
};
