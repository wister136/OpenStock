// Pure strategy calculations (no React)
import type { OHLCVBar } from '@/lib/indicators';
import { bollingerBands, ema, lastFinite, macd, rollingMax, rollingMin, rsi, sma } from '@/lib/indicators';
import { tRuntime } from '@/lib/i18n/runtime';

import type { StrategyKey, StrategyParams, StrategySignal, Marker, OverlayMarker } from '../types';
import { DEFAULT_STRATEGY_PARAMS } from '../types';

export function computeStrategySignals(strategy: StrategyKey, bars: OHLCVBar[], params: StrategyParams = DEFAULT_STRATEGY_PARAMS): StrategySignal[] {
  if (!bars.length || strategy === 'none') return [];

  const closes = bars.map((b) => b.c);
  const out: StrategySignal[] = [];

  const vols = bars.map((b) => b.v);
  const f = params?.filters ?? DEFAULT_STRATEGY_PARAMS.filters;

  const filterEma = f?.trendEmaLen ? ema(closes, Math.max(2, Math.floor(f.trendEmaLen))) : [];
  const volSma = f?.volLookback ? sma(vols, Math.max(1, Math.floor(f.volLookback))) : [];

  // Helpers (local to strategy calc)
  const highsArr = bars.map((b) => b.h);
  const lowsArr = bars.map((b) => b.l);

  // ADX (trend strength) helper (Wilder's smoothing)
  const computeAdx = (highs: number[], lows: number[], closes: number[], len: number) => {
    const n = highs.length;
    const out: number[] = new Array(n).fill(NaN);
    if (n < len * 2 + 1) return out;

    const tr: number[] = new Array(n).fill(NaN);
    const plusDM: number[] = new Array(n).fill(0);
    const minusDM: number[] = new Array(n).fill(0);

    for (let i = 1; i < n; i++) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
      minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;

      const h = highs[i];
      const l = lows[i];
      const pc = closes[i - 1];
      if (![h, l, pc].every((x) => Number.isFinite(x))) continue;
      tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }

    // Wilder smoothing for TR and DM
    let tr14 = 0;
    let p14 = 0;
    let m14 = 0;
    for (let i = 1; i <= len; i++) {
      if (!Number.isFinite(tr[i])) return out;
      tr14 += tr[i];
      p14 += plusDM[i];
      m14 += minusDM[i];
    }

    const plusDI: number[] = new Array(n).fill(NaN);
    const minusDI: number[] = new Array(n).fill(NaN);
    const dx: number[] = new Array(n).fill(NaN);

    const calcDI = (p: number, m: number, t: number, i: number) => {
      if (!(t > 0)) return;
      const pdi = (100 * p) / t;
      const mdi = (100 * m) / t;
      plusDI[i] = pdi;
      minusDI[i] = mdi;
      const denom = pdi + mdi;
      if (denom <= 0) return;
      dx[i] = (100 * Math.abs(pdi - mdi)) / denom;
    };

    // First DI/DX point at i=len
    calcDI(p14, m14, tr14, len);

    for (let i = len + 1; i < n; i++) {
      const curTr = tr[i];
      if (!Number.isFinite(curTr)) continue;
      tr14 = tr14 - tr14 / len + curTr;
      p14 = p14 - p14 / len + plusDM[i];
      m14 = m14 - m14 / len + minusDM[i];
      calcDI(p14, m14, tr14, i);
    }

    // ADX smoothing over DX
    let adxSum = 0;
    for (let i = len; i < len * 2; i++) {
      if (!Number.isFinite(dx[i])) return out;
      adxSum += dx[i];
    }
    let adx = adxSum / len;
    out[len * 2 - 1] = adx;

    for (let i = len * 2; i < n; i++) {
      const curDx = dx[i];
      if (!Number.isFinite(curDx) || !Number.isFinite(adx)) continue;
      adx = (adx * (len - 1) + curDx) / len;
      out[i] = adx;
    }

    return out;
  };

  const atr = (period: number) => {
    const out: number[] = new Array(bars.length).fill(NaN);
    if (bars.length < period + 1) return out;
    const tr: number[] = new Array(bars.length).fill(NaN);
    for (let i = 1; i < bars.length; i++) {
      const h = highsArr[i];
      const l = lowsArr[i];
      const pc = closes[i - 1];
      if (![h, l, pc].every((x) => Number.isFinite(x))) continue;
      const v = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      tr[i] = v;
    }
    // Wilder smoothing
    let sum = 0;
    for (let i = 1; i <= period; i++) {
      if (!Number.isFinite(tr[i])) return out;
      sum += tr[i];
    }
    out[period] = sum / period;
    for (let i = period + 1; i < bars.length; i++) {
      const prev = out[i - 1];
      const curTr = tr[i];
      if (!Number.isFinite(prev) || !Number.isFinite(curTr)) continue;
      out[i] = (prev * (period - 1) + curTr) / period;
    }
    return out;
  };

  // ATR% regime filter (optional)
  const atrFilterLen = Math.max(2, Math.floor(f?.atrLen ?? 14));
  const atrArr = f?.enable ? atr(atrFilterLen) : [];

  // ADX filter arrays (only computed when enabled and threshold > 0)
  const adxLen = Math.max(2, Math.floor(f?.adxLen ?? 14));
  const minAdx = Number(f?.minAdx ?? 0);
  const adxArr = f?.enable && minAdx > 0 ? computeAdx(highsArr, lowsArr, closes, adxLen) : [];

  let lastBuyIdx = -1e9;

  const filterApplicable = (key: StrategyKey) =>
    [
      'maCross',
      'emaTrend',
      'macdCross',
      'bollingerBreakout',
      'channelBreakout',
      'supertrend',
      'atrBreakout',
      'turtle',
      'ichimoku',
      'kdj',
    ].includes(key);

  const shouldAcceptBuy = (i: number): boolean => {
    // Only enforce strict filters when the user enables them in UI.
    // If filters are disabled, never block signals here.
    if (!f?.enable) return true;

    const close = closes[i];

    // Trend confirmation: price above EMA
    const e = filterEma?.[i];
    if (f.requireAboveEma && Number.isFinite(e) && Number.isFinite(close) && close < e) return false;

    // EMA slope confirmation
    if (f.requireEmaSlopeUp) {
      const lookback = Math.max(1, Math.floor(f.emaSlopeLookback || 1));
      const j = Math.max(0, i - lookback);
      const eNow = filterEma?.[i];
      const ePrev = filterEma?.[j];
      if (Number.isFinite(eNow) && Number.isFinite(ePrev) && eNow <= ePrev) return false;
    }

    // Volume confirmation
    const vv = vols[i];
    const vs = volSma?.[i];

    // Soft floor: only reject *extreme* illiquidity (e.g., data gaps / zero volume).
    // (Relaxed from prior versions; threshold 5% of average volume.)
    const floorPct = Number(f.volFloorPct ?? 5);
    if (floorPct > 0 && Number.isFinite(vs) && vs > 0 && Number.isFinite(vv) && vv < vs * (floorPct / 100)) return false;

    // Optional volume burst confirmation
    if (f.volMult > 0 && Number.isFinite(vv) && Number.isFinite(vs) && vv < vs * f.volMult) return false;

    // ADX trend strength confirmation (optional)
    // When minAdx > 0, require current ADX >= threshold to open new BUY signals.
    const minA = Number(f.minAdx ?? 0);
    if (minA > 0) {
      const a = adxArr?.[i];
      if (!Number.isFinite(a) || a < minA) return false;
    }

    // Volatility regime filter (ATR%): avoid too-choppy & too-violent bars
    const a = atrArr?.[i];
    const minAtrPct = Number(f.minAtrPct ?? 0);
    const maxAtrPct = Number(f.maxAtrPct ?? 0);
    if (Number.isFinite(a) && a > 0 && Number.isFinite(close) && close > 0) {
      const atrPct = (a / close) * 100;
      if (minAtrPct > 0 && atrPct < minAtrPct) return false;
      if (maxAtrPct > 0 && atrPct > maxAtrPct) return false;
    }

    // Simple de-noise: avoid buy clusters in choppy markets
    const gap = Math.max(0, Math.floor(f.minBarsBetweenBuys ?? 0));
    if (gap > 0 && i - lastBuyIdx < gap) return false;

    return true;
  };

  const push = (i: number, side: 'BUY' | 'SELL', reason: string) => {
    if (i <= 0 || i >= bars.length) return;
    const t = bars[i]?.t;
    if (!Number.isFinite(t)) return;

    if (side === 'BUY' && filterApplicable(strategy)) {
      if (!shouldAcceptBuy(i)) return;
      lastBuyIdx = i;
    }

    out.push({ index: i, side, reason });
  };



  if (strategy === 'maCross') {
    const ma5 = sma(closes, 5);
    const ma20 = sma(closes, 20);
    for (let i = 1; i < bars.length; i++) {
      const p5 = ma5[i - 1];
      const p20 = ma20[i - 1];
      const c5 = ma5[i];
      const c20 = ma20[i];
      if (![p5, p20, c5, c20].every((x) => Number.isFinite(x))) continue;
      if (p5 <= p20 && c5 > c20) push(i, 'BUY', tRuntime('strategy.reason.maUp'));
      if (p5 >= p20 && c5 < c20) push(i, 'SELL', tRuntime('strategy.reason.maDown'));
    }
  }

  if (strategy === 'emaTrend') {
    const e20 = ema(closes, 20);
    for (let i = 1; i < bars.length; i++) {
      const pClose = closes[i - 1];
      const cClose = closes[i];
      const pE = e20[i - 1];
      const cE = e20[i];
      if (![pClose, cClose, pE, cE].every((x) => Number.isFinite(x))) continue;
      if (pClose <= pE && cClose > cE) push(i, 'BUY', tRuntime('strategy.reason.emaUp'));
      if (pClose >= pE && cClose < cE) push(i, 'SELL', tRuntime('strategy.reason.emaDown'));
    }
  }

  if (strategy === 'macdCross') {
    const m = macd(closes, 12, 26, 9);
    for (let i = 1; i < bars.length; i++) {
      const p = m.macd[i - 1];
      const ps = m.signal[i - 1];
      const c = m.macd[i];
      const cs = m.signal[i];
      if (![p, ps, c, cs].every((x) => Number.isFinite(x))) continue;
      if (p <= ps && c > cs) push(i, 'BUY', tRuntime('strategy.reason.macdUp'));
      if (p >= ps && c < cs) push(i, 'SELL', tRuntime('strategy.reason.macdDown'));
    }
  }

  if (strategy === 'rsiReversion') {
    const r14 = rsi(closes, 14);
    for (let i = 1; i < bars.length; i++) {
      const p = r14[i - 1];
      const c = r14[i];
      if (![p, c].every((x) => Number.isFinite(x))) continue;
      if (p < 30 && c >= 30) push(i, 'BUY', tRuntime('strategy.reason.rsiUp30'));
      if (p > 70 && c <= 70) push(i, 'SELL', tRuntime('strategy.reason.rsiDown70'));
    }
  }

  if (strategy === 'rsiMomentum') {
    const r14 = rsi(closes, 14);
    for (let i = 1; i < bars.length; i++) {
      const p = r14[i - 1];
      const c = r14[i];
      if (![p, c].every((x) => Number.isFinite(x))) continue;
      if (p < 50 && c >= 50) push(i, 'BUY', tRuntime('strategy.reason.rsiUp50'));
      if (p > 50 && c <= 50) push(i, 'SELL', tRuntime('strategy.reason.rsiDown50'));
    }
  }

  if (strategy === 'bollingerBreakout') {
    const bb = bollingerBands(closes, 20, 2);
    for (let i = 1; i < bars.length; i++) {
      const pClose = closes[i - 1];
      const cClose = closes[i];
      const pU = bb.upper[i - 1];
      const cU = bb.upper[i];
      const pL = bb.lower[i - 1];
      const cL = bb.lower[i];
      if (![pClose, cClose, pU, cU, pL, cL].every((x) => Number.isFinite(x))) continue;
      if (pClose <= pU && cClose > cU) push(i, 'BUY', tRuntime('strategy.reason.bbUp'));
      if (pClose >= pL && cClose < cL) push(i, 'SELL', tRuntime('strategy.reason.bbDown'));
    }
  }

  if (strategy === 'bollingerReversion') {
    const bb = bollingerBands(closes, 20, 2);
    for (let i = 1; i < bars.length; i++) {
      const pClose = closes[i - 1];
      const cClose = closes[i];
      const pL = bb.lower[i - 1];
      const cL = bb.lower[i];
      const pM = bb.mid[i - 1];
      const cM = bb.mid[i];
      if (![pClose, cClose, pL, cL, pM, cM].every((x) => Number.isFinite(x))) continue;
      // BUY when crosses below lower band; SELL when crosses above middle band
      if (pClose >= pL && cClose < cL) push(i, 'BUY', tRuntime('strategy.reason.bbRevertBuy'));
      if (pClose <= pM && cClose > cM) push(i, 'SELL', tRuntime('strategy.reason.bbRevertSell'));
    }
  }

  if (strategy === 'channelBreakout') {
    const period = 20;
    const highs = bars.map((b) => b.h);
    const lows = bars.map((b) => b.l);
    const rollHigh = rollingMax(highs, period);
    const rollLow = rollingMin(lows, period);
    for (let i = 1; i < bars.length; i++) {
      const prevHigh = rollHigh[i - 1];
      const prevLow = rollLow[i - 1];
      const cClose = closes[i];
      if (![prevHigh, prevLow, cClose].every((x) => Number.isFinite(x))) continue;
      if (cClose > prevHigh) push(i, 'BUY', tRuntime('strategy.reason.channelUp', { period }));
      if (cClose < prevLow) push(i, 'SELL', tRuntime('strategy.reason.channelDown', { period }));
    }
  }


  // ===== New strategies: SuperTrend / ATR Breakout / Turtle / Ichimoku / KDJ =====

  if (strategy === 'supertrend') {
    const period = Math.max(2, Math.floor(params.supertrend.atrLen));
    const mult = Math.max(0.1, Number(params.supertrend.mult));
    const atrArr = atr(period);

    const upper: number[] = new Array(bars.length).fill(NaN);
    const lower: number[] = new Array(bars.length).fill(NaN);
    const fUpper: number[] = new Array(bars.length).fill(NaN);
    const fLower: number[] = new Array(bars.length).fill(NaN);
    const trend: number[] = new Array(bars.length).fill(0); // 1 up, -1 down

    for (let i = 0; i < bars.length; i++) {
      const h = highsArr[i];
      const l = lowsArr[i];
      const a = atrArr[i];
      if (![h, l, a].every((x) => Number.isFinite(x))) continue;
      const hl2 = (h + l) / 2;
      upper[i] = hl2 + mult * a;
      lower[i] = hl2 - mult * a;

      if (i === 0) continue;

      // final bands
      fUpper[i] = Number.isFinite(fUpper[i - 1]) && closes[i - 1] <= fUpper[i - 1] ? Math.min(upper[i], fUpper[i - 1]) : upper[i];
      fLower[i] = Number.isFinite(fLower[i - 1]) && closes[i - 1] >= fLower[i - 1] ? Math.max(lower[i], fLower[i - 1]) : lower[i];

      // trend switch
      if (trend[i - 1] === 0) {
        trend[i] = closes[i] >= fUpper[i] ? 1 : closes[i] <= fLower[i] ? -1 : 1;
      } else if (trend[i - 1] === 1) {
        trend[i] = closes[i] < fLower[i] ? -1 : 1;
      } else {
        trend[i] = closes[i] > fUpper[i] ? 1 : -1;
      }

      if (trend[i - 1] === -1 && trend[i] === 1) push(i, 'BUY', tRuntime('strategy.reason.supertrendUp'));
      if (trend[i - 1] === 1 && trend[i] === -1) push(i, 'SELL', tRuntime('strategy.reason.supertrendDown'));
    }
  }

  if (strategy === 'atrBreakout') {
    // Donchian + ATR buffer (parametrized)
    const donch = Math.max(5, Math.floor(params.atrBreakout.donLen));
    const atrLen = Math.max(2, Math.floor(params.atrBreakout.atrLen));
    const k = Math.max(0, Number(params.atrBreakout.atrMult));

    const atrArr = atr(atrLen);
    const rollHigh = rollingMax(highsArr, donch);
    const rollLow = rollingMin(lowsArr, donch);

    for (let i = 1; i < bars.length; i++) {
      const ph = rollHigh[i - 1];
      const pl = rollLow[i - 1];
      const a = atrArr[i - 1];
      const c = closes[i];
      const pc = closes[i - 1];
      if (![ph, pl, a, c, pc].every((x) => Number.isFinite(x))) continue;

      const up = ph + k * a;
      const dn = pl - k * a;

      // Require a real break (avoid repeating signals every bar)
      const upBuffer = k > 0 ? tRuntime('strategy.reason.atrBufferPlus') : '';
      const downBuffer = k > 0 ? tRuntime('strategy.reason.atrBufferMinus') : '';
      if (pc <= up && c > up) push(i, 'BUY', tRuntime('strategy.reason.atrUp', { period: donch, buffer: upBuffer }));
      if (pc >= dn && c < dn) push(i, 'SELL', tRuntime('strategy.reason.atrDown', { period: donch, buffer: downBuffer }));
    }
  }

  if (strategy === 'turtle') {
    // Turtle (long-only, simplified): break entryN high to enter; break exitN low to exit.
    const entryN = Math.max(10, Math.floor(params.turtle.entryLen));
    const exitN = Math.max(5, Math.floor(params.turtle.exitLen));

    const rollEntryHigh = rollingMax(highsArr, entryN);
    const rollExitLow = rollingMin(lowsArr, exitN);

    for (let i = 1; i < bars.length; i++) {
      const c = closes[i];
      const pc = closes[i - 1];
      const eh = rollEntryHigh[i - 1];
      const xl = rollExitLow[i - 1];
      if (![c, pc, eh, xl].every((x) => Number.isFinite(x))) continue;

      if (pc <= eh && c > eh) push(i, 'BUY', tRuntime('strategy.reason.turtleUp', { period: entryN }));
      if (pc >= xl && c < xl) push(i, 'SELL', tRuntime('strategy.reason.turtleDown', { period: exitN }));
    }
  }

  if (strategy === 'ichimoku') {
    // Ichimoku simplified (no forward shift): use current spans
    const highs = highsArr;
    const lows = lowsArr;

    const mid = (h: number[], l: number[], n: number) => {
      const hh = rollingMax(h, n);
      const ll = rollingMin(l, n);
      return hh.map((v, i) => (Number.isFinite(v) && Number.isFinite(ll[i]) ? (v + ll[i]) / 2 : NaN));
    };

    const tenkan = mid(highs, lows, 9);
    const kijun = mid(highs, lows, 26);
    const spanB = mid(highs, lows, 52);
    const spanA = tenkan.map((v, i) => (Number.isFinite(v) && Number.isFinite(kijun[i]) ? (v + kijun[i]) / 2 : NaN));

    for (let i = 1; i < bars.length; i++) {
      const c = closes[i];
      const a = spanA[i];
      const b = spanB[i];
      const tk = tenkan[i];
      const kj = kijun[i];
      if (![c, a, b, tk, kj].every((x) => Number.isFinite(x))) continue;

      const cloudTop = Math.max(a, b);
      const cloudBot = Math.min(a, b);

      const prevC = closes[i - 1];
      const prevTop = Math.max(spanA[i - 1], spanB[i - 1]);
      const prevBot = Math.min(spanA[i - 1], spanB[i - 1]);

      // Buy: break above cloud & tk>kj
      if (prevC <= prevTop && c > cloudTop && tk > kj) push(i, 'BUY', tRuntime('strategy.reason.ichimokuUp'));
      // Sell: break below cloud & tk<kj
      if (prevC >= prevBot && c < cloudBot && tk < kj) push(i, 'SELL', tRuntime('strategy.reason.ichimokuDown'));
    }
  }

  if (strategy === 'kdj') {
    // KDJ (9,3,3) simplified
    const n = 9;
    const hh = rollingMax(highsArr, n);
    const ll = rollingMin(lowsArr, n);

    const rsv: number[] = new Array(bars.length).fill(NaN);
    for (let i = 0; i < bars.length; i++) {
      const h = hh[i];
      const l = ll[i];
      const c = closes[i];
      if (![h, l, c].every((x) => Number.isFinite(x))) continue;
      const denom = h - l;
      rsv[i] = denom === 0 ? 50 : ((c - l) / denom) * 100;
    }

    const K: number[] = new Array(bars.length).fill(NaN);
    const D: number[] = new Array(bars.length).fill(NaN);
    const J: number[] = new Array(bars.length).fill(NaN);

    let kPrev = 50;
    let dPrev = 50;
    for (let i = 0; i < bars.length; i++) {
      const v = rsv[i];
      if (!Number.isFinite(v)) continue;
      const k = (2 / 3) * kPrev + (1 / 3) * v;
      const d = (2 / 3) * dPrev + (1 / 3) * k;
      const j = 3 * k - 2 * d;
      K[i] = k;
      D[i] = d;
      J[i] = j;
      kPrev = k;
      dPrev = d;
    }

    for (let i = 1; i < bars.length; i++) {
      const pk = K[i - 1];
      const pd = D[i - 1];
      const ck = K[i];
      const cd = D[i];
      if (![pk, pd, ck, cd].every((x) => Number.isFinite(x))) continue;

      const crossUp = pk <= pd && ck > cd;
      const crossDn = pk >= pd && ck < cd;

      if (crossUp && ck < 30) push(i, 'BUY', tRuntime('strategy.reason.kdjUp'));
      if (crossDn && ck > 70) push(i, 'SELL', tRuntime('strategy.reason.kdjDown'));
    }
  }


  return out;
}

