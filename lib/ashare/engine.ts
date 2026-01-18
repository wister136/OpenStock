import type { StrategyConfig } from '@/lib/ashare/config';
import type { Bar } from '@/lib/ashare/indicators';
import type { NewsProvider, NewsSignal, RealtimeProvider, RealtimeSignal } from '@/lib/ashare/providers/types';
import { detectRegime, type MarketRegime } from '@/lib/ashare/regime';
import { normalizeSymbol } from '@/lib/ashare/symbol';
import { MockNewsProvider } from '@/lib/ashare/providers/news_mock';
import { DbNewsProvider } from '@/lib/ashare/providers/news_db';
import { ExternalNewsProvider } from '@/lib/ashare/providers/news_external';
import { BarsRealtimeProvider } from '@/lib/ashare/providers/realtime_from_bars';
import { meanReversionStrategy } from '@/lib/ashare/strategies/meanReversion';
import { riskOffStrategy } from '@/lib/ashare/strategies/riskOff';
import { tsmomStrategy } from '@/lib/ashare/strategies/tsmom';
import type { StrategyAction } from '@/lib/ashare/strategies/types';

export type Decision = {
  regime: MarketRegime;
  regime_confidence: number;
  strategy: 'TSMOM' | 'MEAN_REVERSION' | 'RISK_OFF';
  action: StrategyAction;
  position_cap: number;
  scores: { trend: number; range: number; panic: number };
  metrics: Record<string, number>;
  external_signals: {
    news?: { score: number; confidence: number; ts: number };
    realtime?: { volSurprise: number; amtSurprise: number; ts: number };
  };
  reasons: string[];
  serverTime: number;
  external_used: { news: boolean; realtime: boolean };
};

export type DecisionInputs = {
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '30m' | '60m' | '1d';
  bars: Bar[];
  config: StrategyConfig;
  userId: string;
  providers?: {
    news?: NewsProvider[];
    realtime?: RealtimeProvider[];
  };
  overrides?: {
    mockNewsScore?: number;
    mockNewsConfidence?: number;
  };
};

const decisionCooldown = new Map<string, { ts: number; action: StrategyAction }>();
const COOLDOWN_MS = 30_000;
const NEWS_STALE_MS = 4 * 60 * 60 * 1000;
const REALTIME_STALE_MS: Record<'1m' | '5m', number> = { '1m': 3 * 60 * 1000, '5m': 6 * 60 * 1000 };

function pickStrategy(regime: MarketRegime): 'TSMOM' | 'MEAN_REVERSION' | 'RISK_OFF' {
  if (regime === 'TREND') return 'TSMOM';
  if (regime === 'PANIC') return 'RISK_OFF';
  return 'MEAN_REVERSION';
}

async function getNewsSignal(symbol: string, providers: NewsProvider[]): Promise<NewsSignal | null> {
  for (const p of providers) {
    const res = await p.getNewsSignal({ symbol });
    if (res) return res;
  }
  return null;
}

async function getRealtimeSignal(
  symbol: string,
  timeframe: '1m' | '5m',
  providers: RealtimeProvider[]
): Promise<RealtimeSignal | null> {
  for (const p of providers) {
    const res = await p.getRealtimeSignal({ symbol, timeframe });
    if (res) return res;
  }
  return null;
}

