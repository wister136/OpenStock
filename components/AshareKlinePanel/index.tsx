'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { bollingerBands, ema, lastFinite, macd, rsi, sma } from '@/lib/indicators';
import { useI18n } from '@/lib/i18n';
import { useTheme } from 'next-themes';

import { detectMarketRegime, recommendStrategies } from './engine/regime';
import type { MarketRegimeInfo, RegimeConfig, StrategyRecommendation } from './types';

import type { AllowedFreq, StrategyKey, StrategyParams, IndicatorKey } from './types';
import { DEFAULT_STRATEGY_PARAMS, FREQ_OPTIONS, INDICATOR_OPTIONS, STRATEGY_OPTIONS } from './types';
import { safeLocalStorageGet, safeLocalStorageSet } from './hooks/useLocalStorageState';
import { buildStrategyMarkers } from './engine/strategies';
import { runBacktestNextOpen } from './engine/backtest';
import FooterCards from './ui/FooterCards';
import RegimeExternalPanel from './ui/RegimeExternalPanel';
import TradingViewDialog from './ui/TradingViewDialog';
import { useAshareBars } from './hooks/useAshareBars';
import { useAshareConfig } from './hooks/useAshareConfig';
import { useAshareDecision } from './hooks/useAshareDecision';
import { useAshareNewsFeed } from './hooks/useAshareNewsFeed';
import { useAshareBacktest } from './hooks/useAshareBacktest';
import { fmt } from './utils/format';
import MainChart from './charts/MainChart';
import RSIChart from './charts/RSIChart';
import MACDChart from './charts/MACDChart';
import { bindVisibleRangeSync } from './charts/syncTimeRange';

