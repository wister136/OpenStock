// Pure strategy calculations (no React)
import type { OHLCVBar } from '@/lib/indicators';
import { bollingerBands, ema, lastFinite, macd, rollingMax, rollingMin, rsi, sma } from '@/lib/indicators';

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
    if (f.volMult > 0 && Number.isFinite(vv) && Number.isFinite(vs) && vv < vs * f.volMult) return false;

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
      if (p5 <= p20 && c5 > c20) push(i, 'BUY', 'MA5 上穿 MA20');
      if (p5 >= p20 && c5 < c20) push(i, 'SELL', 'MA5 下穿 MA20');
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
      if (pClose <= pE && cClose > cE) push(i, 'BUY', '收盘上穿 EMA20');
      if (pClose >= pE && cClose < cE) push(i, 'SELL', '收盘下穿 EMA20');
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
      if (p <= ps && c > cs) push(i, 'BUY', 'MACD 金叉');
      if (p >= ps && c < cs) push(i, 'SELL', 'MACD 死叉');
    }
  }

  if (strategy === 'rsiReversion') {
    const r14 = rsi(closes, 14);
    for (let i = 1; i < bars.length; i++) {
      const p = r14[i - 1];
      const c = r14[i];
      if (![p, c].every((x) => Number.isFinite(x))) continue;
      if (p < 30 && c >= 30) push(i, 'BUY', 'RSI 上穿 30');
      if (p > 70 && c <= 70) push(i, 'SELL', 'RSI 下穿 70');
    }
  }

  if (strategy === 'rsiMomentum') {
    const r14 = rsi(closes, 14);
    for (let i = 1; i < bars.length; i++) {
      const p = r14[i - 1];
      const c = r14[i];
      if (![p, c].every((x) => Number.isFinite(x))) continue;
      if (p < 50 && c >= 50) push(i, 'BUY', 'RSI 上穿 50');
      if (p > 50 && c <= 50) push(i, 'SELL', 'RSI 下穿 50');
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
      if (pClose <= pU && cClose > cU) push(i, 'BUY', '突破上轨');
      if (pClose >= pL && cClose < cL) push(i, 'SELL', '跌破下轨');
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
      if (pClose >= pL && cClose < cL) push(i, 'BUY', '跌破下轨（均值回归）');
      if (pClose <= pM && cClose > cM) push(i, 'SELL', '回到中轨（均值回归）');
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
      if (cClose > prevHigh) push(i, 'BUY', `突破${period}根最高`);
      if (cClose < prevLow) push(i, 'SELL', `跌破${period}根最低`);
    }
  }


  // ===== 新增策略：SuperTrend / ATR Breakout / 海龟 / 一目 / KDJ =====

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

      if (trend[i - 1] === -1 && trend[i] === 1) push(i, 'BUY', 'SuperTrend 由空转多');
      if (trend[i - 1] === 1 && trend[i] === -1) push(i, 'SELL', 'SuperTrend 由多转空');
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
      if (pc <= up && c > up) push(i, 'BUY', `ATR突破：上破${donch}通道${k > 0 ? '+ATR缓冲' : ''}`);
      if (pc >= dn && c < dn) push(i, 'SELL', `ATR突破：下破${donch}通道${k > 0 ? '-ATR缓冲' : ''}`);
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

      if (pc <= eh && c > eh) push(i, 'BUY', `海龟入场：上破${entryN}高点`);
      if (pc >= xl && c < xl) push(i, 'SELL', `海龟出场：下破${exitN}低点`);
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
      if (prevC <= prevTop && c > cloudTop && tk > kj) push(i, 'BUY', '一目：上破云层且转强');
      // Sell: break below cloud & tk<kj
      if (prevC >= prevBot && c < cloudBot && tk < kj) push(i, 'SELL', '一目：下破云层且转弱');
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

      if (crossUp && ck < 30) push(i, 'BUY', 'KDJ：低位金叉');
      if (crossDn && ck > 70) push(i, 'SELL', 'KDJ：高位死叉');
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
        text: s.side === 'BUY' ? '买入' : '卖出',
        reason: s.reason,
      } as Marker;
    })
    .filter(Boolean) as Marker[];

  let statusBase: string | null = null;
  if (strategy === 'maCross') statusBase = 'MA5/MA20 交叉信号：MA5 上穿/下穿 MA20（买入/卖出）';
  if (strategy === 'emaTrend') statusBase = 'EMA20 趋势跟随：收盘上穿 EMA20 买入 / 下穿 EMA20 卖出';
  if (strategy === 'macdCross') statusBase = 'MACD 金叉/死叉：MACD 线上穿/下穿 Signal（买入/卖出）';
  if (strategy === 'rsiReversion') statusBase = 'RSI14 均值回归：上穿 30 买入 / 下穿 70 卖出';
  if (strategy === 'rsiMomentum') statusBase = 'RSI14 动量：上穿 50 买入 / 下穿 50 卖出';
  if (strategy === 'bollingerBreakout') statusBase = '布林带突破：突破上轨买入 / 跌破下轨卖出';
  if (strategy === 'bollingerReversion') statusBase = '布林带均值回归：跌破下轨买入 / 回到中轨卖出';
  if (strategy === 'channelBreakout') statusBase = '通道突破：突破前 20 根最高/最低 → 买入/卖出';

  const count = markers.length;
  let status = statusBase;
  if (status) {
    status = `${status}${count === 0 ? '（当前窗口无信号）' : ''}；信号数=${count}`;
    if (count > 0) {
      const last = markers[count - 1];
      try {
        status += `；最近=${last.text}@${new Date((last.time as any) * 1000).toLocaleString()}`;
      } catch (e) {}
    }
    status += '；回测请在弹窗“回测”页查看（下一根开盘成交）';
  }

  return { markers, status };
}
