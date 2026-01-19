// Backtest engine (pure function, next-open execution model111)
import type { OHLCVBar } from '@/lib/indicators';
import { lastFinite } from '@/lib/indicators';
import { tRuntime } from '@/lib/i18n/runtime';

import type { StrategyKey, StrategyParams, StrategySignal, BacktestConfig, BacktestResult, BacktestTrade } from '../types';
import { DEFAULT_BACKTEST_CONFIG, DEFAULT_STRATEGY_PARAMS, DEFAULT_INITIAL_CAPITAL, FORCE_CLOSE_AT_END } from '../types';
import { computeStrategySignals } from './strategies';

export function runBacktestNextOpen(
  strategy: StrategyKey,
  bars: OHLCVBar[],
  initialCapital: number,
  cfg: BacktestConfig = DEFAULT_BACKTEST_CONFIG,
  params: StrategyParams = DEFAULT_STRATEGY_PARAMS
): BacktestResult {
  const cap = Number(initialCapital);
  if (!Number.isFinite(cap) || cap <= 0) {
    return {
      ok: false,
      error: tRuntime('backtest.error.invalidInitialCapital'),
      initialCapital: 0,
      finalEquity: 0,
      netProfit: 0,
      netProfitPct: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      trades: [],
      winRate: 0,
      profitFactor: null,
      avgTradePct: null,
      buyHoldPct: null,
      grossProfit: 0,
      grossLoss: 0,

      // Backtest model & assumptions（回测口径）
      model: cfg.model,
      lotSize: cfg.lotSize,
      feeBps: cfg.feeBps,
      slippageBps: cfg.slippageBps,
      allowPyramiding: cfg.allowPyramiding,
      allowSameDirectionRepeat: cfg.allowSameDirectionRepeat,
      orderLots: cfg.orderLots,
      maxEntries: cfg.maxEntries,
      forceCloseAtEnd: cfg.forceCloseAtEnd,

      barCount: bars.length,
      validBarCount: 0,
      tradeCount: 0,
      reliabilityLevel: tRuntime('reliability.level.low'),
      reliabilityNotes: [tRuntime('backtest.error.invalidInitialCapital')],

      buyHoldFinalEquity: null,
      buyHoldCagrPct: null,

      exposurePct: 0,
      avgWinPct: null,
      avgLossPct: null,
      expectancyPct: null,
      avgBarsHeld: null,
      maxBarsHeld: null,
      maxConsecWins: null,
      maxConsecLosses: null,

      equityCurve: [],
      drawdownPctCurve: [],

      cagrPct: null,
      sharpe: null,
      calmar: null,
      annualVolPct: null,
      sortino: null,
      ulcerIndex: null,
      recoveryFactor: null,

      maxDdDurationDays: null,
      maxDdStart: null,
      maxDdEnd: null,

      sampleStart: null,
      sampleEnd: null,
      sampleDays: null,

      monthlyReturns: [],
    };
  }

  if (!bars.length || strategy === 'none') {
    return {
      ok: false,
      error: tRuntime('backtest.error.noStrategy'),
      initialCapital: cap,
      finalEquity: cap,
      netProfit: 0,
      netProfitPct: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      trades: [],
      winRate: 0,
      profitFactor: null,
      avgTradePct: null,
      buyHoldPct: null,
      grossProfit: 0,
      grossLoss: 0,

      model: cfg.model,
      lotSize: cfg.lotSize,
      feeBps: cfg.feeBps,
      slippageBps: cfg.slippageBps,
      allowPyramiding: cfg.allowPyramiding,
      allowSameDirectionRepeat: cfg.allowSameDirectionRepeat,
      orderLots: cfg.orderLots,
      maxEntries: cfg.maxEntries,
      forceCloseAtEnd: cfg.forceCloseAtEnd,

      barCount: bars.length,
      validBarCount: bars.length,
      tradeCount: 0,
      reliabilityLevel: tRuntime('reliability.level.low'),
      reliabilityNotes: [tRuntime('backtest.error.noStrategy')],

      buyHoldFinalEquity: null,
      buyHoldCagrPct: null,

      exposurePct: 0,
      avgWinPct: null,
      avgLossPct: null,
      expectancyPct: null,
      avgBarsHeld: null,
      maxBarsHeld: null,
      maxConsecWins: null,
      maxConsecLosses: null,

      equityCurve: [],
      drawdownPctCurve: [],

      cagrPct: null,
      sharpe: null,
      calmar: null,
      annualVolPct: null,
      sortino: null,
      ulcerIndex: null,
      recoveryFactor: null,

      maxDdDurationDays: null,
      maxDdStart: null,
      maxDdEnd: null,

      sampleStart: null,
      sampleEnd: null,
      sampleDays: null,

      monthlyReturns: [],
    };
  }

  if (bars.length < 5) {
    return {
      ok: false,
      error: tRuntime('backtest.error.insufficientData'),
      initialCapital: cap,
      finalEquity: cap,
      netProfit: 0,
      netProfitPct: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      trades: [],
      winRate: 0,
      profitFactor: null,
      avgTradePct: null,
      buyHoldPct: null,
      grossProfit: 0,
      grossLoss: 0,

      model: cfg.model,
      lotSize: cfg.lotSize,
      feeBps: cfg.feeBps,
      slippageBps: cfg.slippageBps,
      allowPyramiding: cfg.allowPyramiding,
      allowSameDirectionRepeat: cfg.allowSameDirectionRepeat,
      orderLots: cfg.orderLots,
      maxEntries: cfg.maxEntries,
      forceCloseAtEnd: cfg.forceCloseAtEnd,

      barCount: bars.length,
      validBarCount: bars.length,
      tradeCount: 0,
      reliabilityLevel: tRuntime('reliability.level.low'),
      reliabilityNotes: [tRuntime('backtest.error.insufficientData')],

      buyHoldFinalEquity: null,
      buyHoldCagrPct: null,

      exposurePct: 0,
      avgWinPct: null,
      avgLossPct: null,
      expectancyPct: null,
      avgBarsHeld: null,
      maxBarsHeld: null,
      maxConsecWins: null,
      maxConsecLosses: null,

      equityCurve: [],
      drawdownPctCurve: [],

      cagrPct: null,
      sharpe: null,
      calmar: null,
      annualVolPct: null,
      sortino: null,
      ulcerIndex: null,
      recoveryFactor: null,

      maxDdDurationDays: null,
      maxDdStart: null,
      maxDdEnd: null,

      sampleStart: null,
      sampleEnd: null,
      sampleDays: null,

      monthlyReturns: [],
    };
  }

  const feeRate = Math.max(0, Number(cfg.feeBps) || 0) / 10000;
  const slipRate = Math.max(0, Number(cfg.slippageBps) || 0) / 10000;

  // --- Optional risk layer helpers (ATR-based) ---
  const computeATRSeries = (period: number): number[] => {
    const out: number[] = new Array(bars.length).fill(NaN);
    if (bars.length < period + 1) return out;
    let prevAtr = NaN;
    let sum = 0;
    for (let i = 1; i <= period; i++) {
      const h = bars[i]?.h;
      const l = bars[i]?.l;
      const pc = bars[i - 1]?.c;
      if (![h, l, pc].every((x) => Number.isFinite(x))) return out;
      const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      sum += tr;
    }
    prevAtr = sum / period;
    out[period] = prevAtr;
    for (let i = period + 1; i < bars.length; i++) {
      const h = bars[i]?.h;
      const l = bars[i]?.l;
      const pc = bars[i - 1]?.c;
      if (![h, l, pc].every((x) => Number.isFinite(x))) continue;
      const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      if (!Number.isFinite(prevAtr)) continue;
      prevAtr = (prevAtr * (period - 1) + tr) / period;
      out[i] = prevAtr;
    }
    return out;
  };


  // sample quality
  const barCount = bars.length;
  const validBarCount = bars.reduce((n, b) => {
    const ok = Number.isFinite(b?.t) && Number.isFinite(b?.o) && Number.isFinite(b?.c) && b.o > 0 && b.c > 0;
    return n + (ok ? 1 : 0);
  }, 0);

  // Map: signal at bar[i] close → execute at bar[i+1] open
  const signals = computeStrategySignals(strategy, bars, params);
  const sigByBarIndex = new Map<number, StrategySignal[]>();
  for (const s of signals) {
    const arr = sigByBarIndex.get(s.index) ?? [];
    arr.push(s);
    sigByBarIndex.set(s.index, arr);
  }

  let cash = cap;
  let qty = 0;
  let entryIndex = -1;
  let entryPrice = 0;
  let entryCost = 0;
  let entryTime = 0;
  let entryCount = 0; // number of entry fills (including adds)

  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [];
  const drawdownPctCurve: number[] = [];
  let holdBars = 0;

  // --- Risk state (optional) ---
  const risk = cfg.risk;
  const riskEnabled = !!risk?.enable;
  const atrLen = riskEnabled ? Math.max(2, Math.floor(risk?.atrLen ?? 14)) : 0;
  const atrArr = riskEnabled ? computeATRSeries(atrLen) : [];

  // Dynamic sizing (keeps each stop-out small -> higher PF & lower DD)
  // NOTE: "ALL_IN" is an explicit user choice and should override dynamic sizing.
  // Otherwise users will see "全仓复利" not taking effect.
  const dynamicSizingEnabled = riskEnabled && Boolean(risk?.dynamicSizing) && cfg.entryMode !== 'ALL_IN';
  const dynMinLots = dynamicSizingEnabled ? Math.max(1, Math.floor(risk?.dynMinLots ?? 1)) : 1;
  const dynMaxLots = dynamicSizingEnabled
    ? Math.max(dynMinLots, Math.floor(risk?.dynMaxLots ?? 10))
    : Math.max(1, Math.floor(cfg.orderLots ?? 1));

  const calcDynamicShares = (idx: number, buyPx: number, equityAtOpen: number, cashAvail: number): number => {
    // FIXED sizing: use cfg.orderLots * lotSize
    if (!dynamicSizingEnabled) {
      // ALL_IN sizing: spend ~99% available cash to buy shares (leave 1% buffer for slippage/fees)
      if (cfg.entryMode === 'ALL_IN') {
        const safeCash = Math.max(0, cashAvail) * 0.99;
        const affordable = Math.floor(safeCash / (buyPx * (1 + feeRate)) / cfg.lotSize) * cfg.lotSize;
        if (!Number.isFinite(affordable) || affordable <= 0) return 0;
        return affordable;
      }
      return Math.max(1, Math.floor(cfg.orderLots)) * cfg.lotSize;
    }
    const riskPct = Math.max(0, Number(risk?.riskPerTradePct ?? 0));
    const stopK = Math.max(0, Number(risk?.stopAtr ?? 0));
    const a = atrArr?.[Math.max(0, idx - 1)] ?? atrArr?.[idx];
    if (!(riskPct > 0) || !(stopK > 0) || !Number.isFinite(a) || a <= 0 || !Number.isFinite(buyPx) || buyPx <= 0) {
      return dynMinLots * cfg.lotSize;
    }

    // Risk = riskPct% of equity, stop distance = stopK * ATR
    const stopDist = stopK * a;
    if (!Number.isFinite(stopDist) || stopDist <= 0) return dynMinLots * cfg.lotSize;

    const riskAmount = Math.max(0, equityAtOpen) * (riskPct / 100);
    let shares = Math.floor((riskAmount / stopDist) / cfg.lotSize) * cfg.lotSize;
    const minShares = dynMinLots * cfg.lotSize;
    const maxShares = dynMaxLots * cfg.lotSize;
    shares = Math.max(minShares, Math.min(maxShares, shares));

    // In dynamic sizing mode, treat cfg.orderLots as a scaling factor so the UI/optimizer can meaningfully change size.
    const orderLotsFactor = Math.max(1, Math.floor(Number(cfg.orderLots ?? 1)));
    shares = Math.floor((shares * orderLotsFactor) / cfg.lotSize) * cfg.lotSize;
    shares = Math.max(minShares, Math.min(maxShares, shares));

    // Cash affordability
    const affordable = Math.floor(cashAvail / (buyPx * (1 + feeRate)) / cfg.lotSize) * cfg.lotSize;
    if (!Number.isFinite(affordable) || affordable <= 0) return 0;
    shares = Math.min(shares, affordable);
    if (shares < cfg.lotSize) return 0;
    return shares;
  };

  let stopPx = NaN;
  let takePx = NaN;
  let trailPx = NaN;
  let bestClose = NaN;
  let scale1Done = false;
  let scale2Done = false;
  let cooldownUntil = -1; // bar index: disallow entries while idx < cooldownUntil
  let circuitUntil = -1;  // drawdown circuit breaker pause

  // For smart pyramiding
  let lastAddPx = NaN;
  let lastAddIndex = -1;

  const resetRisk = () => {
    stopPx = NaN;
    takePx = NaN;
    trailPx = NaN;
    bestClose = NaN;
    scale1Done = false;
    scale2Done = false;
    lastAddPx = NaN;
    lastAddIndex = -1;
  };

  const initRiskOnEntry = (idx: number, px: number) => {
    if (!riskEnabled) return;
    const a = atrArr?.[Math.max(0, idx - 1)] ?? atrArr?.[idx];
    if (!Number.isFinite(a) || a <= 0) return;

    stopPx = px - Math.max(0, Number(risk?.stopAtr ?? 0)) * a;
    takePx = Number(risk?.takeAtr ?? 0) > 0 ? px + Math.max(0, Number(risk?.takeAtr ?? 0)) * a : NaN;

    // Trailing uses highest-close since entry
    bestClose = px;
    trailPx = Number(risk?.trailAtr ?? 0) > 0 ? px - Math.max(0, Number(risk?.trailAtr ?? 0)) * a : NaN;

    // Reset scale-out flags at new position
    scale1Done = false;
    scale2Done = false;

    lastAddPx = px;
    lastAddIndex = idx;
  };

  const doScaleOut = (idx: number, openPx: number, sellQty: number) => {
    // Partial sell at open (next-open model). Does NOT close the whole trade.
    if (sellQty <= 0 || sellQty >= qty) return;
    const px = openPx * (1 - slipRate);
    const proceeds = sellQty * px * (1 - feeRate);
    cash += proceeds;

    // Reduce remaining position cost proportionally so final PnL remains correct.
    const ratio = sellQty / (qty || 1);
    entryCost = entryCost * (1 - ratio);
    qty -= sellQty;
  };

  const effectiveStop = () => {
    // For long positions, use the tightest stop (highest price)
    const s = Number.isFinite(stopPx) ? stopPx : NaN;
    const t = Number.isFinite(trailPx) ? trailPx : NaN;
    if (Number.isFinite(s) && Number.isFinite(t)) return Math.max(s, t);
    if (Number.isFinite(s)) return s;
    if (Number.isFinite(t)) return t;
    return NaN;
  };

  const doExit = (idx: number, openPx: number, markOpen: boolean, reason: BacktestTrade['exitReason'] = 'Signal') => {
    const sellPx = openPx * (1 - slipRate);
    const exitTime = bars[idx]?.t;

    const proceeds = qty * sellPx * (1 - feeRate);
    const pnl = proceeds - entryCost;
    const pnlPct = entryCost > 0 ? (proceeds / entryCost - 1) * 100 : 0;

    trades.push({
      entryIndex,
      exitIndex: idx,
      entryTime,
      exitTime,
      entryPrice,
      exitPrice: sellPx,
      pnl,
      pnlPct,
      barsHeld: Math.max(0, idx - entryIndex),
      open: markOpen,
      exitReason: reason,
      entryFills: entryCount,
      lots: qty / cfg.lotSize,
      shares: qty,
      avgCost: entryCost > 0 && qty > 0 ? entryCost / qty : entryPrice,
    });

    cash = cash + proceeds;
    qty = 0;
    entryIndex = -1;
    entryPrice = 0;
    entryCost = 0;
    entryTime = 0;
    entryCount = 0;

    resetRisk();

    // Cooldown after exit
    if (riskEnabled) {
      const baseCd = Math.max(0, Math.floor(risk?.cooldownBars ?? 0));
      const stopCd = Math.max(0, Math.floor(risk?.cooldownAfterStopBars ?? 0));
      const isStop = reason === 'Stop' || reason === 'Trail';
      const cd = isStop ? Math.max(baseCd, stopCd) : baseCd;
      if (cd > 0) cooldownUntil = Math.max(cooldownUntil, idx + cd);
    }
  };

  // iterate bars, apply execution at current bar open based on previous bar's signal
  let peakEq = cap;
  let lastDdPct = 0;
  for (let idx = 0; idx < bars.length; idx++) {
    if (idx > 0) {
      const openPx = bars[idx]?.o;
      const prev = bars[idx - 1];

      // 0) Drawdown circuit breaker: pause new entries when drawdown is too large
      if (riskEnabled) {
        const ddTh = Math.max(0, Number(risk?.maxDdCircuitPct ?? 0));
        const pause = Math.max(0, Math.floor(risk?.circuitPauseBars ?? 0));
        if (ddTh > 0 && pause > 0 && lastDdPct >= ddTh) {
          circuitUntil = Math.max(circuitUntil, idx + pause);
        }
      }

      // 0a) HARD drawdown kill-switch: force close position and stop trading
      // This is the key lever to keep MDD <= ~5% (subject to gap risk in next-open model).
      // IMPORTANT: the pause must trigger even when we're already flat, otherwise the user
      // may see "回撤上限" not working (new entries keep happening).
      if (riskEnabled && Number.isFinite(openPx) && openPx > 0) {
        const hardDd = Math.max(0, Number(risk?.hardMaxDdPct ?? 0));
        if (hardDd > 0 && lastDdPct >= hardDd) {
          if (qty > 0) {
            doExit(idx, openPx, false, 'DdStop');
          }
          const pause = Math.max(0, Math.floor(risk?.hardDdPauseBars ?? 0));
          if (pause > 0) circuitUntil = Math.max(circuitUntil, idx + pause);
        }
      }

      // 0) Risk-based exits (checked on previous bar range, executed at current open)
      if (riskEnabled && qty > 0 && Number.isFinite(openPx) && openPx > 0) {
        // Update bestClose using previous HIGH (more protective trailing) and close as fallback
        if (Number.isFinite(prev?.h)) {
          bestClose = Number.isFinite(bestClose) ? Math.max(bestClose, prev.h) : prev.h;
        } else if (Number.isFinite(prev?.c)) {
          bestClose = Number.isFinite(bestClose) ? Math.max(bestClose, prev.c) : prev.c;
        }

        // Update trailing and breakeven using previous ATR
        const a = atrArr?.[idx - 1];
        if (Number.isFinite(a) && a > 0) {
          // Tighten trailing stop after partial take-profit
          let trailK = Math.max(0, Number(risk?.trailAtr ?? 0));
          const t1 = Math.max(0, Number(risk?.trailAtrAfterScale1 ?? 0));
          const t2 = Math.max(0, Number(risk?.trailAtrAfterScale2 ?? 0));
          if (scale2Done && t2 > 0) trailK = Math.min(trailK, t2);
          else if (scale1Done && t1 > 0) trailK = Math.min(trailK, t1);

          if (trailK > 0 && Number.isFinite(bestClose)) {
            const candidate = bestClose - trailK * a;
            if (Number.isFinite(candidate)) {
              trailPx = Number.isFinite(trailPx) ? Math.max(trailPx, candidate) : candidate;
            }
          }

          const beK = Math.max(0, Number(risk?.breakevenAtr ?? 0));
          if (beK > 0 && Number.isFinite(prev?.h) && prev.h >= entryPrice + beK * a) {
            stopPx = Number.isFinite(stopPx) ? Math.max(stopPx, entryPrice) : entryPrice;
          }

          // After scale-out, protect some profit above breakeven
          const pp1 = Math.max(0, Number(risk?.protectProfitAfterScale1Atr ?? 0));
          const pp2 = Math.max(0, Number(risk?.protectProfitAfterScale2Atr ?? 0));
          if (scale2Done && pp2 > 0) {
            const protect = entryPrice + pp2 * a;
            if (Number.isFinite(protect)) stopPx = Number.isFinite(stopPx) ? Math.max(stopPx, protect) : protect;
          } else if (scale1Done && pp1 > 0) {
            const protect = entryPrice + pp1 * a;
            if (Number.isFinite(protect)) stopPx = Number.isFinite(stopPx) ? Math.max(stopPx, protect) : protect;
          }

          // Scale-out take profit (profit factor booster)
          const so1Atr = Math.max(0, Number(risk?.scaleOut1Atr ?? 0));
          const so1Pct = Math.max(0, Math.min(1, Number(risk?.scaleOut1Pct ?? 0)));
          const so2Atr = Math.max(0, Number(risk?.scaleOut2Atr ?? 0));
          const so2Pct = Math.max(0, Math.min(1, Number(risk?.scaleOut2Pct ?? 0)));

          // Trigger checks are based on previous bar high hitting the threshold.
          // Execution is at current open (next-open model), consistent with other exits.
          if (qty > 0 && Number.isFinite(prev?.h)) {
            if (!scale1Done && so1Pct > 0 && so1Atr > 0 && prev.h >= entryPrice + so1Atr * a) {
              // sell at least 1 lot
              const want = Math.floor((qty * so1Pct) / cfg.lotSize) * cfg.lotSize;
              const sellQty = Math.max(cfg.lotSize, want);
              if (sellQty < qty) {
                doScaleOut(idx, openPx, sellQty);
                scale1Done = true;
              }
            }
            if (!scale2Done && so2Pct > 0 && so2Atr > 0 && prev.h >= entryPrice + so2Atr * a) {
              const want = Math.floor((qty * so2Pct) / cfg.lotSize) * cfg.lotSize;
              const sellQty = Math.max(cfg.lotSize, want);
              if (sellQty < qty) {
                doScaleOut(idx, openPx, sellQty);
                scale2Done = true;
              }
            }
          }
        }

        const stopLevel = effectiveStop();
        const hitStop = Number.isFinite(stopLevel) && Number.isFinite(prev?.l) && prev.l <= stopLevel;
        const hitTake = Number.isFinite(takePx) && Number.isFinite(prev?.h) && prev.h >= takePx;
        const maxHold = Math.max(0, Math.floor(risk?.maxHoldBars ?? 0));
        const hitTime = maxHold > 0 && entryIndex >= 0 && idx - entryIndex >= maxHold;

        if (hitStop || hitTake || hitTime) {
          let reason: BacktestTrade['exitReason'] = 'Signal';
          if (hitStop) {
            // Distinguish hard stop vs trailing
            const s = Number.isFinite(stopPx) ? stopPx : NaN;
            const t = Number.isFinite(trailPx) ? trailPx : NaN;
            const stopLevelNow = effectiveStop();
            const eps = 1e-6;
            if (Number.isFinite(t) && Number.isFinite(stopLevelNow) && Math.abs(t - stopLevelNow) <= eps) reason = 'Trail';
            else reason = 'Stop';
          } else if (hitTake) {
            reason = 'Take';
          } else if (hitTime) {
            reason = 'Time';
          }
          doExit(idx, openPx, false, reason);
        }
      }


      // AUTO_ADD_PYRAMIDING: If pyramiding is enabled, we can add based on favorable move (ATR)
      // even without requiring a repeated BUY signal. This makes the optimizer meaningful when
      // the user leaves "同向重复信号" unchecked.
      if (cfg.allowPyramiding && qty > 0 && entryCount < Math.max(1, Math.floor(cfg.maxEntries)) && Number.isFinite(openPx) && openPx > 0) {
        if (cooldownUntil < 0 || idx >= cooldownUntil) {
          if (circuitUntil < 0 || idx >= circuitUntil) {
            if (riskEnabled) {
              const a = atrArr?.[idx - 1];
              const addAfter = Math.max(0, Number(risk?.addOnlyAfterAtr ?? 0));
              const minGap = Math.max(0, Math.floor(risk?.minBarsBetweenAdds ?? 0));

              // If not initialized, treat the entry as the last add point.
              if (!Number.isFinite(lastAddPx) || lastAddPx <= 0) lastAddPx = entryPrice;
              if (!(lastAddIndex >= 0)) lastAddIndex = entryIndex;

              const buyPx = openPx * (1 + slipRate);
              const movedEnough = addAfter <= 0 ? false : (Number.isFinite(a) && a > 0 && buyPx >= lastAddPx + addAfter * a);
              const gapOk = minGap <= 0 ? true : (lastAddIndex >= 0 ? (idx - lastAddIndex >= minGap) : true);

              if (movedEnough && gapOk) {
                // In "ALL_IN" mode the user explicitly wants max exposure.
                // So we bypass the exposure cap to make the mode actually take effect.
                const maxExp = cfg.entryMode === 'ALL_IN'
                  ? 100
                  : Math.max(1, Math.min(100, Number(risk?.maxExposurePct ?? 100)));
                const addShares = calcDynamicShares(idx, buyPx, cash + qty * buyPx, cash);
                const addCost = addShares * buyPx * (1 + feeRate);
                if (addShares > 0 && Number.isFinite(addCost) && addCost <= cash) {
                  const eqAtOpen = cash + qty * buyPx;
                  const posValue = (qty + addShares) * buyPx;
                  if (!(eqAtOpen > 0 && posValue > (eqAtOpen * maxExp) / 100)) {
                    const newQty = qty + addShares;
                    const avgPx = (entryPrice * qty + buyPx * addShares) / newQty;
                    entryPrice = Number.isFinite(avgPx) ? avgPx : entryPrice;
                    entryCost = entryCost + addCost;
                    qty = newQty;
                    cash = cash - addCost;
                    entryCount += 1;
                    lastAddPx = buyPx;
                    lastAddIndex = idx;

                    // Update bestClose for trailing logic
                    bestClose = Number.isFinite(bestClose) ? Math.max(bestClose, buyPx) : buyPx;
                  }
                }
              }
            }
          }
        }
      }

      // 1) Signal-based executions (next-open model)
      const prevSig = sigByBarIndex.get(idx - 1);
      if (prevSig && prevSig.length && Number.isFinite(openPx) && openPx > 0) {
        // if multiple, process SELL first then BUY (safer)
        const ordered = [...prevSig].sort((a, b) => (a.side === 'SELL' ? -1 : 1) - (b.side === 'SELL' ? -1 : 1));
        for (const s of ordered) {
          // SELL first
          if (s.side === 'SELL' && qty > 0) {
            doExit(idx, openPx, false, 'Signal');
            continue;
          }

          if (s.side === 'BUY') {
            // cooldown gate
            if (cooldownUntil >= 0 && idx < cooldownUntil) continue;
            if (circuitUntil >= 0 && idx < circuitUntil) continue;

            const buyPx = openPx * (1 + slipRate);

            // Exposure cap (protect DD): avoid over-sizing positions
            // In "ALL_IN" mode the user explicitly wants max exposure.
            const maxExp = riskEnabled && cfg.entryMode !== 'ALL_IN'
              ? Math.max(1, Math.min(100, Number(risk?.maxExposurePct ?? 100)))
              : 100;

            if (qty === 0) {
              // Entry: fixed lots, skip if not enough cash
              const shares = calcDynamicShares(idx, buyPx, cash, cash);
              const cost = shares * buyPx * (1 + feeRate);
              if (shares <= 0 || !Number.isFinite(cost) || cost > cash) continue;

              // Exposure cap check
              const eqAtOpen = cash; // no position yet
              const posValue = shares * buyPx;
              if (eqAtOpen > 0 && posValue > (eqAtOpen * maxExp) / 100) continue;

              qty = shares;
              cash = cash - cost;
              entryIndex = idx;
              entryPrice = buyPx;
              entryCost = cost;
              entryTime = bars[idx]?.t;
              entryCount = 1;

              initRiskOnEntry(idx, buyPx);
            } else if (cfg.allowPyramiding && cfg.allowSameDirectionRepeat) {
              // Pyramiding: fixed lots, at most cfg.maxEntries
              if (entryCount >= Math.max(1, Math.floor(cfg.maxEntries))) continue;

              // Smart pyramiding: only add on favorable move & not too frequent
              if (riskEnabled) {
                const a = atrArr?.[idx - 1];
                const addAfter = Math.max(0, Number(risk?.addOnlyAfterAtr ?? 0));
                const minGap = Math.max(0, Math.floor(risk?.minBarsBetweenAdds ?? 0));
                if (minGap > 0 && lastAddIndex >= 0 && idx - lastAddIndex < minGap) continue;
                if (addAfter > 0 && Number.isFinite(a) && a > 0 && Number.isFinite(lastAddPx) && buyPx < lastAddPx + addAfter * a) {
                  continue;
                }
              }

              const addShares = calcDynamicShares(idx, buyPx, cash + qty * buyPx, cash);
              const addCost = addShares * buyPx * (1 + feeRate);
              if (addShares <= 0 || !Number.isFinite(addCost) || addCost > cash) continue;

              // Exposure cap check
              const eqAtOpen = cash + qty * buyPx;
              const posValue = (qty + addShares) * buyPx;
              if (eqAtOpen > 0 && posValue > (eqAtOpen * maxExp) / 100) continue;

              const newQty = qty + addShares;
              const avgPx = (entryPrice * qty + buyPx * addShares) / newQty;
              entryPrice = Number.isFinite(avgPx) ? avgPx : entryPrice;

              entryCost = entryCost + addCost;
              qty = newQty;
              cash = cash - addCost;
              entryCount += 1;

              lastAddPx = buyPx;
              lastAddIndex = idx;

              // Keep the original stops, but update bestClose to current entry price if needed
              if (riskEnabled) {
                bestClose = Number.isFinite(bestClose) ? Math.max(bestClose, buyPx) : buyPx;
              }
            }
          }
        }
      }
    }

    if (qty > 0) holdBars += 1;

    const closePx = bars[idx]?.c;
    const equity = cash + (qty > 0 && Number.isFinite(closePx) ? qty * closePx : 0);
    const e = Number.isFinite(equity) ? equity : cash;
    equityCurve.push(e);

    if (e > peakEq) peakEq = e;
    const ddPct = peakEq > 0 ? ((peakEq - e) / peakEq) * 100 : 0;
    drawdownPctCurve.push(Number.isFinite(ddPct) ? ddPct : 0);

    // remember last bar's drawdown for circuit breaker (used at next open)
    lastDdPct = Number.isFinite(ddPct) ? ddPct : 0;
  }

  // End-of-sample handling:
  // - Equity curve is mark-to-market on each bar close.
  // - For the trade list, we optionally "force-close" the last open position at the last close,
  //   so that PnL is visible and summary metrics are consistent.
  if (cfg.forceCloseAtEnd && qty > 0) {
    const last = bars[bars.length - 1];
    const exitPrice = last?.c;
    const exitTime = last?.t;
    if (Number.isFinite(exitPrice) && exitPrice > 0) {
      // NOTE: this close uses LAST CLOSE (not next-open). Costs are still applied (currently 0).
      const sellPx = exitPrice; // keep clean for reporting
      const proceeds = qty * sellPx * (1 - feeRate);
      const pnl = proceeds - entryCost;
      const pnlPct = entryCost > 0 ? (proceeds / entryCost - 1) * 100 : 0;

      trades.push({
        entryIndex,
        exitIndex: bars.length - 1,
        entryTime,
        exitTime,
        entryPrice,
        exitPrice: sellPx,
        pnl,
        pnlPct,
        barsHeld: Math.max(0, bars.length - 1 - entryIndex),
        open: true,
        exitReason: 'Force',
        entryFills: entryCount,
        lots: qty / cfg.lotSize,
        shares: qty,
        avgCost: entryCost > 0 && qty > 0 ? entryCost / qty : entryPrice,
      });

      cash = cash + proceeds;
      qty = 0;
      entryIndex = -1;
      entryPrice = 0;
      entryCost = 0;
      entryTime = 0;
    }
  }

  const finalEquity = cash;

  // Max drawdown
  let peak = equityCurve.length ? equityCurve[0] : cap;
  let maxDd = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > maxDd) maxDd = dd;
  }
  const maxDdPct = peak > 0 ? (maxDd / peak) * 100 : 0;

  // Profit factor, win rate, avg trade
  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let losses = 0;
  let sumTradePct = 0;
  for (const tr of trades) {
    if (tr.pnl >= 0) {
      grossProfit += tr.pnl;
      if (!tr.open) wins += 1;
    } else {
      grossLoss += Math.abs(tr.pnl);
      if (!tr.open) losses += 1;
    }
    sumTradePct += tr.pnlPct;
  }
  const closedCount = wins + losses;
  const winRate = closedCount > 0 ? (wins / closedCount) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
  const avgTradePct = trades.length ? sumTradePct / trades.length : null;

  // Buy & Hold baseline (first open → last close)
  const firstOpen = bars[0]?.o;
  const lastClose = bars[bars.length - 1]?.c;
  const lotSize = (cfg?.lotSize ?? 100);
  const exposurePct = barCount > 0 ? (holdBars / barCount) * 100 : 0;

  // Baseline: buy&hold with the same sizing (all-in by lot) and same cost settings (currently both = 0)
  let buyHoldFinalEquity: number | null = null;
  let buyHoldPct: number | null = null;
  let buyHoldCagrPct: number | null = null;
  if (Number.isFinite(firstOpen) && firstOpen > 0 && Number.isFinite(lastClose) && lastClose > 0) {
    const bhShares = Math.floor(cap / (firstOpen * (1 + feeRate)) / lotSize) * lotSize;
    const bhCost = bhShares * firstOpen * (1 + feeRate);
    const bhCash = cap - bhCost;
    buyHoldFinalEquity = bhCash + bhShares * lastClose * (1 - feeRate);
    buyHoldPct = cap > 0 ? (buyHoldFinalEquity / cap - 1) * 100 : null;

    const bhFirstTs = bars[0]?.t;
    const bhLastTs = bars[bars.length - 1]?.t;
    if (Number.isFinite(bhFirstTs) && Number.isFinite(bhLastTs)) {
      const years = (bhLastTs - bhFirstTs) / (365.25 * 24 * 3600);
      if (years > 0) buyHoldCagrPct = (Math.pow(buyHoldFinalEquity / cap, 1 / years) - 1) * 100;
    }
  }


  // Extra stats (TradingView-like, simple & stable)
  const closedTrades = trades.filter((t) => !t.open);
  const winsArr = closedTrades.filter((t) => t.pnlPct >= 0);
  const lossesArr = closedTrades.filter((t) => t.pnlPct < 0);
  const avgWinPct = winsArr.length ? winsArr.reduce((a, b) => a + b.pnlPct, 0) / winsArr.length : null;
  const avgLossPct = lossesArr.length ? lossesArr.reduce((a, b) => a + b.pnlPct, 0) / lossesArr.length : null;
  const expectancyPct = closedTrades.length ? closedTrades.reduce((a, b) => a + b.pnlPct, 0) / closedTrades.length : null;
  const avgBarsHeld = closedTrades.length ? closedTrades.reduce((a, b) => a + b.barsHeld, 0) / closedTrades.length : null;
  const maxBarsHeld = closedTrades.length ? Math.max(...closedTrades.map((t) => t.barsHeld)) : null;

  let maxConsecWins: number | null = null;
  let maxConsecLosses: number | null = null;
  if (closedTrades.length) {
    let cw = 0;
    let cl = 0;
    let mw = 0;
    let ml = 0;
    for (const tr of closedTrades) {
      if (tr.pnlPct >= 0) {
        cw += 1;
        cl = 0;
      } else {
        cl += 1;
        cw = 0;
      }
      if (cw > mw) mw = cw;
      if (cl > ml) ml = cl;
    }
    maxConsecWins = mw;
    maxConsecLosses = ml;
  }

  const netProfit = finalEquity - cap;
  const netProfitPct = cap > 0 ? (finalEquity / cap - 1) * 100 : 0;

  // --- Report extras (daily/monthly stats) ---
  let cagrPct: number | null = null;
  let sharpe: number | null = null;
  let calmar: number | null = null;
  let annualVolPct: number | null = null;
  let sortino: number | null = null;
  let recoveryFactor: number | null = null;
  let ulcerIndex: number | null = null;
  let maxDdDurationDays: number | null = null;
  let maxDdStart: string | null = null;
  let maxDdEnd: string | null = null;
  let sampleStart: string | null = null;
  let sampleEnd: string | null = null;
  let sampleDays: number | null = null;
  const monthlyReturns: { month: string; retPct: number }[] = [];

  try {
    const firstTs = bars[0]?.t;
    const lastTs = bars[bars.length - 1]?.t;
    if (Number.isFinite(firstTs) && Number.isFinite(lastTs)) {
      const years = (lastTs - firstTs) / (365.25 * 24 * 3600);
      if (years > 0) {
        cagrPct = (Math.pow(finalEquity / cap, 1 / years) - 1) * 100;
      }
    }

    // build daily equity (use last equity of the day)
    const dayKeys: string[] = [];
    const dayEquity: number[] = [];
    const seen = new Set<string>();
    let lastKey: string | null = null;
    for (let k = 0; k < bars.length; k++) {
      const ts = bars[k]?.t;
      if (!Number.isFinite(ts)) continue;
      const d = new Date(ts * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (lastKey != key) {
        lastKey = key;
        if (!seen.has(key)) {
          seen.add(key);
          dayKeys.push(key);
          dayEquity.push(equityCurve[k]);
        }
      } else {
        // same day: overwrite last
        dayEquity[dayEquity.length - 1] = equityCurve[k];
      }
    }
    // sharpe (daily)
    const dailyR: number[] = [];
    for (let d = 1; d < dayEquity.length; d++) {
      const a = dayEquity[d - 1];
      const b = dayEquity[d];
      if (a > 0 && Number.isFinite(a) && Number.isFinite(b)) dailyR.push(b / a - 1);
    }
    const dailyMean = dailyR.length ? dailyR.reduce((s, x) => s + x, 0) / dailyR.length : 0;
    const dailyStd = dailyR.length >= 5
      ? Math.sqrt(dailyR.reduce((s, x) => s + (x - dailyMean) ** 2, 0) / (dailyR.length - 1))
      : 0;
    if (dailyStd > 0) sharpe = (dailyMean / dailyStd) * Math.sqrt(252);

    // calmar
    if (cagrPct != null && maxDdPct > 0) calmar = (cagrPct / 100) / (maxDdPct / 100);

    // ---- Enhanced credibility metrics (based on daily equity) ----
    // Annualized volatility (daily), Sortino ratio, drawdown duration, and recovery factor
    annualVolPct = dailyStd > 0 ? (dailyStd * Math.sqrt(252) * 100) : 0;

    const downside = dailyR.filter((r) => r < 0);
    const downsideMean = downside.length ? downside.reduce((s, v) => s + v, 0) / downside.length : 0;
    const downsideStd = downside.length > 1
      ? Math.sqrt(downside.reduce((s, v) => s + Math.pow(v - downsideMean, 2), 0) / (downside.length - 1))
      : 0;
    sortino = downsideStd > 0 ? (dailyMean / downsideStd) * Math.sqrt(252) : (dailyMean > 0 ? Infinity : 0);

    // Max drawdown duration in trading days (peak -> recovery) using daily equity
    let peakEq = dayEquity[0] ?? 0;
    let peakIdx = 0;
    let inDd = false;
    let ddStartIdx = 0;
    let maxDdDur = 0;
    let maxDdStartIdx = 0;
    let maxDdEndIdx = 0;
    for (let i = 1; i < dayEquity.length; i++) {
      const eq = dayEquity[i];
      if (eq >= peakEq) {
        if (inDd) {
          const dur = i - ddStartIdx;
          if (dur > maxDdDur) {
            maxDdDur = dur;
            maxDdStartIdx = ddStartIdx;
            maxDdEndIdx = i;
          }
          inDd = false;
        }
        peakEq = eq;
        peakIdx = i;
      } else {
        if (!inDd) {
          inDd = true;
          ddStartIdx = peakIdx;
        }
        const dur = i - ddStartIdx;
        if (dur > maxDdDur) {
          maxDdDur = dur;
          maxDdStartIdx = ddStartIdx;
          maxDdEndIdx = i;
        }
      }
    }

    maxDdDurationDays = maxDdDur;
    maxDdStart = dayKeys[maxDdStartIdx] ?? '';
    maxDdEnd = dayKeys[maxDdEndIdx] ?? '';

    recoveryFactor = maxDd > 0 ? netProfit / maxDd : Infinity;

    // Ulcer index (based on drawdown percentage curve)
    ulcerIndex = drawdownPctCurve.length
      ? Math.sqrt(drawdownPctCurve.reduce((s, v) => s + v * v, 0) / drawdownPctCurve.length)
      : 0;

    sampleStart = dayKeys[0] ?? '';
    sampleEnd = dayKeys[dayKeys.length - 1] ?? '';
    sampleDays = dayKeys.length;

    // monthly returns from daily equity
    const monthFirst: Record<string, number> = {};
    const monthLast: Record<string, number> = {};
    for (let d = 0; d < dayKeys.length; d++) {
      const key = dayKeys[d];
      const m = key.slice(0, 7);
      if (!(m in monthFirst)) monthFirst[m] = dayEquity[d];
      monthLast[m] = dayEquity[d];
    }
    for (const m of Object.keys(monthLast).sort()) {
      const f = monthFirst[m];
      const l = monthLast[m];
      if (f > 0 && Number.isFinite(f) && Number.isFinite(l)) monthlyReturns.push({ month: m, retPct: (l / f - 1) * 100 });
    }
  } catch (e) {
    // ignore report errors
  }


  // ---- Reliability / credibility hints ----
  const reliabilityNotes: string[] = [];
  const tradeCount = trades.length;

  if (barCount < 200) reliabilityNotes.push(tRuntime('backtest.reliability.lowBars', { barCount }));
  if (validBarCount < barCount)
    reliabilityNotes.push(tRuntime('backtest.reliability.invalidBars', { validBarCount, barCount }));
  if (sampleDays != null && sampleDays < 60) reliabilityNotes.push(tRuntime('backtest.reliability.lowSampleDays', { sampleDays }));
  if (tradeCount === 0) reliabilityNotes.push(tRuntime('backtest.reliability.noTrades'));
  if (tradeCount > 0 && tradeCount < 20) reliabilityNotes.push(tRuntime('backtest.reliability.lowTrades', { tradeCount }));
  if (FORCE_CLOSE_AT_END) reliabilityNotes.push(tRuntime('backtest.reliability.forceClose'));

  const lowFlags = [
    barCount < 120,
    sampleDays != null && sampleDays < 30,
    tradeCount > 0 && tradeCount < 5,
    tradeCount === 0,
  ].filter(Boolean).length;

  const reliabilityLevel = lowFlags > 0
    ? tRuntime('reliability.level.low')
    : reliabilityNotes.length
      ? tRuntime('reliability.level.medium')
      : tRuntime('reliability.level.high');

  return {
    ok: true,
    initialCapital: cap,
    finalEquity,
    netProfit,
    netProfitPct,
    maxDrawdown: maxDd,
    maxDrawdownPct: maxDdPct,
    trades,
    winRate,
    profitFactor,
    avgTradePct,
    buyHoldPct,
    grossProfit,
    grossLoss,
    lotSize,
    model: cfg.model,
    feeBps: cfg.feeBps,
    slippageBps: cfg.slippageBps,
    allowPyramiding: cfg.allowPyramiding,
    allowSameDirectionRepeat: cfg.allowSameDirectionRepeat,
    orderLots: cfg.orderLots,
    maxEntries: cfg.maxEntries,
    forceCloseAtEnd: cfg.forceCloseAtEnd,
    barCount,
    validBarCount,
    tradeCount: trades.length,
    reliabilityLevel,
    reliabilityNotes,
    buyHoldFinalEquity,
    buyHoldCagrPct,
    exposurePct,
    avgWinPct,
    avgLossPct,
    expectancyPct,
    avgBarsHeld,
    maxBarsHeld,
    maxConsecWins,
    maxConsecLosses,
    equityCurve,
    drawdownPctCurve,
    cagrPct,
    sharpe,
    calmar,
    annualVolPct,
    sortino,
    recoveryFactor,
    ulcerIndex,
    maxDdDurationDays,
    maxDdStart,
    maxDdEnd,
    sampleStart,
    sampleEnd,
    sampleDays,
    monthlyReturns,
  };
}