export default function AshareKlinePanel({ symbol, title }: { symbol: string; title?: string }) {
  const { t } = useI18n();
  const { theme } = useTheme();

  const tvUrl = useMemo(() => tvChartUrl(symbol), [symbol]);
  const isLight = theme === 'light';
  const chartBg = isLight ? '#f8fafc' : '#0d0d0d';
  const chartText = isLight ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.75)';
  const chartTextMuted = isLight ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.65)';
  const gridColor = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)';
  const crosshairColor = isLight ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.25)';
  const borderColor = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)';

  const strategyLabelKey: Record<StrategyKey, string> = {
    none: 'strategy.label.none',
    maCross: 'strategy.label.maCross',
    emaTrend: 'strategy.label.emaTrend',
    macdCross: 'strategy.label.macdCross',
    rsiReversion: 'strategy.label.rsiReversion',
    rsiMomentum: 'strategy.label.rsiMomentum',
    bollingerBreakout: 'strategy.label.bollingerBreakout',
    bollingerReversion: 'strategy.label.bollingerReversion',
    channelBreakout: 'strategy.label.channelBreakout',
    supertrend: 'strategy.label.supertrend',
    atrBreakout: 'strategy.label.atrBreakout',
    turtle: 'strategy.label.turtle',
    ichimoku: 'strategy.label.ichimoku',
    kdj: 'strategy.label.kdj',
  };

  const strategyNoteKey: Partial<Record<StrategyKey, string>> = {
    none: 'strategy.note.none',
    maCross: 'strategy.note.maCross',
    emaTrend: 'strategy.note.emaTrend',
    macdCross: 'strategy.note.macdCross',
    rsiReversion: 'strategy.note.rsiReversion',
    rsiMomentum: 'strategy.note.rsiMomentum',
    bollingerReversion: 'strategy.note.bollingerReversion',
    bollingerBreakout: 'strategy.note.bollingerBreakout',
    channelBreakout: 'strategy.note.channelBreakout',
    supertrend: 'strategy.note.supertrend',
    atrBreakout: 'strategy.note.atrBreakout',
    turtle: 'strategy.note.turtle',
    ichimoku: 'strategy.note.ichimoku',
    kdj: 'strategy.note.kdj',
  };

  const indicatorNameKey: Record<IndicatorKey, string> = {
    ma5: 'indicator.ma5',
    ma10: 'indicator.ma10',
    ma20: 'indicator.ma20',
    ema20: 'indicator.ema20',
    bbands: 'indicator.bbands',
    rsi14: 'indicator.rsi14',
    macd: 'indicator.macd',
  };

  const indicatorDescKey: Record<IndicatorKey, string> = {
    ma5: 'indicator.desc.ma5',
    ma10: 'indicator.desc.ma10',
    ma20: 'indicator.desc.ma20',
    ema20: 'indicator.desc.ema20',
    bbands: 'indicator.desc.bbands',
    rsi14: 'indicator.desc.rsi14',
    macd: 'indicator.desc.macd',
  };

  const categoryLabel = (category: string) => {
    if (category === '趋势') return t('indicator.category.trend');
    if (category === '震荡') return t('indicator.category.range');
    if (category === '波动') return t('indicator.category.vol');
    if (category === '全部') return t('indicator.category.all');
    return category;
  };

  const categoryKey = (category: string) => {
    if (category === '趋势') return 'trend';
    if (category === '震荡') return 'range';
    if (category === '波动') return 'vol';
    return 'all';
  };

  const strategyLabel = (key: StrategyKey) => t(strategyLabelKey[key] ?? key);
  const strategyNote = (key: StrategyKey) => {
    const noteKey = strategyNoteKey[key];
    return noteKey ? t(noteKey) : '';
  };

  const regimeLabel = (regime?: MarketRegimeInfo['regime']) => {
    if (regime === 'TREND_UP') return t('ashare.panel.regime.up');
    if (regime === 'TREND_DOWN') return t('ashare.panel.regime.down');
    if (regime === 'RANGE') return t('ashare.panel.regime.range');
    if (regime === 'HIGH_VOL') return t('ashare.panel.regime.highVol');
    return '';
  };

  const [newsDlgOpen, setNewsDlgOpen] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<'3s' | '5s' | '10s' | 'manual'>('5s');
  const [freq, setFreq] = useState<AllowedFreq>('30m');

  const barsState = useAshareBars(symbol, freq);
  const cfgState = useAshareConfig(symbol, freq);
  const decState = useAshareDecision(symbol, freq, cfgState.regimeConfig, cfgState.configVersion, refreshInterval);
  const newsState = useAshareNewsFeed(newsDlgOpen, symbol);

  const { bars, loading, updatedAt } = barsState;
  const { configDraft, setConfigDraft, configLoading } = cfgState;
  const { decision, meta: decisionMeta, loading: decisionLoading, error: decisionError } = decState;
  const { newsItems, loading: newsLoading, error: newsError, translateCount } = newsState;

  const { autoTuneLoading, autoTuneError, autoTuneResult, autoTuneBackup } = cfgState;

  // Strategy parameters (persisted)
  const [stParams, setStParams] = useState<StrategyParams>(() => {
    const stored = safeLocalStorageGet('openstock_strategy_params_v1');
    if (stored && typeof stored === 'object') {
      const s = stored as any;
      return {
        supertrend: { ...DEFAULT_STRATEGY_PARAMS.supertrend, ...(s.supertrend || {}) },
        atrBreakout: { ...DEFAULT_STRATEGY_PARAMS.atrBreakout, ...(s.atrBreakout || {}) },
        turtle: { ...DEFAULT_STRATEGY_PARAMS.turtle, ...(s.turtle || {}) },
        filters: { ...DEFAULT_STRATEGY_PARAMS.filters, ...(s.filters || {}) },
      };
    }
    return DEFAULT_STRATEGY_PARAMS;
  });

  useEffect(() => {
    safeLocalStorageSet('openstock_strategy_params_v1', stParams);
  }, [stParams]);

  const refreshDecision = decState.refreshDecision;

  const applyConfig = useCallback(
    async (override?: RegimeConfig) => {
      const ok = await cfgState.applyConfig(override);
      if (ok) refreshDecision();
    },
    [cfgState, refreshDecision]
  );

  const startAutoTune = cfgState.startAutoTune;

  const applyRecommended = useCallback(async () => {
    const ok = await cfgState.applyRecommended();
    if (ok) refreshDecision();
  }, [cfgState, refreshDecision]);

  const rollbackConfig = useCallback(async () => {
    const ok = await cfgState.rollbackConfig();
    if (ok) refreshDecision();
  }, [cfgState, refreshDecision]);

  // Indicators
  const [showMA5, setShowMA5] = useState(true);
  const [showMA10, setShowMA10] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showEMA20, setShowEMA20] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);

  // 新增：市场状态与推荐
  const [regimeInfo, setRegimeInfo] = useState<MarketRegimeInfo | null>(null);
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);

  // Strategy (A: arrows only)
  const [strategy, setStrategy] = useState<StrategyKey>('none');

  const backtestState = useAshareBacktest({ bars, freq, strategy, stParams });
  const {
    btWindowMode,
    setBtWindowMode,
    btCapital,
    pyramidingOptimizing,
    pyramidingCandidates,
    applyPyramidingCandidate,
    autoPyramiding,
    btConfig,
    setBtConfig,
    btBars,
    backtest,
    equityPoints,
  } = backtestState;

  useEffect(() => {
    if (!bars || bars.length === 0) {
      setRegimeInfo(null);
      setRecommendations([]);
      return;
    }
    const info = detectMarketRegime(bars);
    setRegimeInfo(info);
    setRecommendations(recommendStrategies(bars, btCapital, stParams, info.regime));
  }, [bars, btCapital, stParams]);

  // Modal (TradingView-like)
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgTab, setDlgTab] = useState<'indicators' | 'strategies' | 'backtest'>('indicators');
  const [dlgCategory, setDlgCategory] = useState<'all' | 'trend' | 'range' | 'vol'>('all');
  const [dlgQuery, setDlgQuery] = useState('');
  const [strategySort, setStrategySort] = useState<'winRate' | 'tradeCount' | 'netProfitPct'>('winRate');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [autoStrategy, setAutoStrategy] = useState<boolean>(() => {
    const stored = safeLocalStorageGet('openstock_auto_strategy_v1');
    return stored === true;
  });

  const mainChartRef = useRef<any>(null);
  const rsiChartRef = useRef<any>(null);
  const macdChartRef = useRef<any>(null);
  const [chartsEpoch, setChartsEpoch] = useState(0);

  const bumpChartsEpoch = useCallback(() => {
    setChartsEpoch((v) => v + 1);
  }, []);

  const handleMainChartReady = useCallback(
    (chart: any | null) => {
      mainChartRef.current = chart;
      bumpChartsEpoch();
    },
    [bumpChartsEpoch]
  );

  const handleRSIChartReady = useCallback(
    (chart: any | null) => {
      rsiChartRef.current = chart;
      bumpChartsEpoch();
    },
    [bumpChartsEpoch]
  );

  const handleMACDChartReady = useCallback(
    (chart: any | null) => {
      macdChartRef.current = chart;
      bumpChartsEpoch();
    },
    [bumpChartsEpoch]
  );

  useEffect(() => {
    return bindVisibleRangeSync([
      mainChartRef.current,
      showRSI ? rsiChartRef.current : null,
      showMACD ? macdChartRef.current : null,
    ]);
  }, [chartsEpoch, showRSI, showMACD]);

  useEffect(() => {
    const stored = safeLocalStorageGet('openstock_tv_favs_v1');
    if (stored && typeof stored === 'object') setFavorites(stored as Record<string, boolean>);
  }, []);

  useEffect(() => {
    safeLocalStorageSet('openstock_tv_favs_v1', favorites);
  }, [favorites]);

  useEffect(() => {
    safeLocalStorageSet('openstock_auto_strategy_v1', autoStrategy);
  }, [autoStrategy]);

  useEffect(() => {
    if (!autoStrategy) return;
    const top = recommendations[0];
    if (!top?.key) return;
    if (strategy !== top.key) setStrategy(top.key);
  }, [autoStrategy, recommendations, strategy]);

  const derived = useMemo(() => {
    const closes = bars.map((b) => b.c);
    const ma5 = sma(closes, 5);
    const ma10 = sma(closes, 10);
    const ma20 = sma(closes, 20);
    const r14 = rsi(closes, 14);

    const lastClose = closes.length ? closes[closes.length - 1] : null;
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
    const change = lastClose != null && prevClose != null ? lastClose - prevClose : null;
    const pct = lastClose != null && prevClose != null && prevClose !== 0 ? (change! / prevClose) * 100 : null;

    return {
      lastClose,
      change,
      pct,
      ma5: lastFinite(ma5),
      ma10: lastFinite(ma10),
      ma20: lastFinite(ma20),
      rsi14: lastFinite(r14),
    };
  }, [bars]);

  const indicatorData = useMemo(() => {
    const closes = bars.map((b) => b.c);

    const ma5Arr = sma(closes, 5);
    const ma10Arr = sma(closes, 10);
    const ma20Arr = sma(closes, 20);
    const ema20Arr = ema(closes, 20);

    const bb = bollingerBands(closes, 20, 2);
    const r14Arr = rsi(closes, 14);

    const m = macd(closes, 12, 26, 9);

    const toLine = (arr: Array<number | null>) =>
      bars
        .map((b, i) => {
          const v = arr[i] as number;
          if (v == null || !Number.isFinite(v)) return null;
          return { time: b.t, value: v };
        })
        .filter(Boolean) as Array<{ time: number; value: number }>;

    const toHist = (arr: number[]) =>
      bars
        .map((b, i) => {
          const v = arr[i];
          if (!Number.isFinite(v)) return null;
          return {
            time: b.t,
            value: v,
            color: v >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)',
          };
        })
        .filter(Boolean) as Array<{ time: number; value: number; color: string }>;

    return {
      ma5: toLine(ma5Arr),
      ma10: toLine(ma10Arr),
      ma20: toLine(ma20Arr),
      ema20: toLine(ema20Arr),
      bbUpper: toLine(bb.upper),
      bbMid: toLine(bb.mid),
      bbLower: toLine(bb.lower),
      rsi14: toLine(r14Arr),
      macd: toLine(m.macd),
      macdSignal: toLine(m.signal),
      macdHist: toHist(m.hist),
    };
  }, [bars]);

  const overlayIndicatorData = useMemo(
    () => ({
      ma5: showMA5 ? indicatorData.ma5 : null,
      ma10: showMA10 ? indicatorData.ma10 : null,
      ma20: showMA20 ? indicatorData.ma20 : null,
      ema20: showEMA20 ? indicatorData.ema20 : null,
      bbUpper: showBB ? indicatorData.bbUpper : null,
      bbMid: showBB ? indicatorData.bbMid : null,
      bbLower: showBB ? indicatorData.bbLower : null,
    }),
    [indicatorData, showMA5, showMA10, showMA20, showEMA20, showBB]
  );

  const mainThemeColors = useMemo(
    () => ({ chartBg, chartText, gridColor, crosshairColor, borderColor }),
    [chartBg, chartText, gridColor, crosshairColor, borderColor]
  );

  const paneThemeColors = useMemo(
    () => ({ chartBg, chartTextMuted, gridColor, crosshairColor, borderColor }),
    [chartBg, chartTextMuted, gridColor, crosshairColor, borderColor]
  );

  const strategyCalc = useMemo(() => buildStrategyMarkers(strategy, bars, stParams), [strategy, bars, stParams]);
  const changeClass =
    derived.change == null
      ? 'text-gray-300'
      : derived.change > 0
        ? 'text-red-500'
        : derived.change < 0
          ? 'text-green-500'
          : 'text-gray-300';

  const resetAll = () => {
    setFreq('30m');
    setShowMA5(true);
    setShowMA10(true);
    setShowMA20(true);
    setShowEMA20(false);
    setShowBB(false);
    setShowRSI(false);
    setShowMACD(false);
    setStrategy('none');
  };

  const enabledIndicators: IndicatorKey[] = useMemo(() => {
    const out: IndicatorKey[] = [];
    if (showMA5) out.push('ma5');
    if (showMA10) out.push('ma10');
    if (showMA20) out.push('ma20');
    if (showEMA20) out.push('ema20');
    if (showBB) out.push('bbands');
    if (showRSI) out.push('rsi14');
    if (showMACD) out.push('macd');
    return out;
  }, [showMA5, showMA10, showMA20, showEMA20, showBB, showRSI, showMACD]);

  const toggleIndicator = (k: IndicatorKey) => {
    if (k === 'ma5') return setShowMA5((v) => !v);
    if (k === 'ma10') return setShowMA10((v) => !v);
    if (k === 'ma20') return setShowMA20((v) => !v);
    if (k === 'ema20') return setShowEMA20((v) => !v);
    if (k === 'bbands') return setShowBB((v) => !v);
    if (k === 'rsi14') return setShowRSI((v) => !v);
    if (k === 'macd') return setShowMACD((v) => !v);
  };

  const sortedIndicatorItems = useMemo(() => {
    const q = dlgQuery.trim().toLowerCase();
    const items = INDICATOR_OPTIONS.filter((it) => {
      const catOk = dlgCategory === 'all' || categoryKey(it.category) === dlgCategory;
      const nameText = t(indicatorNameKey[it.key]);
      const descText = t(indicatorDescKey[it.key]);
      const qOk = !q || nameText.toLowerCase().includes(q) || descText.toLowerCase().includes(q);
      return catOk && qOk;
    });

    const score = (it: (typeof INDICATOR_OPTIONS)[number]) => {
      const fav = favorites[`ind:${it.key}`] ? 1 : 0;
      const enabled = enabledIndicators.includes(it.key) ? 1 : 0;
      return fav * 100 + enabled * 10;
    };

    return items.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  }, [dlgCategory, dlgQuery, enabledIndicators, favorites]);

  const strategySummaryMap = useMemo(() => {
    const map: Record<string, { winRate: number; tradeCount: number; netProfitPct: number; netProfit: number }> = {};
    if (!btBars || btBars.length < 30) return map;

    for (const it of STRATEGY_OPTIONS) {
      if (it.key === 'none') continue;
      const r = runBacktestNextOpen(it.key, btBars, btCapital, btConfig, stParams);
      if (r.ok) {
        // Use *closed* trades count because winRate is based on closed trades
        const closed = r.trades.filter((t) => !t.open).length;
        map[it.key] = { winRate: r.winRate, tradeCount: closed, netProfitPct: r.netProfitPct, netProfit: r.netProfit };
      } else {
        map[it.key] = { winRate: Number.NaN, tradeCount: 0, netProfitPct: Number.NaN, netProfit: 0 };
      }
    }

    return map;
  }, [btBars, btCapital, btConfig, stParams]);

  const sortedStrategyItems = useMemo(() => {
    const q = dlgQuery.trim().toLowerCase();
    const items = STRATEGY_OPTIONS.filter((it) => {
      if (!q) return true;
      const labelText = strategyLabel(it.key);
      const noteText = strategyNote(it.key);
      return labelText.toLowerCase().includes(q) || noteText.toLowerCase().includes(q);
    });

    // Keep "无策略" pinned at top, others sorted by backtest win rate (current freq)
    const none = items.find((it) => it.key === 'none');
    const rest = items.filter((it) => it.key !== 'none');

    const getWin = (k: StrategyKey) => {
      const s = strategySummaryMap[k];
      if (!s) return -1;
      if (s.tradeCount <= 0) return -1;
      return Number.isFinite(s.winRate) ? s.winRate : -1;
    };
    const getTrades = (k: StrategyKey) => strategySummaryMap[k]?.tradeCount ?? 0;
    const getNet = (k: StrategyKey) => {
      const s = strategySummaryMap[k];
      if (!s) return -1;
      if (s.tradeCount <= 0) return -1;
      return Number.isFinite(s.netProfitPct) ? s.netProfitPct : -1;
    };
    const getVal = (k: StrategyKey) => {
      if (strategySort === 'tradeCount') return getTrades(k);
      if (strategySort === 'netProfitPct') return getNet(k);
      return getWin(k);
    };

    rest.sort((a, b) => {
      const av = getVal(a.key);
      const bv = getVal(b.key);
      if (bv !== av) return bv - av;

      const aw = getWin(a.key);
      const bw = getWin(b.key);
      if (bw !== aw) return bw - aw;
      const at = getTrades(a.key);
      const bt = getTrades(b.key);
      if (bt !== at) return bt - at;
      const an = getNet(a.key);
      const bn = getNet(b.key);
      if (bn !== an) return bn - an;
      return a.label.localeCompare(b.label);
    });

    return none ? [none, ...rest] : rest;
  }, [dlgQuery, strategySummaryMap, strategySort]);

  const strategyRankMap = useMemo(() => {
    const map: Record<string, number> = {};
    let r = 0;
    for (const it of sortedStrategyItems) {
      if (it.key === 'none') continue;
      r += 1;
      map[it.key] = r;
    }
    return map;
  }, [sortedStrategyItems]);

  const openIndicators = () => {
    setDlgTab('indicators');
    setDlgOpen(true);
  };

  const openStrategies = () => {
    setDlgTab('strategies');
    setDlgOpen(true);
  };

  const openBacktest = () => {
    setDlgTab('backtest');
    setDlgOpen(true);
  };

  const mainHeight = showRSI || showMACD ? 420 : 540;
  const paneHeight = 140;

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0d0d0d] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-7 text-right text-xs text-gray-500 pt-0.5"></div>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-white truncate">{title || symbol}</div>
              <div className="mt-1 text-xs text-gray-400">{t('ashare.dataSourceHint')}</div>
            </div>
          </div>

          <a
            href={tvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-200"
            title={t('btn.openTradingView')}
          >
            TradingView <span aria-hidden>↗</span>
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-semibold text-white">{fmt(derived.lastClose)}</div>
            <div className={cn('text-sm font-medium', changeClass)}>
              {derived.change == null ? '--' : `${derived.change > 0 ? '+' : ''}${fmt(derived.change)} (${derived.pct != null ? `${derived.pct > 0 ? '+' : ''}${fmt(derived.pct, 2)}%` : '--'})`}
            </div>
            <div className="text-xs text-gray-500">
              {updatedAt ? t('ashare.panel.updatedAt', { time: updatedAt }) : ''}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Freq buttons */}
            <div className="flex items-center gap-1">
              {FREQ_OPTIONS.map((o) => (
                <Button
                  key={o.key}
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={loading || !!o.disabled}
                  onClick={() => setFreq(o.key)}
                  className={cn(
                    'rounded-full bg-white/5 text-gray-200 hover:bg-white/10',
                    freq === o.key && 'bg-white/15 text-white'
                  )}
                >
                  {t(o.labelKey)}
                </Button>
              ))}
            </div>

              <Button type="button" variant="secondary" size="sm" className={cn('rounded-full bg-white/5 text-gray-200 hover:bg-white/10')} onClick={openIndicators}>
               {t('ashare.panel.indicators')}
              </Button>

              <Button type="button" variant="secondary" size="sm" className={cn('rounded-full bg-white/5 text-gray-200 hover:bg-white/10')} onClick={openStrategies}>
               {t('ashare.panel.strategies')}
              </Button>

              <Button type="button" variant="secondary" size="sm" className={cn('rounded-full bg-white/5 text-gray-200 hover:bg-white/10')} onClick={openBacktest}>
               {t('ashare.panel.backtest')}
              </Button>

              <Button type="button" variant="secondary" size="sm" className={cn('rounded-full bg-white/5 text-gray-200 hover:bg-white/10')} onClick={resetAll}>
               {t('ashare.panel.reset')}
              </Button>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative">
        <div className="relative px-4 pb-4">
          <MainChart
            bars={bars}
            indicatorData={overlayIndicatorData}
            markers={strategyCalc.markers}
            themeColors={mainThemeColors}
            height={mainHeight}
            freq={freq}
            showMarkers={strategy !== 'none'}
            markerLabels={{ buy: t('action.buy'), sell: t('action.sell') }}
            onChartReady={handleMainChartReady}
          />
          <RSIChart
            showRSI={showRSI}
            rsiData={indicatorData.rsi14}
            themeColors={paneThemeColors}
            height={paneHeight}
            onChartReady={handleRSIChartReady}
          />
          <MACDChart
            showMACD={showMACD}
            macdData={{ macdHist: indicatorData.macdHist, macd: indicatorData.macd, macdSignal: indicatorData.macdSignal }}
            themeColors={paneThemeColors}
            height={paneHeight}
            onChartReady={handleMACDChartReady}
          />
        </div>
      </div>

      {/* Regime + external + params */}
      <RegimeExternalPanel
        t={t}
        symbol={symbol}
        decision={decision}
        decisionMeta={decisionMeta}
        decisionLoading={decisionLoading}
        decisionError={decisionError}
        refreshDecision={refreshDecision}
        refreshInterval={refreshInterval}
        setRefreshInterval={setRefreshInterval}
        newsDlgOpen={newsDlgOpen}
        setNewsDlgOpen={setNewsDlgOpen}
        newsItems={newsItems}
        newsLoading={newsLoading}
        newsError={newsError}
        translateCount={translateCount}
        configDraft={configDraft}
        setConfigDraft={setConfigDraft}
        configLoading={configLoading}
        applyConfig={applyConfig}
        startAutoTune={startAutoTune}
        applyRecommended={applyRecommended}
        rollbackConfig={rollbackConfig}
        autoTuneLoading={autoTuneLoading}
        autoTuneError={autoTuneError}
        autoTuneResult={autoTuneResult}
        autoTuneBackup={autoTuneBackup}
      />

      {/* Footer cards */}
      <FooterCards
        t={t}
        regimeInfo={regimeInfo}
        derived={derived}
        strategy={strategy}
        strategyLabel={strategyLabel}
        strategyStatus={strategyCalc.status}
        autoStrategy={autoStrategy}
        onToggleAutoStrategy={() => setAutoStrategy((prev) => !prev)}
        recommendations={recommendations}
        strategySummaryMap={strategySummaryMap}
      />

      {/* TradingView-like Dialog */}
      <TradingViewDialog
        t={t}
        open={dlgOpen}
        onOpenChange={setDlgOpen}
        dlgTab={dlgTab}
        setDlgTab={setDlgTab}
        dlgCategory={dlgCategory}
        setDlgCategory={setDlgCategory}
        dlgQuery={dlgQuery}
        setDlgQuery={setDlgQuery}
        strategySort={strategySort}
        setStrategySort={setStrategySort}
        sortedIndicatorItems={sortedIndicatorItems}
        enabledIndicators={enabledIndicators}
        favorites={favorites}
        setFavorites={setFavorites}
        toggleIndicator={toggleIndicator}
        indicatorNameKey={indicatorNameKey}
        indicatorDescKey={indicatorDescKey}
        categoryLabel={categoryLabel}
        sortedStrategyItems={sortedStrategyItems}
        strategy={strategy}
        setStrategy={setStrategy}
        strategyLabel={strategyLabel}
        strategyNote={strategyNote}
        strategySummaryMap={strategySummaryMap}
        strategyRankMap={strategyRankMap}
        recommendations={recommendations}
        regimeInfo={regimeInfo}
        regimeLabel={regimeLabel}
        stParams={stParams}
        setStParams={setStParams}
        btWindowMode={btWindowMode}
        setBtWindowMode={setBtWindowMode}
        btConfig={btConfig}
        setBtConfig={setBtConfig}
        btCapital={btCapital}
        autoPyramiding={autoPyramiding}
        pyramidingCandidates={pyramidingCandidates}
        pyramidingOptimizing={pyramidingOptimizing}
        applyPyramidingCandidate={applyPyramidingCandidate}
        backtest={backtest}
        equityPoints={equityPoints}
      />

    </div>
  );
}




// =========================
// Helpers
// =========================
function tvChartUrl(symbol: string): string {
  // symbol may arrive URL-encoded (e.g. "SSE%3A603516"), normalize to TradingView query
  let s = symbol;
  try {
    s = decodeURIComponent(symbol);
  } catch {
    // ignore
  }
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(s)}`;
}
