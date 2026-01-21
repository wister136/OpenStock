import { useCallback, useEffect, useMemo, useState } from 'react';

import type { OHLCVBar } from '@/lib/indicators';
import type { BacktestConfig, BacktestEntryMode, StrategyKey, StrategyParams } from '../types';
import {
  ALLOW_PYRAMIDING,
  ALLOW_SAME_DIR_REPEAT,
  DEFAULT_BACKTEST_CONFIG,
  FEE_BPS,
  PYRAMID_MAX_ENTRIES,
  PYRAMID_ORDER_LOTS,
  SLIPPAGE_BPS,
} from '../types';
import type { PyramidingCandidate } from '../ui/BacktestConfigPanel';
import { runBacktestNextOpen } from '../engine/backtest';
import { safeLocalStorageGet, safeLocalStorageSet } from './useLocalStorageState';
import { buildEquityPoints } from '../utils/backtest';

export function useAshareBacktest({
  bars,
  freq,
  strategy,
  stParams,
}: {
  bars: OHLCVBar[];
  freq: string;
  strategy: StrategyKey;
  stParams: StrategyParams;
}) {
  const [btWindowMode, setBtWindowMode] = useState<'full' | 'recent_60' | 'recent_120'>('full');

  const [btEntryMode, setBtEntryMode] = useState<BacktestEntryMode>(() => {
    const stored = safeLocalStorageGet('openstock_bt_entry_mode_v1');
    return stored === 'ALL_IN' ? 'ALL_IN' : 'FIXED';
  });

  const [btCapitalText, setBtCapitalText] = useState('100000');
  const btCapital = useMemo(() => {
    const v = Number(btCapitalText);
    return Number.isFinite(v) && v > 0 ? v : 100000;
  }, [btCapitalText]);

  const [btFeeBpsText, setBtFeeBpsText] = useState(String(FEE_BPS));
  const [btSlippageBpsText, setBtSlippageBpsText] = useState(String(SLIPPAGE_BPS));
  const [btOrderLotsText, setBtOrderLotsText] = useState(String(PYRAMID_ORDER_LOTS));
  const [btMaxEntriesText, setBtMaxEntriesText] = useState(String(PYRAMID_MAX_ENTRIES));
  const [btDateFromText, setBtDateFromText] = useState<string>('');
  const [btDateToText, setBtDateToText] = useState<string>('');
  const [btHardDdPctText, setBtHardDdPctText] = useState(String(DEFAULT_BACKTEST_CONFIG.risk?.hardMaxDdPct ?? 5));
  const [btAllowPyramiding, setBtAllowPyramiding] = useState<boolean>(ALLOW_PYRAMIDING);
  const [btAllowSameDirRepeat, setBtAllowSameDirRepeat] = useState<boolean>(ALLOW_SAME_DIR_REPEAT);

  const [pyramidingOptimizing, setPyramidingOptimizing] = useState(false);
  const [pyramidingCandidates, setPyramidingCandidates] = useState<PyramidingCandidate[]>([]);

  const btFeeBps = useMemo(() => {
    const v = Number(btFeeBpsText);
    return Number.isFinite(v) && v >= 0 ? Math.min(v, 500) : 0;
  }, [btFeeBpsText]);

  const btSlippageBps = useMemo(() => {
    const v = Number(btSlippageBpsText);
    return Number.isFinite(v) && v >= 0 ? Math.min(v, 500) : 0;
  }, [btSlippageBpsText]);

  const btOrderLots = useMemo(() => {
    const v = Math.floor(Number(btOrderLotsText));
    return Number.isFinite(v) && v >= 1 ? Math.min(v, 100) : 1;
  }, [btOrderLotsText]);

  const btMaxEntries = useMemo(() => {
    const v = Math.floor(Number(btMaxEntriesText));
    return Number.isFinite(v) && v >= 1 ? Math.min(v, 50) : 1;
  }, [btMaxEntriesText]);

  const btHardDdPct = useMemo(() => {
    const v = Number(btHardDdPctText);
    return Number.isFinite(v) && v > 0 ? Math.max(0.5, Math.min(95, v)) : (DEFAULT_BACKTEST_CONFIG.risk?.hardMaxDdPct ?? 5);
  }, [btHardDdPctText]);

  useEffect(() => {
    if (!btAllowPyramiding && btAllowSameDirRepeat) setBtAllowSameDirRepeat(false);
  }, [btAllowPyramiding, btAllowSameDirRepeat]);

  useEffect(() => {
    const capStored = safeLocalStorageGet('openstock_bt_capital_v1');
    if (typeof capStored === 'number' && Number.isFinite(capStored) && capStored > 0) setBtCapitalText(String(capStored));

    const feeStored = safeLocalStorageGet('openstock_bt_fee_bps_v1');
    if (typeof feeStored === 'number' && Number.isFinite(feeStored) && feeStored >= 0) setBtFeeBpsText(String(feeStored));

    const slipStored = safeLocalStorageGet('openstock_bt_slippage_bps_v1');
    if (typeof slipStored === 'number' && Number.isFinite(slipStored) && slipStored >= 0) setBtSlippageBpsText(String(slipStored));

    const lotsStored = safeLocalStorageGet('openstock_bt_order_lots_v1');
    if (typeof lotsStored === 'number' && Number.isFinite(lotsStored) && lotsStored >= 1) setBtOrderLotsText(String(lotsStored));

    const maxEntStored = safeLocalStorageGet('openstock_bt_max_entries_v1');
    if (typeof maxEntStored === 'number' && Number.isFinite(maxEntStored) && maxEntStored >= 1) setBtMaxEntriesText(String(maxEntStored));

    const dfStored = safeLocalStorageGet('openstock_bt_date_from_v1');
    if (typeof dfStored === 'string') setBtDateFromText(dfStored);

    const dtStored = safeLocalStorageGet('openstock_bt_date_to_v1');
    if (typeof dtStored === 'string') setBtDateToText(dtStored);

    const ddStored = safeLocalStorageGet('openstock_bt_hard_dd_pct_v1');
    if (typeof ddStored === 'number' && Number.isFinite(ddStored) && ddStored > 0) setBtHardDdPctText(String(ddStored));

    const pyStored = safeLocalStorageGet('openstock_bt_allow_pyramiding_v1');
    if (typeof pyStored === 'boolean') setBtAllowPyramiding(pyStored);

    const repStored = safeLocalStorageGet('openstock_bt_allow_same_dir_v1');
    if (typeof repStored === 'boolean') setBtAllowSameDirRepeat(repStored);

    const emStored = safeLocalStorageGet('openstock_bt_entry_mode_v1');
    if (emStored === 'FIXED' || emStored === 'ALL_IN') setBtEntryMode(emStored);
  }, []);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_entry_mode_v1', btEntryMode);
  }, [btEntryMode]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_capital_v1', btCapital);
  }, [btCapital]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_fee_bps_v1', btFeeBps);
  }, [btFeeBps]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_slippage_bps_v1', btSlippageBps);
  }, [btSlippageBps]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_order_lots_v1', btOrderLots);
  }, [btOrderLots]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_max_entries_v1', btMaxEntries);
  }, [btMaxEntries]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_date_from_v1', btDateFromText);
  }, [btDateFromText]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_date_to_v1', btDateToText);
  }, [btDateToText]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_hard_dd_pct_v1', btHardDdPct);
  }, [btHardDdPct]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_allow_pyramiding_v1', btAllowPyramiding);
  }, [btAllowPyramiding]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_allow_same_dir_v1', btAllowSameDirRepeat);
  }, [btAllowSameDirRepeat]);

  const btConfig = useMemo(
    () => {
      const baseRisk = DEFAULT_BACKTEST_CONFIG.risk;
      return {
        ...DEFAULT_BACKTEST_CONFIG,
        entryMode: btEntryMode,
        dateFrom: btDateFromText ? btDateFromText : undefined,
        dateTo: btDateToText ? btDateToText : undefined,
        feeBps: btFeeBps,
        slippageBps: btSlippageBps,
        allowPyramiding: btAllowPyramiding,
        allowSameDirectionRepeat: btAllowSameDirRepeat,
        orderLots: btOrderLots,
        maxEntries: btMaxEntries,
        risk: baseRisk
          ? {
              ...baseRisk,
              hardMaxDdPct: btHardDdPct,
              maxDdCircuitPct: btHardDdPct > 0 ? Math.max(0, Math.min(btHardDdPct * 0.84, btHardDdPct - 0.3)) : 0,
            }
          : undefined,
      };
    },
    [btEntryMode, btFeeBps, btSlippageBps, btAllowPyramiding, btAllowSameDirRepeat, btOrderLots, btMaxEntries, btHardDdPct, btDateFromText, btDateToText]
  );

  const btBars = useMemo(() => {
    if (!bars || bars.length === 0) return bars;

    let baseBars = bars;
    const barsPerDay = freq === '1d' ? 1 : freq === '60m' ? 4 : freq === '30m' ? 8 : freq === '15m' ? 16 : 48;

    if (btWindowMode === 'recent_60') {
      const count = 60 * barsPerDay;
      if (bars.length > count) baseBars = bars.slice(-count);
    } else if (btWindowMode === 'recent_120') {
      const count = 120 * barsPerDay;
      if (bars.length > count) baseBars = bars.slice(-count);
    }

    if (btWindowMode === 'full') {
      const from = btDateFromText?.trim();
      const to = btDateToText?.trim();
      if (!from && !to) return baseBars;

      const toSec = (d: string, endOfDay: boolean) => {
        if (!d) return NaN;
        const iso = endOfDay ? `${d}T23:59:59` : `${d}T00:00:00`;
        const ms = Date.parse(iso);
        return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
      };
      const startSec = from ? toSec(from, false) : NaN;
      const endSec = to ? toSec(to, true) : NaN;

      if ((from && !Number.isFinite(startSec)) || (to && !Number.isFinite(endSec))) return baseBars;

      const lo = Number.isFinite(startSec) ? startSec : -Infinity;
      const hi = Number.isFinite(endSec) ? endSec : Infinity;
      const filtered = baseBars.filter((b) => b.t >= lo && b.t <= hi);
      return filtered.length >= 10 ? filtered : baseBars;
    }
    return baseBars;
  }, [bars, btDateFromText, btDateToText, btWindowMode, freq]);

  const setBtConfig = useCallback(
    (next: BacktestConfig | ((prev: BacktestConfig) => BacktestConfig)) => {
      const prev: BacktestConfig = {
        ...DEFAULT_BACKTEST_CONFIG,
        capital: btCapital,
        ...btConfig,
      };
      const cfg = typeof next === 'function' ? (next as any)(prev) : next;

      if (cfg.capital != null) setBtCapitalText(String(cfg.capital));
      if (cfg.feeBps != null) setBtFeeBpsText(String(cfg.feeBps));
      if (cfg.slippageBps != null) setBtSlippageBpsText(String(cfg.slippageBps));

      if (cfg.entryMode) setBtEntryMode(cfg.entryMode);

      if (cfg.allowPyramiding != null) setBtAllowPyramiding(Boolean(cfg.allowPyramiding));
      if (cfg.allowSameDirectionRepeat != null) setBtAllowSameDirRepeat(Boolean(cfg.allowSameDirectionRepeat));

      if (cfg.orderLots != null) setBtOrderLotsText(String(cfg.orderLots));
      if (cfg.maxEntries != null) setBtMaxEntriesText(String(cfg.maxEntries));

      if (cfg.entryMode === 'FIXED' || cfg.entryMode === 'ALL_IN') setBtEntryMode(cfg.entryMode);

      if ('dateFrom' in cfg) setBtDateFromText((cfg as any).dateFrom ?? '');
      if ('dateTo' in cfg) setBtDateToText((cfg as any).dateTo ?? '');

      if (cfg.risk?.hardMaxDdPct != null && Number.isFinite(cfg.risk.hardMaxDdPct) && cfg.risk.hardMaxDdPct > 0) {
        setBtHardDdPctText(String(cfg.risk.hardMaxDdPct));
      }
    },
    [btCapital, btConfig, btFeeBps, btSlippageBps, btAllowPyramiding, btAllowSameDirRepeat, btOrderLots, btMaxEntries, btEntryMode]
  );

  const applyPyramidingCandidate = useCallback(
    (c: PyramidingCandidate) => {
      setPyramidingCandidates((prev) => prev);
      setBtConfig((prev) => ({
        ...prev,
        allowPyramiding: true,
        orderLots: c.orderLots,
        maxEntries: c.maxEntries,
      }));
    },
    [setBtConfig]
  );

  const autoPyramiding = useCallback(() => {
    if (!btBars || btBars.length < 120 || strategy === 'none') {
      setPyramidingCandidates([]);
      return;
    }

    const lotsGrid = [1, 2, 3, 4, 5, 6, 8, 10];
    const entriesGrid = [1, 2, 3, 4, 5, 6];

    setPyramidingOptimizing(true);
    try {
      const base: BacktestConfig = {
        ...DEFAULT_BACKTEST_CONFIG,
        ...btConfig,
        capital: btCapital,
        allowPyramiding: true,
      };

      const candidates: PyramidingCandidate[] = [];
      for (const orderLots of lotsGrid) {
        for (const maxEntries of entriesGrid) {
          const cfg: BacktestConfig = { ...base, orderLots, maxEntries };
          const r = runBacktestNextOpen(strategy, btBars, btCapital, cfg, stParams);
          if (!r.ok) continue;

          const tradeCount = (r as any).tradeCount ?? r.trades?.length ?? 0;
          const pf = r.profitFactor;
          const net = r.netProfitPct ?? 0;
          const mdd = r.maxDrawdownPct ?? 0;

          const ddLimit = btHardDdPct ?? 5.0;
          if (ddLimit > 0 && mdd > ddLimit) continue;

          const pfScore = pf == null ? 0 : Number.isFinite(pf) ? pf : 99;
          const tooFewTradesPenalty = tradeCount < 3 ? 25 : 0;
          const score = pfScore * 120 + net * 2.5 - mdd * 12 + Math.min(tradeCount, 60) * 0.08 - tooFewTradesPenalty;

          candidates.push({
            orderLots,
            maxEntries,
            profitFactor: pf,
            netProfitPct: net,
            maxDrawdownPct: mdd,
            tradeCount,
            score,
          });
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      setPyramidingCandidates(candidates);

      if (candidates[0]) {
        applyPyramidingCandidate(candidates[0]);
      }
    } finally {
      setPyramidingOptimizing(false);
    }
  }, [btBars, strategy, btCapital, btConfig, stParams, btHardDdPct, applyPyramidingCandidate]);

  const backtest = useMemo(
    () => runBacktestNextOpen(strategy, btBars, btCapital, btConfig, stParams),
    [strategy, btBars, btCapital, btConfig, stParams]
  );

  const equityPoints = useMemo(() => buildEquityPoints(backtest as any, btBars as any, btCapital), [backtest, btBars, btCapital]);

  return {
    btWindowMode,
    setBtWindowMode,
    btEntryMode,
    setBtEntryMode,
    btCapitalText,
    setBtCapitalText,
    btCapital,
    btFeeBpsText,
    setBtFeeBpsText,
    btFeeBps,
    btSlippageBpsText,
    setBtSlippageBpsText,
    btSlippageBps,
    btOrderLotsText,
    setBtOrderLotsText,
    btOrderLots,
    btMaxEntriesText,
    setBtMaxEntriesText,
    btMaxEntries,
    btDateFromText,
    setBtDateFromText,
    btDateToText,
    setBtDateToText,
    btHardDdPctText,
    setBtHardDdPctText,
    btHardDdPct,
    btAllowPyramiding,
    setBtAllowPyramiding,
    btAllowSameDirRepeat,
    setBtAllowSameDirRepeat,
    pyramidingOptimizing,
    pyramidingCandidates,
    applyPyramidingCandidate,
    autoPyramiding,
    btConfig,
    setBtConfig,
    btBars,
    backtest,
    equityPoints,
  };
}