export async function getDecision(inputs: DecisionInputs): Promise<Decision> {
  const symbol = normalizeSymbol(inputs.symbol);
  const { timeframe, bars, config, userId } = inputs;

  const newsProviders =
    inputs.providers?.news ??
    [
      new DbNewsProvider(),
      new ExternalNewsProvider(),
      new MockNewsProvider({ score: inputs.overrides?.mockNewsScore, confidence: inputs.overrides?.mockNewsConfidence }),
    ];
  const realtimeProviders = inputs.providers?.realtime ?? [new BarsRealtimeProvider()];

  let news = await getNewsSignal(symbol, newsProviders);
  let realtime: RealtimeSignal | null = null;
  if (timeframe === '1m' || timeframe === '5m') {
    realtime = await getRealtimeSignal(symbol, timeframe, realtimeProviders);
  } else {
    realtime = await getRealtimeSignal(symbol, '1m', realtimeProviders);
  }

  const now = Date.now();
  const newsUnavailable = !news || now - news.ts > NEWS_STALE_MS;
  if (newsUnavailable) news = null;
  const realtimeUnavailable = !realtime || now - realtime.ts > REALTIME_STALE_MS[timeframe === '5m' ? '5m' : '1m'];
  if (realtimeUnavailable) realtime = null;

  const { default: DecisionSnapshot } = await import('@/database/models/DecisionSnapshot');
  const lastSnapshot = await DecisionSnapshot.findOne({ userId, symbol, timeframe }).sort({ ts: -1 }).lean();
  const lastRegime = (lastSnapshot?.regime as MarketRegime | undefined) ?? null;

  const regimeRes = detectRegime({ bars, news, realtime, config, lastRegime });

  const strategyKey = pickStrategy(regimeRes.regime);
  let strategyDecision =
    strategyKey === 'TSMOM'
      ? tsmomStrategy({ bars, config })
      : strategyKey === 'MEAN_REVERSION'
        ? meanReversionStrategy({ bars, config })
        : riskOffStrategy({ bars, config });

  const reasons: string[] = [...regimeRes.reasons, ...strategyDecision.reasons];
  if (newsUnavailable) reasons.push('News signal unavailable (missing or stale) -> fallback to Kline');
  if (realtimeUnavailable) reasons.push('Realtime signal unavailable (missing or stale) -> fallback to Kline');

  // Execution guards
  const amountArr = bars.map((b) => (b.amount == null ? NaN : Number(b.amount)));
  const volumeArr = bars.map((b) => Number(b.volume));
  const lastAmount = amountArr[amountArr.length - 1];
  const lastVolume = volumeArr[volumeArr.length - 1];
  const amountAvg = amountArr.slice(-20).filter(Number.isFinite).reduce((a, b) => a + b, 0) / Math.max(1, amountArr.slice(-20).filter(Number.isFinite).length);
  const volumeAvg = volumeArr.slice(-20).reduce((a, b) => a + b, 0) / Math.max(1, volumeArr.slice(-20).length);

  if (Number.isFinite(lastAmount) && Number.isFinite(amountAvg) && amountAvg > 0) {
    const ratio = lastAmount / amountAvg;
    if (ratio < config.thresholds.minLiquidityAmountRatio) {
      reasons.push(`Liquidity filter: amount ratio ${ratio.toFixed(2)} < ${config.thresholds.minLiquidityAmountRatio}`);
      strategyDecision = { action: 'HOLD', reasons: strategyDecision.reasons };
    }
  } else if (Number.isFinite(lastVolume) && Number.isFinite(volumeAvg) && volumeAvg > 0) {
    const ratio = lastVolume / volumeAvg;
    const minVol = config.thresholds.minLiquidityVolumeRatio ?? config.thresholds.minLiquidityAmountRatio;
    if (ratio < minVol) {
      reasons.push(`Liquidity filter: volume ratio ${ratio.toFixed(2)} < ${minVol}`);
      strategyDecision = { action: 'HOLD', reasons: strategyDecision.reasons };
    }
  }

  const last = decisionCooldown.get(symbol);
  if (last && now - last.ts < COOLDOWN_MS && strategyDecision.action !== 'HOLD') {
    reasons.push('Cooldown active: hold to avoid over-trading');
    strategyDecision = { action: 'HOLD', reasons: strategyDecision.reasons };
  }

  const volRatio = regimeRes.metrics.volRatio ?? 0;
  if (volRatio < config.thresholds.volRatioLow && strategyDecision.action !== 'HOLD') {
    reasons.push('Cost filter: low volume regime, hold');
    strategyDecision = { action: 'HOLD', reasons: strategyDecision.reasons };
  }

  if (regimeRes.regime === 'PANIC' && strategyDecision.action === 'BUY') {
    reasons.push('PANIC regime: BUY disabled');
    strategyDecision = { action: 'HOLD', reasons: strategyDecision.reasons };
  }

  if (strategyDecision.action !== 'HOLD') {
    decisionCooldown.set(symbol, { ts: now, action: strategyDecision.action });
  }

  const positionCap =
    regimeRes.regime === 'TREND' ? config.positionCaps.trend : regimeRes.regime === 'RANGE' ? config.positionCaps.range : config.positionCaps.panic;

  const dedupedReasons = Array.from(new Set(reasons)).slice(0, 5);
  const decision: Decision = {
    regime: regimeRes.regime,
    regime_confidence: regimeRes.confidence,
    strategy: strategyKey,
    action: strategyDecision.action,
    position_cap: positionCap,
    scores: regimeRes.scores,
    metrics: regimeRes.metrics,
    external_signals: {
      news: news ? { score: news.score, confidence: news.confidence, ts: news.ts } : undefined,
      realtime: realtime ? { volSurprise: realtime.volSurprise, amtSurprise: realtime.amtSurprise, ts: realtime.ts } : undefined,
    },
    reasons: dedupedReasons,
    serverTime: now,
    external_used: { news: Boolean(news), realtime: Boolean(realtime) },
  };

  if (!lastSnapshot || now - lastSnapshot.ts > 60_000) {
    await DecisionSnapshot.create({
      userId,
      symbol,
      timeframe,
      ts: now,
      regime: decision.regime,
      strategy: decision.strategy,
      action: decision.action,
      confidence: decision.regime_confidence,
      position_cap: decision.position_cap,
      metrics: decision.metrics,
      external_signals: decision.external_signals,
    });
  }

  return decision;
}
