import { ADX, ATR, EMA, RSI } from './indicators';
import type { Bar, ResonanceConfig, SignalResult, TrendFilterResult } from '@/types/resonance';

function lastFinite(arr: number[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (Number.isFinite(v)) return v;
  }
  return null;
}

export function computeDailyTrendFilter(bars: Bar[], config: ResonanceConfig): TrendFilterResult {
  const reasons: string[] = [];
  if (!bars || bars.length < 60) {
    return {
      trend: 'SIDEWAYS',
      bullishAllowed: false,
      bearishAllowed: false,
      metrics: { adx: NaN, ema20: NaN, close: NaN },
      reasons: ['Not enough daily bars for trend filter'],
    };
  }

  const close = bars.map((b) => Number(b.close));
  const high = bars.map((b) => Number(b.high));
  const low = bars.map((b) => Number(b.low));

  const ema20Arr = EMA(close, config.emaPeriod);
  const adxArr = ADX(high, low, close, 14);
  const ema20 = lastFinite(ema20Arr);
  const adx = lastFinite(adxArr);
  const lastClose = close.length ? close[close.length - 1] : NaN;

  const bullish = Number.isFinite(adx) && Number.isFinite(ema20) && adx! > config.adxThreshold && lastClose > ema20!;
  const bearish = Number.isFinite(adx) && Number.isFinite(ema20) && adx! > config.adxThreshold && lastClose < ema20!;

  if (bullish) reasons.push('Daily trend bullish');
  if (bearish) reasons.push('Daily trend bearish');
  if (!bullish && !bearish) reasons.push('Daily trend sideways');

  return {
    trend: bullish ? 'BULL' : bearish ? 'BEAR' : 'SIDEWAYS',
    bullishAllowed: bullish,
    bearishAllowed: bearish,
    metrics: { adx: adx ?? NaN, ema20: ema20 ?? NaN, close: lastClose },
    reasons,
  };
}

export function computeRsiReversionSignal(bars: Bar[], config: ResonanceConfig): SignalResult {
  const reasons: string[] = [];
  if (!bars || bars.length < config.minBars) {
    return {
      action: 'HOLD',
      score: 0,
      reasons: ['Not enough bars for RSI reversion'],
    };
  }

  const close = bars.map((b) => Number(b.close));
  const high = bars.map((b) => Number(b.high));
  const low = bars.map((b) => Number(b.low));
  const rsiArr = RSI(close, config.rsiPeriod);
  const emaArr = EMA(close, config.emaPeriod);
  const atrArr = ATR(high, low, close, config.atrPeriod);

  const rsi = lastFinite(rsiArr);
  const ema20 = lastFinite(emaArr);
  const atr = lastFinite(atrArr);
  const lastClose = close.length ? close[close.length - 1] : NaN;
  const prevRsi = rsiArr.length >= 2 ? rsiArr[rsiArr.length - 2] : NaN;

  if (!Number.isFinite(rsi) || !Number.isFinite(ema20) || !Number.isFinite(lastClose)) {
    return {
      action: 'HOLD',
      score: 0,
      reasons: ['Indicators not ready'],
      debug: { rsi: rsi ?? NaN, ema20: ema20 ?? NaN, close: lastClose, atr: atr ?? NaN },
    };
  }

  const crossUp = Number.isFinite(prevRsi) && prevRsi < config.rsiBuy && rsi! >= config.rsiBuy;
  const crossDown = Number.isFinite(prevRsi) && prevRsi > config.rsiSell && rsi! <= config.rsiSell;

  let action: SignalResult['action'] = 'HOLD';
  let score = 0;

  if ((rsi! < config.rsiBuy && lastClose >= ema20!) || crossUp) {
    action = 'BUY';
    const strength = Math.min(40, Math.max(0, (config.rsiBuy - rsi!) * 2));
    score = 60 + strength;
    reasons.push(crossUp ? 'RSI rebound above buy line' : 'RSI oversold with price support');
  } else if ((rsi! > config.rsiSell && lastClose <= ema20!) || crossDown) {
    action = 'SELL';
    const strength = Math.min(40, Math.max(0, (rsi! - config.rsiSell) * 2));
    score = 60 + strength;
    reasons.push(crossDown ? 'RSI drop below sell line' : 'RSI overbought with price weakness');
  } else {
    score = 35;
    reasons.push('RSI neutral');
  }

  return {
    action,
    score,
    reasons,
    debug: {
      rsi: rsi ?? NaN,
      ema20: ema20 ?? NaN,
      close: lastClose,
      atr: atr ?? NaN,
      atrPct: Number.isFinite(atr) && Number.isFinite(lastClose) && lastClose > 0 ? (atr! / lastClose) : NaN,
    },
  };
}

export function computeTrendFollowingSignal(bars: Bar[], config: ResonanceConfig): SignalResult {
  const reasons: string[] = [];
  if (!bars || bars.length < config.minBars) {
    return {
      action: 'HOLD',
      score: 0,
      reasons: ['Not enough bars for trend following'],
    };
  }

  const close = bars.map((b) => Number(b.close));
  const high = bars.map((b) => Number(b.high));
  const low = bars.map((b) => Number(b.low));
  const emaArr = EMA(close, config.emaPeriod);
  const adxArr = ADX(high, low, close, 14);
  const atrArr = ATR(high, low, close, config.atrPeriod);

  const ema20 = lastFinite(emaArr);
  const adx = lastFinite(adxArr);
  const atr = lastFinite(atrArr);
  const lastClose = close.length ? close[close.length - 1] : NaN;
  const slopeIdx = Math.max(0, emaArr.length - 1 - config.trendEmaSlopeLookback);
  const emaPrev = Number.isFinite(emaArr[slopeIdx]) ? emaArr[slopeIdx] : NaN;

  if (!Number.isFinite(ema20) || !Number.isFinite(adx) || !Number.isFinite(lastClose)) {
    return {
      action: 'HOLD',
      score: 0,
      reasons: ['Indicators not ready'],
      debug: { ema20: ema20 ?? NaN, adx: adx ?? NaN, close: lastClose, atr: atr ?? NaN },
    };
  }

  const emaUp = Number.isFinite(emaPrev) && ema20! > emaPrev;
  const emaDown = Number.isFinite(emaPrev) && ema20! < emaPrev;

  let action: SignalResult['action'] = 'HOLD';
  let score = 0;

  if (lastClose > ema20! && emaUp && adx! > config.trendAdxMin) {
    action = 'BUY';
    score = 60 + Math.min(40, adx! - config.trendAdxMin);
    reasons.push('Price above EMA and EMA rising');
  } else if (lastClose < ema20! && emaDown && adx! > config.trendAdxMin) {
    action = 'SELL';
    score = 60 + Math.min(40, adx! - config.trendAdxMin);
    reasons.push('Price below EMA and EMA falling');
  } else {
    score = 35;
    reasons.push('Trend not confirmed');
  }

  return {
    action,
    score,
    reasons,
    debug: {
      ema20: ema20 ?? NaN,
      close: lastClose,
      adx: adx ?? NaN,
      atr: atr ?? NaN,
      atrPct: Number.isFinite(atr) && Number.isFinite(lastClose) && lastClose > 0 ? (atr! / lastClose) : NaN,
    },
  };
}