export function buildStrategyMarkers(strategy: StrategyKey, bars: OHLCVBar[], params: StrategyParams = DEFAULT_STRATEGY_PARAMS) {
  if (!bars.length || strategy === 'none') return { markers: [] as Marker[], status: null as string | null };

  const signals = computeStrategySignals(strategy, bars, params);

  const markers: Marker[] = signals
    .map((s, idx) => {
      const t0 = bars[s.index]?.t;
      if (!Number.isFinite(t0)) return null;

      return {
        time: t0,
        side: s.side,
        position: s.side === 'BUY' ? 'belowBar' : 'aboveBar',
        shape: s.side === 'BUY' ? 'arrowUp' : 'arrowDown',
        color: s.side === 'BUY' ? '#ef4444' : '#22c55e',
        text: s.side === 'BUY' ? tRuntime('strategy.marker.buy') : tRuntime('strategy.marker.sell'),
        reason: s.reason,
      } as Marker;
    })
    .filter(Boolean) as Marker[];

  let statusBase: string | null = null;
  if (strategy === 'maCross') statusBase = tRuntime('strategy.status.ma');
  if (strategy === 'emaTrend') statusBase = tRuntime('strategy.status.ema');
  if (strategy === 'macdCross') statusBase = tRuntime('strategy.status.macd');
  if (strategy === 'rsiReversion') statusBase = tRuntime('strategy.status.rsiRev');
  if (strategy === 'rsiMomentum') statusBase = tRuntime('strategy.status.rsiMom');
  if (strategy === 'bollingerBreakout') statusBase = tRuntime('strategy.status.bbBreak');
  if (strategy === 'bollingerReversion') statusBase = tRuntime('strategy.status.bbRevert');
  if (strategy === 'channelBreakout') statusBase = tRuntime('strategy.status.channel');

  const count = markers.length;
  let status = statusBase;
  if (status) {
    status = `${status}${count === 0 ? tRuntime('strategy.status.noSignal') : ''}${tRuntime('strategy.status.count', { count })}`;
    if (count > 0) {
      const last = markers[count - 1];
      try {
        status += tRuntime('strategy.status.last', { text: last.text, time: new Date((last.time as any) * 1000).toLocaleString() });
      } catch (e) {}
    }
    status += tRuntime('strategy.status.backtestHint');
  }

  return { markers, status };
}
