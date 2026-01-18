import type {
  Action,
  CandidateScore,
  Recommendation,
  ResonanceConfig,
  SignalResult,
  StrategyKey,
  Timeframe,
  TrendFilterResult,
} from '@/types/resonance';

export const DEFAULT_RESONANCE_CONFIG: ResonanceConfig = {
  adxThreshold: 25,
  emaPeriod: 20,
  rsiPeriod: 14,
  rsiBuy: 30,
  rsiSell: 70,
  minBars: 200,
  trendAdxMin: 20,
  trendEmaSlopeLookback: 5,
  atrPeriod: 14,
  atrRiskHighPct: 0.06,
  atrRiskLowPct: 0.005,
};

export function resolveConfig(partial?: Partial<ResonanceConfig>): ResonanceConfig {
  return {
    ...DEFAULT_RESONANCE_CONFIG,
    ...(partial || {}),
  };
}

function clampScore(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function withGate(action: Action, daily: TrendFilterResult, reasons: string[]): Action {
  if (action === 'BUY' && !daily.bullishAllowed) {
    reasons.push('Daily trend gate: BUY disabled');
    return 'HOLD';
  }
  if (action === 'SELL' && !daily.bearishAllowed) {
    reasons.push('Daily trend gate: SELL disabled');
    return 'HOLD';
  }
  return action;
}

export function scoreSignals(
  dailyTrend: TrendFilterResult,
  signals: Array<{ timeframe: Timeframe; strategy: StrategyKey; signal: SignalResult }>,
  config: ResonanceConfig
): { candidates: CandidateScore[]; recommendation: Recommendation } {
  const candidates: CandidateScore[] = signals.map((entry) => {
    const reasons = [...(entry.signal.reasons || [])];
    const rawAction = entry.signal.action;
    const gatedAction = withGate(rawAction, dailyTrend, reasons);

    let score = entry.signal.score;

    if (gatedAction === 'HOLD' && rawAction !== 'HOLD') {
      score = Math.min(score, 40);
    }

    const close = entry.signal.debug?.close;
    const ema20 = entry.signal.debug?.ema20;
    if (Number.isFinite(close) && Number.isFinite(ema20)) {
      if (gatedAction === 'BUY' && close! > ema20!) score += 10;
      if (gatedAction === 'SELL' && close! < ema20!) score += 10;
    }

    const atrPct = entry.signal.debug?.atrPct;
    if (Number.isFinite(atrPct)) {
      if (atrPct! > config.atrRiskHighPct) {
        score -= 12;
        reasons.push('Risk: volatility too high');
      } else if (atrPct! < config.atrRiskLowPct) {
        score -= 6;
        reasons.push('Risk: volatility too low');
      }
    }

    if (
      (gatedAction === 'BUY' && dailyTrend.trend === 'BULL') ||
      (gatedAction === 'SELL' && dailyTrend.trend === 'BEAR')
    ) {
      score += 25;
      reasons.push('Daily trend aligned');
    }

    return {
      timeframe: entry.timeframe,
      strategy: entry.strategy,
      rawAction,
      gatedAction,
      score: clampScore(score),
      reasons,
    };
  });

  const best = candidates.reduce((prev, cur) => {
    if (!prev) return cur;
    if (cur.score > prev.score) return cur;
    return prev;
  }, null as CandidateScore | null);

  const recommendation: Recommendation = best
    ? {
        action: best.gatedAction,
        timeframe: best.timeframe,
        strategy: best.strategy,
        score: best.score,
        reasons: best.reasons,
      }
    : {
        action: 'HOLD',
        timeframe: '5m',
        strategy: 'rsi_reversion',
        score: 0,
        reasons: ['No valid resonance'],
      };

  if (recommendation.action === 'HOLD' && candidates.every((c) => c.gatedAction === 'HOLD')) {
    recommendation.reasons = [...recommendation.reasons, 'No valid resonance'];
  }

  return { candidates, recommendation };
}
