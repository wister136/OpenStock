'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { OHLCVBar } from '@/lib/indicators';
import { bollingerBands, ema, lastFinite, macd, rollingMax, rollingMin, rsi, sma } from '@/lib/indicators';
import { useI18n } from '@/lib/i18n';

import { detectMarketRegime, recommendStrategies } from './engine/regime';
import type { MarketRegimeInfo, StrategyRecommendation } from './types';

import type {
  AllowedFreq,
  StrategyKey,
  StrategyParams,
  IndicatorKey,
  Marker,
  OverlayMarker,
  StrategySignal,
  BacktestTrade,
  BacktestResult,
  BacktestConfig,
  BacktestEntryMode,
} from './types';
import {
DEFAULT_INITIAL_CAPITAL,
  DEFAULT_STRATEGY_PARAMS,
  DEFAULT_BACKTEST_CONFIG,
  FEE_BPS,
  SLIPPAGE_BPS,
  ALLOW_PYRAMIDING,
  PYRAMID_ORDER_LOTS,
  PYRAMID_MAX_ENTRIES,
  ALLOW_SAME_DIR_REPEAT,
  FORCE_CLOSE_AT_END,
  FREQ_OPTIONS,
  INDICATOR_OPTIONS,
  STRATEGY_OPTIONS,
} from './types';
import { safeLocalStorageGet, safeLocalStorageSet } from './hooks/useLocalStorageState';
import { computeStrategySignals, buildStrategyMarkers } from './engine/strategies';
import { runBacktestNextOpen } from './engine/backtest';
import BacktestConfigPanel, { type PyramidingCandidate } from './ui/BacktestConfigPanel';
import StrategyParamsPanel from './ui/StrategyParamsPanel';
import TradeTable from './ui/TradeTable';
import ReliabilityBanner from './ui/ReliabilityBanner';
import StrategyRulesDialog from './ui/StrategyRulesDialog';
import ExternalNewsTicker from '@/components/ExternalNewsTicker';

export default function AshareKlinePanel({ symbol, title }: { symbol: string; title?: string }) {
  const { t } = useI18n();

  type RegimeConfig = {
    weights: {
      w_trend: number;
      w_range: number;
      w_panic: number;
      w_news: number;
      w_realtime: number;
    };
    thresholds: {
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
    positionCaps: {
      trend: number;
      range: number;
      panic: number;
    };
  };

  type DecisionPayload = {
    regime: 'TREND' | 'RANGE' | 'PANIC';
    regime_confidence: number;
    strategy: 'TSMOM' | 'MEAN_REVERSION' | 'RISK_OFF';
    action: 'BUY' | 'SELL' | 'HOLD';
    position_cap: number;
    external_signals: {
      news?: { score: number; confidence: number; ts: number };
      realtime?: { volSurprise: number; amtSurprise: number; ts: number };
    };
    reasons: string[];
    serverTime: number;
    external_used: { news: boolean; realtime: boolean };
    news_source: 'items_rolling' | 'snapshot' | 'none';
  };

  type DecisionMeta = {
    cacheHit: boolean;
    dataFreshness: {
      barsAgeMs: number;
      newsAgeMs: number | null;
      realtimeAgeMs: number | null;
    };
    serverTime: number;
    external_used: { news: boolean; realtime: boolean };
    news_source: 'items_rolling' | 'snapshot' | 'none';
  };

  const tvUrl = useMemo(() => tvChartUrl(symbol), [symbol]);

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

  const updateConfigField = useCallback(
    <T extends keyof RegimeConfig>(section: T, key: keyof RegimeConfig[T], value: number) => {
      setConfigDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [key]: value,
          },
        };
      });
    },
    []
  );

  const fmtPct = (v?: number) => {
    if (v == null || !Number.isFinite(v)) return '--';
    return `${(v * 100).toFixed(0)}%`;
  };

  const fmtTs = (ts?: number) => {
    if (!ts || !Number.isFinite(ts)) return '--';
    return new Date(ts).toLocaleTimeString();
  };

  const fmtAge = (ms?: number | null) => {
    if (ms == null || !Number.isFinite(ms)) return '--';
    const min = Math.max(0, Math.floor(ms / 60000));
    return `${min}m`;
  };

  const fmtNewsSource = (source?: DecisionMeta['news_source']) => {
    if (!source) return '--';
    if (source === 'items_rolling') return t('ashare.panel.newsSourceRolling');
    if (source === 'snapshot') return t('ashare.panel.newsSourceSnapshot');
    return t('ashare.panel.newsSourceNone');
  };

  const translateReason = useCallback(
    (reason: string) => {
      const map: Record<string, string> = {
        'News sentiment indicates panic risk': 'ashare.reason.newsPanic',
        'News sentiment supports trend': 'ashare.reason.newsTrend',
        'Realtime surprise confirms trend direction': 'ashare.reason.realtimeTrend',
        'Realtime surprise indicates downside risk': 'ashare.reason.realtimeDownside',
        'Hysteresis hold: confidence below threshold': 'ashare.reason.hysteresisHold',
        'News signal unavailable (missing or stale) -> fallback to Kline': 'ashare.reason.newsUnavailable',
        'Realtime signal unavailable (missing or stale) -> fallback to Kline': 'ashare.reason.realtimeUnavailable',
        'RSI neutral zone': 'ashare.reason.rsiNeutral',
        'RSI oversold': 'ashare.reason.rsiOversold',
        'RSI overbought': 'ashare.reason.rsiOverbought',
        'Price above EMA20/EMA60 with positive slope': 'ashare.reason.tsmomUp',
        'Price below EMA20': 'ashare.reason.tsmomDown',
        'TSMOM neutral signal': 'ashare.reason.tsmomNeutral',
        'Risk-off: price below EMA20': 'ashare.reason.riskOffSell',
        'Risk-off: hold cash': 'ashare.reason.riskOffHold',
        'PANIC regime: BUY disabled': 'ashare.reason.panicNoBuy',
        'Cooldown active: hold to avoid over-trading': 'ashare.reason.cooldown',
        'Cost filter: low volume regime, hold': 'ashare.reason.costHold',
        'Rolling news sentiment negative': 'ashare.reason.newsRollingNegative',
        'Rolling news sentiment positive': 'ashare.reason.newsRollingPositive',
        'Rolling news sentiment neutral': 'ashare.reason.newsRollingNeutral',
      };
      const key = map[reason];
      if (key) return t(key);
      const rollingMatch = reason.match(
        /^Rolling news sentiment (negative|positive|neutral) \(([-0-9.]+)\) contributes to regime(?:, top: (.*))?$/
      );
      if (rollingMatch) {
        const dir = rollingMatch[1];
        const score = rollingMatch[2];
        const titles = rollingMatch[3] ?? '';
        const dirKey =
          dir === 'negative'
            ? 'ashare.reason.newsRollingNegative'
            : dir === 'positive'
              ? 'ashare.reason.newsRollingPositive'
              : 'ashare.reason.newsRollingNeutral';
        const titleLabel = titles ? ` ${t('ashare.reason.newsRollingTop')}${titles}` : '';
        return `${t(dirKey)} (${score})${titleLabel}`;
      }
      return reason;
    },
    [t]
  );

  const renderNewsSourceBadge = (source?: DecisionMeta['news_source']) => {
    if (!source) return null;
    const meta =
      source === 'items_rolling'
        ? { label: t('ashare.panel.newsSourceRolling'), cls: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' }
        : source === 'snapshot'
          ? { label: t('ashare.panel.newsSourceSnapshot'), cls: 'text-blue-300 border-blue-400/40 bg-blue-500/10' }
          : { label: t('ashare.panel.newsSourceNone'), cls: 'text-gray-300 border-white/10 bg-white/5' };
    return <span className={cn('ml-2 text-[10px] px-2 py-0.5 rounded border', meta.cls)}>{meta.label}</span>;
  };

  const [freq, setFreq] = useState<AllowedFreq>('30m');
  const [loading, setLoading] = useState(false);
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [regimeConfig, setRegimeConfig] = useState<RegimeConfig | null>(null);
  const [configDraft, setConfigDraft] = useState<RegimeConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);

  const [decision, setDecision] = useState<DecisionPayload | null>(null);
  const [decisionMeta, setDecisionMeta] = useState<DecisionMeta | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [showAllReasons, setShowAllReasons] = useState(false);
  const [showParams, setShowParams] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<'3s' | '5s' | '10s' | 'manual'>('5s');
  const [autoTuneLoading, setAutoTuneLoading] = useState(false);
  const [autoTuneError, setAutoTuneError] = useState<string | null>(null);
  const [autoTuneResult, setAutoTuneResult] = useState<any>(null);
  const [autoTuneBackup, setAutoTuneBackup] = useState<RegimeConfig | null>(null);



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

  // Load regime config
  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      setConfigLoading(true);
      try {
        const res = await fetch(`/api/ashare/config?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const cfg = json?.config as RegimeConfig | undefined;
        if (!cfg || cancelled) return;
        setRegimeConfig(cfg);
        setConfigDraft(cfg);
        setConfigVersion((v) => v + 1);
      } catch {
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    }
    if (symbol) loadConfig();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const refreshDecision = useCallback(async () => {
    if (!symbol || !regimeConfig) return;
    setDecisionLoading(true);
    setDecisionError(null);
    try {
      const url = `/api/ashare/decision?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(freq)}&limit=500`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setDecisionError(text || `HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      if (json?.decision) {
        setDecision(json.decision as DecisionPayload);
        setDecisionMeta({
          cacheHit: Boolean(json?.cacheHit),
          dataFreshness: json?.dataFreshness ?? { barsAgeMs: 0, newsAgeMs: null, realtimeAgeMs: null },
          serverTime: json?.serverTime ?? Date.now(),
          external_used: json?.external_used ?? { news: false, realtime: false },
          news_source: json?.news_source ?? 'none',
        });
      }
    } catch (e: any) {
      setDecisionError(String(e?.message ?? e));
    } finally {
      setDecisionLoading(false);
    }
  }, [symbol, freq, regimeConfig]);

  useEffect(() => {
    let cancelled = false;
    if (!symbol || !regimeConfig) return;
    refreshDecision();
    if (refreshInterval === 'manual') return;
    const ms = refreshInterval === '3s' ? 3000 : refreshInterval === '10s' ? 10000 : 5000;
    const id = setInterval(() => {
      if (!cancelled) refreshDecision();
    }, ms);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, freq, regimeConfig, configVersion, refreshDecision, refreshInterval]);

  const applyConfig = useCallback(async (override?: RegimeConfig) => {
    const payload = override ?? configDraft;
    if (!payload) return;
    setConfigLoading(true);
    try {
      const res = await fetch('/api/ashare/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          weights: payload.weights,
          thresholds: payload.thresholds,
          positionCaps: payload.positionCaps,
        }),
      });
      if (!res.ok) {
        return;
      }
      const json = await res.json();
      const cfg = json?.config as RegimeConfig | undefined;
      if (cfg) {
        setRegimeConfig(cfg);
        setConfigDraft(cfg);
        setConfigVersion((v) => v + 1);
        refreshDecision();
      }
    } finally {
      setConfigLoading(false);
    }
  }, [configDraft, symbol, refreshDecision]);

  const loadAutoTune = useCallback(async () => {
    if (!symbol) return;
    try {
      const res = await fetch(`/api/ashare/autotune?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(freq)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setAutoTuneResult(json?.latest ?? null);
    } catch {
    }
  }, [symbol, freq]);

  useEffect(() => {
    loadAutoTune();
  }, [loadAutoTune]);

  const startAutoTune = useCallback(async () => {
    if (!symbol) return;
    setAutoTuneLoading(true);
    setAutoTuneError(null);
    try {
      const res = await fetch('/api/ashare/autotune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, tf: freq, trainDays: 180, trials: 80 }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setAutoTuneError(text || `HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      setAutoTuneResult({
        trainDays: json.trainDays,
        trials: json.trials,
        objective: json.objective,
        bestParams: json.bestParams,
        metrics: json.metrics,
        createdAt: new Date(json.serverTime).toISOString(),
      });
    } catch (e: any) {
      setAutoTuneError(String(e?.message ?? e));
    } finally {
      setAutoTuneLoading(false);
    }
  }, [symbol, freq]);

  const applyRecommended = useCallback(async () => {
    if (!autoTuneResult?.bestParams) return;
    if (regimeConfig) setAutoTuneBackup(regimeConfig);
    const best = autoTuneResult.bestParams;
    const nextConfig = {
      weights: best.weights,
      thresholds: best.thresholds,
      positionCaps: best.positionCaps,
    } as RegimeConfig;
    setConfigDraft(nextConfig);
    applyConfig(nextConfig);
  }, [autoTuneResult, applyConfig, regimeConfig]);

  const rollbackConfig = useCallback(async () => {
    if (!autoTuneBackup) return;
    setConfigDraft(autoTuneBackup);
    applyConfig(autoTuneBackup);
  }, [autoTuneBackup, applyConfig]);
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
 // 新增：回测窗口模式
  const [btWindowMode, setBtWindowMode] = useState<'full' | 'recent_60' | 'recent_120'>('full');

  // 新增：仓位模式（固定手数 / 全仓复利）
  const [btEntryMode, setBtEntryMode] = useState<BacktestEntryMode>(() => {
    const stored = safeLocalStorageGet('openstock_bt_entry_mode_v1');
    return stored === 'ALL_IN' ? 'ALL_IN' : 'FIXED';
  });

  // Strategy (A: arrows only)
  const [strategy, setStrategy] = useState<StrategyKey>('none');
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleKey, setRuleKey] = useState<StrategyKey>('none');

  const [overlayMarkers, setOverlayMarkers] = useState<OverlayMarker[]>([]);

  // Backtest settings (B: report)
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

  // Auto pyramiding optimizer (order lots + max entries)
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
    // allow decimals; clamp to a sensible range
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
    safeLocalStorageSet('openstock_bt_date_from_v1', btDateFromText || '');
  }, [btDateFromText]);

  useEffect(() => {
    safeLocalStorageSet('openstock_bt_date_to_v1', btDateToText || '');
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

// 新增：计算市场状态与推荐策略
  useEffect(() => {
    if (!bars || bars.length < 60) {
      setRegimeInfo(null);
      setRecommendations([]);
      return;
    }
    const info = detectMarketRegime(bars);
    setRegimeInfo(info);

    const timer = setTimeout(() => {
      // 默认评估最近 1000 根K线（约 5-6 个月，对 30m/60m 更友好）
      const recs = recommendStrategies(bars, btCapital, stParams, info.regime, 1000);
      setRecommendations(recs);
    }, 100);
    return () => clearTimeout(timer);
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

  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const rsiContainerRef = useRef<HTMLDivElement | null>(null);
  const macdContainerRef = useRef<HTMLDivElement | null>(null);

  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  const ma5SeriesRef = useRef<any>(null);
  const ma10SeriesRef = useRef<any>(null);
  const ma20SeriesRef = useRef<any>(null);
  const ema20SeriesRef = useRef<any>(null);

  const bbUpperSeriesRef = useRef<any>(null);
  const bbMidSeriesRef = useRef<any>(null);
  const bbLowerSeriesRef = useRef<any>(null);

  const rsiChartRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);
  const rsiLinesAddedRef = useRef(false);

  const macdChartRef = useRef<any>(null);
  const macdLineSeriesRef = useRef<any>(null);
  const macdSignalSeriesRef = useRef<any>(null);
  const macdHistSeriesRef = useRef<any>(null);

  const chartsEpochRef = useRef(0);
  const bumpChartsEpoch = () => {
    chartsEpochRef.current += 1;
    setChartsEpoch(chartsEpochRef.current);
  };
  const [chartsEpoch, setChartsEpoch] = useState(0);

  useEffect(() => {
    const stored = safeLocalStorageGet('openstock_tv_favs_v1');
    if (stored && typeof stored === 'object') setFavorites(stored);
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

  const strategyCalc = useMemo(() => buildStrategyMarkers(strategy, bars, stParams), [strategy, bars, stParams]);
  const btConfig = useMemo(
    () => ({
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
    
      risk: {
        ...(DEFAULT_BACKTEST_CONFIG.risk ?? {}),
        hardMaxDdPct: btHardDdPct,
        maxDdCircuitPct: btHardDdPct > 0 ? Math.max(0, Math.min(btHardDdPct * 0.84, btHardDdPct - 0.3)) : 0,
      },
    }),
    [btEntryMode, btFeeBps, btSlippageBps, btAllowPyramiding, btAllowSameDirRepeat, btOrderLots, btMaxEntries, btHardDdPct, btDateFromText, btDateToText]
  );

//   // Backtest sample filtering by date range (YYYY-MM-DD, no time)
//   const btBars = useMemo(() => {
//     if (!bars || bars.length === 0) return bars;
//     const from = btDateFromText?.trim();
//     const to = btDateToText?.trim();
//     if (!from && !to) return bars;
//
//     const toSec = (d: string, endOfDay: boolean) => {
//       if (!d) return NaN;
//       const iso = endOfDay ? `${d}T23:59:59` : `${d}T00:00:00`;
//       const ms = Date.parse(iso);
//       return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
//     };
//
//     const startSec = from ? toSec(from, false) : NaN;
//     const endSec = to ? toSec(to, true) : NaN;
//
//     // invalid input -> fallback to full sample
//     if ((from && !Number.isFinite(startSec)) || (to && !Number.isFinite(endSec))) return bars;
//
//     const lo = Number.isFinite(startSec) ? startSec : -Infinity;
//     const hi = Number.isFinite(endSec) ? endSec : Infinity;
//     const filtered = bars.filter((b) => b.t >= lo && b.t <= hi);
//     // Avoid empty sample which makes UI confusing
//     return filtered.length >= 10 ? filtered : bars;
//   }, [bars, btDateFromText, btDateToText]);

    // 修改：支持滚动窗口选择
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

      // Date range (YYYY-MM-DD)
      // IMPORTANT: allow explicitly clearing the date range by setting undefined
      // (the panel's "清除" button sets dateFrom/dateTo to undefined)
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
      setPyramidingCandidates((prev) => prev); // keep list
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

    // Grid search (fast): choose best combination by PF-first score.
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

          // Hard constraint: keep drawdown <= user-defined limit (default 5%).
          const ddLimit = btHardDdPct ?? 5.0;
          if (ddLimit > 0 && mdd > ddLimit) continue;

          // PF-first score with drawdown penalty (stable in choppy markets)
          const pfScore = pf == null ? 0 : Number.isFinite(pf) ? pf : 99;
          const tooFewTradesPenalty = tradeCount < 3 ? 25 : 0;
          // PF-first objective, but strongly prefer lower DD within the <=5% band.
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

      // Auto apply the best one to save user's time
      if (candidates[0]) {
        applyPyramidingCandidate(candidates[0]);
      }
    } finally {
      setPyramidingOptimizing(false);
    }
  }, [btBars, strategy, btCapital, btConfig, stParams, applyPyramidingCandidate]);
  const backtest = useMemo(
    () => runBacktestNextOpen(strategy, btBars, btCapital, btConfig, stParams),
    [strategy, btBars, btCapital, btConfig, stParams]
  );

  const equityPoints = useMemo(() => buildEquityPoints(backtest as any, btBars as any, btCapital), [backtest, btBars, btCapital]);

  const changeClass =
    derived.change == null
      ? 'text-gray-300'
      : derived.change > 0
        ? 'text-red-500'
        : derived.change < 0
          ? 'text-green-500'
          : 'text-gray-300';

  // Fetch bars
  useEffect(() => {
    let cancelled = false;

    function getBarLimitByFreq(f: string): number {
      // NOTE: Many users expect "最近2个月" to be included in backtest.
      // Fixed limit=1200 is not enough for intraday (e.g., 5m ≈ 25 trading days).
      switch (f) {
        case '1m':
          return 18000;
        case '5m':
          return 9000;
        case '15m':
          return 4500;
        case '30m':
          return 2400;
        case '60m':
          return 1800;
        case '1d':
        default:
          return 1200;
      }
    }

    async function load() {
      setLoading(true);
      const limit = getBarLimitByFreq(freq);
      const url = `/api/ashare/bars?symbol=${encodeURIComponent(symbol)}&freq=${encodeURIComponent(freq)}&limit=${limit}`;
      console.log(`[bars] fetching symbol=${symbol} freq=${freq}`);

      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error(`[bars] API HTTP ${res.status} ${res.statusText}`, text);
          if (cancelled) return;
          setBars([]);
          setUpdatedAt(null);
          return;
        }

        const json = await res.json();
        const count = json?.count ?? json?.bars?.length ?? 0;
        console.log(`[bars] fetched ok=${json?.ok} count=${count}`);

        const rawBars = (json?.bars ?? []) as any[];
        const mapped: OHLCVBar[] = rawBars
          .map((b) => {
            const t0 = b.t;
            const t = typeof t0 === 'number' ? (t0 > 1e12 ? Math.floor(t0 / 1000) : Math.floor(t0)) : NaN;
            return {
              t,
              o: Number(b.o),
              h: Number(b.h),
              l: Number(b.l),
              c: Number(b.c),
              v: Number(b.v ?? 0),
            };
          })
          .filter((b) => Number.isFinite(b.t) && Number.isFinite(b.o) && Number.isFinite(b.h) && Number.isFinite(b.l) && Number.isFinite(b.c));

        const bad = mapped.slice(0, 5).filter((b) => !Number.isFinite(b.t));
        if (bad.length) console.error('[bars] BAD timestamp sample:', bad);

        if (cancelled) return;
        setBars(mapped);
        setUpdatedAt(new Date().toLocaleString());
      } catch (e: any) {
        console.error('[bars] fetch error', e);
        if (cancelled) return;
        setBars([]);
        setUpdatedAt(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol, freq]);

  // Init main chart
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init() {
      if (!mainContainerRef.current) return;

      const { createChart, CandlestickSeries, HistogramSeries } = await import('lightweight-charts');

      // Dispose old
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {}
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }

      const chart = createChart(mainContainerRef.current, {
        autoSize: true,
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: {
            time: true,
            price: true,
          },
          mouseWheel: true,
          pinch: true,
        },
        layout: {
          background: { color: '#0d0d0d' },
          textColor: 'rgba(255,255,255,0.75)',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.06)' },
          horzLines: { color: 'rgba(255,255,255,0.06)' },
        },
        crosshair: {
          vertLine: { color: 'rgba(255,255,255,0.25)', width: 1 },
          horzLine: { color: 'rgba(255,255,255,0.25)', width: 1 },
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.08)',
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.08)',
        },
      });

      const candles = chart.addSeries(CandlestickSeries, {
        upColor: '#ef4444',
        downColor: '#22c55e',
        borderUpColor: '#ef4444',
        borderDownColor: '#22c55e',
        wickUpColor: '#ef4444',
        wickDownColor: '#22c55e',
      });

      const volume = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      volume.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      chartRef.current = chart;
      candleSeriesRef.current = candles;
      volumeSeriesRef.current = volume;

      // Prevent any embedded anchor inside the chart container from hijacking clicks
      // (e.g., lightweight-charts attribution link in some builds).
      const el = mainContainerRef.current;
      const onClickCapture = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const a = target.closest?.('a');
        if (a) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      const onWheelCapture = (e: WheelEvent) => {
        // Keep wheel for chart zoom, prevent page scroll
        if (e.ctrlKey) return;
        e.preventDefault();
      };
      el.addEventListener('click', onClickCapture, { capture: true } as any);
      el.addEventListener('wheel', onWheelCapture, { capture: true, passive: false } as any);

      cleanup = () => {
        el.removeEventListener('click', onClickCapture, { capture: true } as any);
        el.removeEventListener('wheel', onWheelCapture, { capture: true } as any);
      };

      bumpChartsEpoch();
    }

    init();
    return () => {
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Init / destroy RSI chart
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function initRSI() {
      if (!showRSI) {
        if (rsiChartRef.current) {
          try {
            rsiChartRef.current.remove();
          } catch (e) {}
          rsiChartRef.current = null;
          rsiSeriesRef.current = null;
          rsiLinesAddedRef.current = false;
          bumpChartsEpoch();
        }
        return;
      }
      if (!rsiContainerRef.current || rsiChartRef.current) return;

      const { createChart, LineSeries } = await import('lightweight-charts');

      const chart = createChart(rsiContainerRef.current, {
        autoSize: true,
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
        layout: {
          background: { color: '#0d0d0d' },
          textColor: 'rgba(255,255,255,0.65)',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.06)' },
          horzLines: { color: 'rgba(255,255,255,0.06)' },
        },
        crosshair: {
          vertLine: { color: 'rgba(255,255,255,0.20)', width: 1 },
          horzLine: { color: 'rgba(255,255,255,0.20)', width: 1 },
        },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
        timeScale: { visible: false, borderColor: 'rgba(255,255,255,0.08)' },
      });

      const line = chart.addSeries(LineSeries, {
        lineWidth: 2,
        color: 'rgba(59,130,246,0.9)',
        priceLineVisible: false,
        lastValueVisible: true,
      });

      rsiChartRef.current = chart;
      rsiSeriesRef.current = line;

      cleanup = () => {
        // nothing additional
      };

      bumpChartsEpoch();
    }

    initRSI();
    return () => cleanup?.();
  }, [showRSI]);

  // Init / destroy MACD chart
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function initMACD() {
      if (!showMACD) {
        if (macdChartRef.current) {
          try {
            macdChartRef.current.remove();
          } catch (e) {}
          macdChartRef.current = null;
          macdLineSeriesRef.current = null;
          macdSignalSeriesRef.current = null;
          macdHistSeriesRef.current = null;
          bumpChartsEpoch();
        }
        return;
      }
      if (!macdContainerRef.current || macdChartRef.current) return;

      const { createChart, LineSeries, HistogramSeries } = await import('lightweight-charts');

      const chart = createChart(macdContainerRef.current, {
        autoSize: true,
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
        layout: {
          background: { color: '#0d0d0d' },
          textColor: 'rgba(255,255,255,0.65)',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.06)' },
          horzLines: { color: 'rgba(255,255,255,0.06)' },
        },
        crosshair: {
          vertLine: { color: 'rgba(255,255,255,0.20)', width: 1 },
          horzLine: { color: 'rgba(255,255,255,0.20)', width: 1 },
        },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
        timeScale: { visible: false, borderColor: 'rgba(255,255,255,0.08)' },
      });

      const hist = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
        priceScaleId: 'right',
      });

      const macdLine = chart.addSeries(LineSeries, {
        lineWidth: 2,
        color: 'rgba(168,85,247,0.9)',
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const signalLine = chart.addSeries(LineSeries, {
        lineWidth: 2,
        color: 'rgba(234,179,8,0.9)',
        priceLineVisible: false,
        lastValueVisible: true,
      });

      macdChartRef.current = chart;
      macdHistSeriesRef.current = hist;
      macdLineSeriesRef.current = macdLine;
      macdSignalSeriesRef.current = signalLine;

      cleanup = () => {
        // nothing additional
      };

      bumpChartsEpoch();
    }

    initMACD();
    return () => cleanup?.();
  }, [showMACD]);

  // Sync visible time range across charts (TradingView-like feel)
  useEffect(() => {
    const charts = [chartRef.current, showRSI ? rsiChartRef.current : null, showMACD ? macdChartRef.current : null].filter(Boolean);
    if (charts.length < 2) return;

    let syncing = false;
    const unsubs: Array<() => void> = [];

    for (const src of charts) {
      const cb = (range: any) => {
        if (!range) return;
        if (syncing) return;
        syncing = true;
        for (const dst of charts) {
          if (dst === src) continue;
          try {
            dst.timeScale().setVisibleRange(range);
          } catch (e) {}
        }
        syncing = false;
      };

      try {
        src.timeScale().subscribeVisibleTimeRangeChange(cb);
        unsubs.push(() => src.timeScale().unsubscribeVisibleTimeRangeChange(cb));
      } catch (e) {}
    }

    return () => unsubs.forEach((fn) => fn());
  }, [chartsEpoch, showRSI, showMACD]);

  // Overlay indicator series (MA/EMA/BBANDS)
  useEffect(() => {
    let cancelled = false;

    async function syncOverlay() {
      const chart = chartRef.current;
      if (!chart) return;

      const { LineSeries } = await import('lightweight-charts');
      if (cancelled) return;

      const ensure = (ref: React.MutableRefObject<any>, opts: any) => {
        if (ref.current) return ref.current;
        ref.current = chart.addSeries(LineSeries, {
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          ...opts,
        });
        return ref.current;
      };

      const remove = (ref: React.MutableRefObject<any>) => {
        if (!ref.current) return;
        try {
          chart.removeSeries(ref.current);
        } catch (e) {}
        ref.current = null;
      };

      // MA
      if (showMA5) ensure(ma5SeriesRef, { color: 'rgba(59,130,246,0.9)' }).setData(indicatorData.ma5);
      else remove(ma5SeriesRef);

      if (showMA10) ensure(ma10SeriesRef, { color: 'rgba(234,179,8,0.9)' }).setData(indicatorData.ma10);
      else remove(ma10SeriesRef);

      if (showMA20) ensure(ma20SeriesRef, { color: 'rgba(168,85,247,0.9)' }).setData(indicatorData.ma20);
      else remove(ma20SeriesRef);

      // EMA
      if (showEMA20) ensure(ema20SeriesRef, { color: 'rgba(34,197,94,0.9)', lineStyle: 2 }).setData(indicatorData.ema20);
      else remove(ema20SeriesRef);

      // BBANDS
      if (showBB) {
        ensure(bbUpperSeriesRef, { color: 'rgba(148,163,184,0.75)', lineWidth: 1 }).setData(indicatorData.bbUpper);
        ensure(bbMidSeriesRef, { color: 'rgba(148,163,184,0.55)', lineWidth: 1, lineStyle: 2 }).setData(indicatorData.bbMid);
        ensure(bbLowerSeriesRef, { color: 'rgba(148,163,184,0.75)', lineWidth: 1 }).setData(indicatorData.bbLower);
      } else {
        remove(bbUpperSeriesRef);
        remove(bbMidSeriesRef);
        remove(bbLowerSeriesRef);
      }
    }

    syncOverlay();
    return () => {
      cancelled = true;
    };
  }, [indicatorData, showMA5, showMA10, showMA20, showEMA20, showBB]);

  // Main chart data + strategy markers
  useEffect(() => {
    let cancelled = false;

    // Strategy markers are rendered via a lightweight DOM overlay (no plugin required).

    async function sync() {
      try {
        const candles = candleSeriesRef.current;
        const volume = volumeSeriesRef.current;
        if (!candles || !volume) return;

        const candleData = bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
        const volumeData = bars.map((b) => ({
          time: b.t,
          value: b.v,
          color: b.c >= b.o ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)',
        }));

        candles.setData(candleData);
        volume.setData(volumeData);

        if (!cancelled) chartRef.current?.timeScale()?.fitContent?.();
      } catch (e) {}
    }

    void sync();
    return () => {
      cancelled = true;
    };
}, [bars, strategyCalc, chartsEpoch]);

// =========================
// Strategy markers overlay (A: arrows with BUY/SELL labels)
// =========================
useEffect(() => {
  const chart = chartRef.current;
  const candles = candleSeriesRef.current;
  if (!chart || !candles) return;

  const timeScale = chart.timeScale();

  const barsByTime = new Map<number, OHLCVBar>();
  for (const b of bars) barsByTime.set(b.t, b);

  let raf = 0;
  const calc = () => {
    raf = 0;

    // Clamp markers within container to avoid labels rendering outside.
    const rect = mainContainerRef.current?.getBoundingClientRect();
    const maxY = rect?.height ?? 0;

    const next: OverlayMarker[] = [];
    const markers = (strategyCalc.markers ?? []) as Marker[];

    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      const t = Number((m as any).time);
      if (!Number.isFinite(t)) continue;

      const x = timeScale.timeToCoordinate(t as any);
      if (x == null) continue;

      const bar = barsByTime.get(t);
      const basePrice = bar ? (m.position === 'aboveBar' ? bar.h : bar.l) : null;

      const y0 = basePrice != null ? candles.priceToCoordinate(basePrice) : null;
      if (y0 == null) continue;

      const y = m.position === 'aboveBar' ? y0 - 18 : y0 + 18;

      if (maxY && (y < 0 || y > maxY)) continue;

      next.push({
        ...(m as any),
        x,
        y,
        side: (m.side ?? ((typeof m.text === 'string' && (m.text.includes('卖') || m.text.toUpperCase().includes('SELL'))) ? 'SELL' : 'BUY')) as 'BUY' | 'SELL',
        key: `${t}-${m.text}-${i}`,
      });
    }

    setOverlayMarkers(next);
  };

  const schedule = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(calc);
  };

  schedule();
  timeScale.subscribeVisibleTimeRangeChange(schedule);
  timeScale.subscribeVisibleLogicalRangeChange(schedule);
  window.addEventListener('resize', schedule);

  return () => {
    timeScale.unsubscribeVisibleTimeRangeChange(schedule);
    timeScale.unsubscribeVisibleLogicalRangeChange(schedule);
    window.removeEventListener('resize', schedule);
    if (raf) window.cancelAnimationFrame(raf);
  };
}, [bars, strategyCalc, chartsEpoch]);

// RSI data
  useEffect(() => {
    if (!showRSI) return;
    try {
      const s = rsiSeriesRef.current;
      if (!s) return;
      s.setData(indicatorData.rsi14);

      if (!rsiLinesAddedRef.current) {
        try {
          s.createPriceLine({ price: 70, color: 'rgba(255,255,255,0.18)', lineWidth: 1, lineStyle: 2 });
          s.createPriceLine({ price: 30, color: 'rgba(255,255,255,0.18)', lineWidth: 1, lineStyle: 2 });
        } catch (e) {}
        rsiLinesAddedRef.current = true;
      }
    } catch (e) {}
  }, [showRSI, indicatorData]);

  // MACD data
  useEffect(() => {
    if (!showMACD) return;
    try {
      macdHistSeriesRef.current?.setData?.(indicatorData.macdHist);
      macdLineSeriesRef.current?.setData?.(indicatorData.macd);
      macdSignalSeriesRef.current?.setData?.(indicatorData.macdSignal);
    } catch (e) {}
  }, [showMACD, indicatorData]);

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
          <div className="relative" style={{ height: mainHeight }}>
            <div ref={mainContainerRef} className="w-full h-full" />

            {/* Strategy markers overlay (DOM layer) */}
            {strategy !== 'none' && overlayMarkers.length > 0 && (
              // NOTE: lightweight-charts uses multiple canvases with z-index.
              // If we don't set a higher z-index here, the DOM overlay can be hidden behind the canvases.
              <div className="pointer-events-none absolute inset-0 z-20">
                {overlayMarkers.map((m) => {
                  const isSell = (m.side ?? (typeof m.text === 'string' && (m.text.includes('卖') || m.text.toUpperCase().includes('SELL')) ? 'SELL' : 'BUY')) === 'SELL';
                  return (
                    <div
                      key={m.key ?? `${m.time}-${m.side}-${m.index ?? 0}`}
                      className={`absolute z-50 whitespace-nowrap rounded bg-black/70 border border-white/10 px-2 py-1 text-xs ${isSell ? 'text-emerald-300' : 'text-red-300'}`}
                      style={{ left: m.x, top: m.y, transform: 'translate(-50%, -100%)' }}
                    >
                      <span className="mr-1">{isSell ? '▼' : '▲'}</span>
                      {isSell ? t('action.sell') : t('action.buy')}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {showRSI && <div style={{ height: paneHeight }} ref={rsiContainerRef} className="w-full mt-2" />}
          {showMACD && <div style={{ height: paneHeight }} ref={macdContainerRef} className="w-full mt-2" />}
        </div>
      </div>

      {/* Regime + external + params */}
      <div className="px-5 pb-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">{t('ashare.panel.regimeDecision')}</div>
            {decision && (
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded border',
                  decision.regime === 'TREND'
                    ? 'text-red-300 border-red-400/30 bg-red-500/10'
                    : decision.regime === 'PANIC'
                      ? 'text-yellow-300 border-yellow-400/30 bg-yellow-500/10'
                      : 'text-blue-300 border-blue-400/30 bg-blue-500/10'
                )}
              >
                {decision.regime}
              </span>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-100">
            {decisionLoading ? t('common.loading') : decisionError ? `${t('common.error')}: ${decisionError}` : decision?.strategy ?? '--'}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-400">
            <div>{t('ashare.panel.action')}</div>
            <div className="text-gray-100">
              {decision?.action ?? '--'}
            </div>
            <div>{t('ashare.panel.regimeConfidence')}</div>
            <div className="text-gray-100">
              {decision ? fmtPct(decision.regime_confidence) : '--'}
            </div>
            <div>{t('ashare.panel.positionCap')}</div>
            <div className="text-gray-100">
              {decision ? fmtPct(decision.position_cap) : '--'}
            </div>
            <div>{t('ashare.panel.serverTime')}</div>
            <div className="text-gray-100">
              {decision ? fmtTs(decision.serverTime) : '--'}
            </div>
            <div>{t('ashare.panel.cacheHit')}</div>
            <div className="text-gray-100">
              {decisionMeta ? (decisionMeta.cacheHit ? t('common.yes') : t('common.no')) : '--'}
            </div>
            <div>{t('ashare.panel.barsAge')}</div>
            <div className="text-gray-100">{decisionMeta ? fmtAge(decisionMeta.dataFreshness.barsAgeMs) : '--'}</div>
            <div>{t('ashare.panel.newsAge')}</div>
            <div className="text-gray-100">{decisionMeta ? fmtAge(decisionMeta.dataFreshness.newsAgeMs) : '--'}</div>
            <div>{t('ashare.panel.realtimeAge')}</div>
            <div className="text-gray-100">{decisionMeta ? fmtAge(decisionMeta.dataFreshness.realtimeAgeMs) : '--'}</div>
            <div>{t('ashare.panel.newsSource')}</div>
            <div className="text-gray-100">
              {decisionMeta ? fmtNewsSource(decisionMeta.news_source) : '--'}
              {decisionMeta ? renderNewsSourceBadge(decisionMeta.news_source) : null}
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-400">{t('ashare.panel.reasons')}</div>
          <div className="mt-1 space-y-1 text-xs text-gray-300">
            {(decision?.reasons ?? []).slice(0, showAllReasons ? undefined : 3).map((r, i) => (
              <div key={`${r}-${i}`}>- {translateReason(r)}</div>
            ))}
            {(decision?.reasons ?? []).length === 0 && <div>--</div>}
          </div>
          {(decision?.reasons ?? []).length > 3 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-[10px] text-gray-300"
              onClick={() => setShowAllReasons((v) => !v)}
            >
              {showAllReasons ? t('common.collapse') : t('common.expandMore')}
            </Button>
          )}
        </div>

        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <div className="text-xs text-gray-400">{t('ashare.panel.externalSignals')}</div>
          <div className="mt-2 text-xs text-gray-300">
            {decision?.external_signals?.news ? (
              <div>
                {t('ashare.panel.newsSentiment')}: {decision.external_signals.news.score.toFixed(2)} / {t('ashare.panel.confidence')}{' '}
                {decision.external_signals.news.confidence.toFixed(2)} · {fmtTs(decision.external_signals.news.ts)}
              </div>
            ) : (
              <div>{t('ashare.panel.newsFallback')}</div>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-300">
            {decision?.external_signals?.realtime ? (
              <div>
                {t('ashare.panel.realtimeSurprise')}: {t('ashare.panel.vol')} {decision.external_signals.realtime.volSurprise.toFixed(2)} · {t('ashare.panel.amt')}{' '}
                {decision.external_signals.realtime.amtSurprise.toFixed(2)} · {fmtTs(decision.external_signals.realtime.ts)}
              </div>
            ) : (
              <div>{t('ashare.panel.realtimeFallback')}</div>
            )}
          </div>
          <div className="mt-3">
            <ExternalNewsTicker symbol={symbol} />
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">{t('ashare.panel.configPanel')}</div>
            <div className="flex items-center gap-2">
              {refreshInterval === 'manual' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-gray-300"
                  onClick={refreshDecision}
                >
                  {t('common.refresh')}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-gray-300"
                onClick={() => setShowParams((v) => !v)}
              >
                {showParams ? t('common.collapse') : t('common.expand')}
              </Button>
              <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-[10px]" onClick={applyConfig} disabled={configLoading}>
                {t('common.apply')}
              </Button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {(['3s', '5s', '10s', 'manual'] as const).map((opt) => (
              <Button
                key={opt}
                type="button"
                variant="ghost"
                size="sm"
                className={cn('h-7 px-2 text-[10px]', refreshInterval === opt ? 'bg-white/10 text-white' : 'text-gray-300')}
                onClick={() => setRefreshInterval(opt)}
              >
                {opt === 'manual' ? t('ashare.panel.refreshManual') : t('ashare.panel.refreshEvery', { sec: opt.replace('s', '') })}
              </Button>
            ))}
          </div>
          {showParams && configDraft && (
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <div className="text-gray-400">{t('ashare.panel.weights')}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.weightTrend')}</div>
                    <Input type="number" step="0.01" value={configDraft.weights.w_trend} onChange={(e) => updateConfigField('weights', 'w_trend', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.weightRange')}</div>
                    <Input type="number" step="0.01" value={configDraft.weights.w_range} onChange={(e) => updateConfigField('weights', 'w_range', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.weightPanic')}</div>
                    <Input type="number" step="0.01" value={configDraft.weights.w_panic} onChange={(e) => updateConfigField('weights', 'w_panic', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.weightNews')}</div>
                    <Input type="number" step="0.01" value={configDraft.weights.w_news} onChange={(e) => updateConfigField('weights', 'w_news', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.weightRealtime')}</div>
                    <Input type="number" step="0.01" value={configDraft.weights.w_realtime} onChange={(e) => updateConfigField('weights', 'w_realtime', Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <div>
                <div className="text-gray-400">{t('ashare.panel.thresholds')}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.trendScoreThreshold')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.trendScoreThreshold} onChange={(e) => updateConfigField('thresholds', 'trendScoreThreshold', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.panicVolRatio')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.panicVolRatio} onChange={(e) => updateConfigField('thresholds', 'panicVolRatio', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.panicDrawdown')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.panicDrawdown} onChange={(e) => updateConfigField('thresholds', 'panicDrawdown', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.volRatioLow')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.volRatioLow} onChange={(e) => updateConfigField('thresholds', 'volRatioLow', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.volRatioHigh')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.volRatioHigh} onChange={(e) => updateConfigField('thresholds', 'volRatioHigh', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.minLiquidityAmountRatio')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.minLiquidityAmountRatio} onChange={(e) => updateConfigField('thresholds', 'minLiquidityAmountRatio', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.minLiquidityVolumeRatio')}</div>
                    <Input
                      type="number"
                      step="0.01"
                      value={configDraft.thresholds.minLiquidityVolumeRatio ?? ''}
                      onChange={(e) => updateConfigField('thresholds', 'minLiquidityVolumeRatio', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.realtimeVolSurprise')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.realtimeVolSurprise} onChange={(e) => updateConfigField('thresholds', 'realtimeVolSurprise', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.realtimeAmtSurprise')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.realtimeAmtSurprise} onChange={(e) => updateConfigField('thresholds', 'realtimeAmtSurprise', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.newsPanicThreshold')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.newsPanicThreshold} onChange={(e) => updateConfigField('thresholds', 'newsPanicThreshold', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.newsTrendThreshold')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.newsTrendThreshold} onChange={(e) => updateConfigField('thresholds', 'newsTrendThreshold', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.hysteresisThreshold')}</div>
                    <Input type="number" step="0.01" value={configDraft.thresholds.hysteresisThreshold} onChange={(e) => updateConfigField('thresholds', 'hysteresisThreshold', Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <div>
                <div className="text-gray-400">{t('ashare.panel.positionCaps')}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.positionTrend')}</div>
                    <Input type="number" step="0.01" value={configDraft.positionCaps.trend} onChange={(e) => updateConfigField('positionCaps', 'trend', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.positionRange')}</div>
                    <Input type="number" step="0.01" value={configDraft.positionCaps.range} onChange={(e) => updateConfigField('positionCaps', 'range', Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">{t('ashare.panel.positionPanic')}</div>
                    <Input type="number" step="0.01" value={configDraft.positionCaps.panic} onChange={(e) => updateConfigField('positionCaps', 'panic', Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-300">{t('ashare.panel.autoTune')}</div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-[10px]" onClick={startAutoTune} disabled={autoTuneLoading}>
                      {autoTuneLoading ? t('common.loading') : t('ashare.panel.autoTuneStart')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={applyRecommended} disabled={!autoTuneResult?.bestParams}>
                      {t('ashare.panel.autoTuneApply')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={rollbackConfig} disabled={!autoTuneBackup}>
                      {t('ashare.panel.autoTuneRollback')}
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  {t('ashare.panel.autoTuneHint')}
                </div>
                {autoTuneError && <div className="mt-2 text-xs text-yellow-400">{autoTuneError}</div>}
                {autoTuneResult && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                    <div>{t('ashare.panel.autoTuneTrainDays')}</div>
                    <div className="text-gray-100">{autoTuneResult.trainDays}</div>
                    <div>{t('ashare.panel.autoTuneTrials')}</div>
                    <div className="text-gray-100">{autoTuneResult.trials}</div>
                    <div>{t('ashare.panel.autoTuneScore')}</div>
                    <div className="text-gray-100">{autoTuneResult.metrics?.score?.toFixed?.(4) ?? '--'}</div>
                    <div>{t('ashare.panel.autoTuneNetReturn')}</div>
                    <div className="text-gray-100">{autoTuneResult.metrics?.netReturn?.toFixed?.(4) ?? '--'}</div>
                    <div>{t('ashare.panel.autoTuneMaxDD')}</div>
                    <div className="text-gray-100">{autoTuneResult.metrics?.maxDD?.toFixed?.(4) ?? '--'}</div>
                    <div>{t('ashare.panel.autoTuneTrades')}</div>
                    <div className="text-gray-100">{autoTuneResult.metrics?.trades ?? '--'}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          {!configDraft && <div className="mt-3 text-xs text-gray-500">{t('common.loading')}</div>}
        </div>
      </div>

      {/* Footer cards */}
      <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* ... 保留原有的 MA, RSI 卡片 ... */}
        {/* === 新增：市场状态卡片 (插入在策略卡片之前) === */}
        <div className="rounded-xl bg-white/5 border border-white/5 p-4 relative overflow-hidden">
          <div className="relative z-10">
              <div className="text-xs text-gray-400 flex items-center gap-2">
               {t('ashare.panel.marketRegime')}
                {regimeInfo?.regime === 'TREND_UP' && (
                  <span className="text-red-400 border border-red-400/30 px-1 rounded text-[10px]">
                    {t('ashare.panel.regime.up')}
                  </span>
                )}
                {regimeInfo?.regime === 'TREND_DOWN' && (
                  <span className="text-green-400 border border-green-400/30 px-1 rounded text-[10px]">
                    {t('ashare.panel.regime.down')}
                  </span>
                )}
                {regimeInfo?.regime === 'RANGE' && (
                  <span className="text-blue-400 border border-blue-400/30 px-1 rounded text-[10px]">
                    {t('ashare.panel.regime.range')}
                  </span>
                )}
                {regimeInfo?.regime === 'HIGH_VOL' && (
                  <span className="text-yellow-400 border border-yellow-400/30 px-1 rounded text-[10px]">
                    {t('ashare.panel.regime.highVol')}
                  </span>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-100 font-medium truncate">
              {regimeInfo?.description || t('ashare.panel.regime.loading')}
              </div>
            <div className="mt-1 text-[10px] text-gray-500 font-mono">
              ADX:{regimeInfo?.adx.toFixed(0)} ATR%:{regimeInfo?.atrPct.toFixed(2)}
            </div>
          </div>
          <div className={cn("absolute -right-2 -bottom-4 text-6xl opacity-10 select-none",
            regimeInfo?.regime === 'TREND_UP' ? 'text-red-500' :
            regimeInfo?.regime === 'TREND_DOWN' ? 'text-green-500' : 'text-blue-500'
          )}>
            {regimeInfo?.regime === 'TREND_UP' ? '↗' : regimeInfo?.regime === 'TREND_DOWN' ? '↘' : '≈'}
          </div>
        </div>
        {/* === 新增结束 === */}
        {/* ... 保留原有的策略卡片 ... */}
        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <div className="text-xs text-gray-400">MA5 / MA10 / MA20</div>
          <div className="mt-2 text-sm text-gray-100">
            {fmt(derived.ma5)} / {fmt(derived.ma10)} / {fmt(derived.ma20)}
          </div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <div className="text-xs text-gray-400">RSI14</div>
          <div className="mt-2 text-sm text-gray-100">{fmt(derived.rsi14, 1)}</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <div className="text-xs text-gray-400">{t('ashare.panel.strategy')}</div>
          <div className="mt-2 text-sm text-gray-100">{strategyLabel(strategy)}</div>
          <div className="mt-1 text-xs text-gray-500">
            {strategyCalc.status ?? t('ashare.panel.statusHint')}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={autoStrategy ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'rounded-full text-[10px]',
                autoStrategy ? 'bg-yellow-500/15 text-yellow-200 hover:bg-yellow-500/25' : 'text-gray-300'
              )}
              onClick={() => setAutoStrategy((prev) => !prev)}
            >
               {t('ashare.panel.autoStrategy')} {autoStrategy ? t('ashare.panel.autoOn') : t('ashare.panel.autoOff')}
            </Button>
            {autoStrategy && recommendations[0] && (
                <span className="text-[10px] text-yellow-400/90">
                 {t('ashare.panel.recommended')}：{recommendations[0].label}
                </span>
            )}
          </div>
          {strategy !== 'none' && strategySummaryMap[strategy] && (
              <div className="mt-1 text-xs text-gray-500">
               {t('ashare.panel.winRate')} {strategySummaryMap[strategy].tradeCount > 0 && Number.isFinite(strategySummaryMap[strategy].winRate) ? `${fmt(strategySummaryMap[strategy].winRate, 2)}%` : '--'}
                <span className="mx-2 text-gray-600">·</span>
               {t('ashare.panel.tradeCount')} {strategySummaryMap[strategy].tradeCount}
            </div>
          )}
        </div>
      </div>

      {/* TradingView-like Dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="!w-[90vw] !max-w-[90vw] !h-[90vh] !max-h-[90vh] p-0 border border-white/10 bg-[#0d0d0d] text-white overflow-hidden flex flex-col" style={{ width: '90vw', height: '90vh', maxWidth: '90vw', maxHeight: '90vh' }}>
          <DialogHeader>
            <DialogTitle>
              {dlgTab === 'indicators'
                ? t('ashare.panel.indicators')
                : dlgTab === 'strategies'
                  ? t('ashare.panel.strategies')
                  : t('ashare.panel.backtest')}
            </DialogTitle>
          </DialogHeader>

          {/* Tab header */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn(
                'rounded-full bg-white/5 text-gray-200 hover:bg-white/10',
                dlgTab === 'indicators' && 'bg-white/15 text-white'
              )}
              onClick={() => setDlgTab('indicators')}
              >
                {t('ashare.panel.indicators')}
              </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn(
                'rounded-full bg-white/5 text-gray-200 hover:bg-white/10',
                dlgTab === 'strategies' && 'bg-white/15 text-white'
              )}
              onClick={() => setDlgTab('strategies')}
              >
                {t('ashare.panel.strategies')}
              </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn(
                'rounded-full bg-white/5 text-gray-200 hover:bg-white/10',
                dlgTab === 'backtest' && 'bg-white/15 text-white'
              )}
              onClick={() => setDlgTab('backtest')}
              >
                {t('ashare.panel.backtest')}
              </Button>

            <div className="flex-1" />

            <Input
              value={dlgQuery}
              onChange={(e) => setDlgQuery(e.target.value)}
              placeholder={
                dlgTab === 'indicators' ? t('ashare.searchIndicators') : t('ashare.searchStrategies')
              }
              className="h-9 w-56 rounded-xl bg-white/5 border-white/10 text-gray-100 text-sm"
            />
          </div>

          {/* Indicator categories */}
          {dlgTab === 'indicators' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(['all', 'trend', 'range', 'vol'] as const).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={cn(
                      'rounded-full bg-white/5 text-gray-200 hover:bg-white/10',
                      dlgCategory === c && 'bg-white/15 text-white'
                    )}
                    onClick={() => setDlgCategory(c)}
                  >
                    {c === 'all'
                      ? t('indicator.category.all')
                      : c === 'trend'
                        ? t('indicator.category.trend')
                        : c === 'range'
                          ? t('indicator.category.range')
                          : t('indicator.category.vol')}
                  </Button>
                ))}
                <div className="ml-auto text-[11px] text-gray-500">
                  {t('ashare.panel.enableHint')}
                </div>
            </div>
          )}

          {/* Body */}
          <div className="mt-4 px-5 pb-5 flex-1 min-h-0 overflow-hidden">
            {dlgTab === 'indicators' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-full overflow-auto pr-1">
                {sortedIndicatorItems.map((it) => {
                  const enabled = enabledIndicators.includes(it.key);
                  const fav = !!favorites[it.key];

                  return (
                    <div
                      key={it.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleIndicator(it.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') toggleIndicator(it.key);
                      }}
                      className={cn(
                        'cursor-pointer rounded-xl border px-3 py-2 transition',
                        enabled ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-white">{t(indicatorNameKey[it.key])}</div>
                          <div className="mt-1 text-[11px] text-gray-400">{t(indicatorDescKey[it.key])}</div>
                          <div className="mt-1 text-[10px] text-gray-500">
                            {it.location === 'overlay' ? t('ashare.panel.overlay') : t('ashare.panel.separatePanel')} · {categoryLabel(it.category)}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div
                            className={cn(
                              'text-[11px] px-2 py-0.5 rounded-full',
                              enabled ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-gray-300'
                            )}
                          >
                            {enabled ? t('common.enabled') : t('common.disabled')}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFavorites((prev) => ({ ...prev, [it.key]: !prev[it.key] }));
                            }}
                            className={cn('text-xs', fav ? 'text-yellow-300' : 'text-gray-500 hover:text-gray-200')}
                            aria-label="favorite"
                          >
                            {fav ? '★' : '☆'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {dlgTab === 'strategies' && (
              <div className="space-y-2 h-full flex flex-col min-h-0">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-400">{t('ashare.panel.sortBy')}</div>
                  <Button
                    type="button"
                    variant={strategySort === 'winRate' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setStrategySort('winRate')}
                    >
                      {t('ashare.panel.sort.winRate')}
                    </Button>
                  <Button
                    type="button"
                    variant={strategySort === 'tradeCount' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setStrategySort('tradeCount')}
                    >
                      {t('ashare.panel.sort.tradeCount')}
                    </Button>
                  <Button
                    type="button"
                    variant={strategySort === 'netProfitPct' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setStrategySort('netProfitPct')}
                    >
                      {t('ashare.panel.sort.netProfit')}
                    </Button>
                </div>

                <div className="space-y-2 overflow-auto pr-1 flex-1 min-h-0">
                  {/* === 智能推荐（置于列表顶部） === */}
                  {recommendations.length > 0 && (
                    <div className="mb-4 space-y-2">
                        <div className="text-xs text-yellow-400/80 font-medium px-1 flex items-center gap-1">
                         <span>✨</span> {t('ashare.panel.smartRecommend')}{regimeInfo?.regime ? ` (${regimeLabel(regimeInfo.regime)})` : ''}
                        </div>
                      <div className="grid grid-cols-1 gap-2">
                        {recommendations.slice(0, 3).map((rec, idx) => (
                          <div
                            key={rec.key}
                            className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-yellow-500/10 transition"
                            onClick={() => {
                              setStrategy(rec.key);
                              setDlgOpen(false);
                            }}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-yellow-500">Top{idx + 1} {rec.label}</span>
                                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                                   {t('ashare.panel.score')} {rec.score.toFixed(0)}
                                  </span>
                              </div>
                              <div className="text-[11px] text-gray-400 mt-0.5 truncate">{rec.reason}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-medium text-gray-200">PF {rec.pf.toFixed(2)}</div>
                              <div className="text-[10px] text-gray-500">{t('ashare.panel.netProfitShort')} {rec.netProfitPct.toFixed(1)}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* === 智能推荐结束 === */}
                  {sortedStrategyItems.map((it) => {
                    const s = strategySummaryMap[it.key];
                    const closedTrades = s?.tradeCount ?? 0;
                    const win = s?.winRate;
                    const winText = win != null && Number.isFinite(win) ? `${win.toFixed(1)}%` : '--';
                    const netPct = s?.netProfitPct;
                    const netText = netPct != null && Number.isFinite(netPct) ? `${netPct >= 0 ? '+' : ''}${netPct.toFixed(2)}%` : '--';
                    const selected = strategy === it.key;

                    return (
                      <div
                        key={it.key}
                        className={cn(
                          'rounded-xl border px-3 py-2 bg-white/5 border-white/10',
                          selected && 'border-white/25 bg-white/10'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-white">{strategyLabel(it.key)}</div>
                            <div className="mt-1 text-[11px] text-gray-400">{strategyNote(it.key)}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                              <div className="text-[11px] text-gray-300">
                                {t('ashare.panel.winRate')} {winText} · {t('ashare.panel.tradeCount')} {closedTrades} · {t('ashare.panel.netProfit')} {netText}
                              </div>

                            {it.key !== 'none' && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="rounded-full bg-white/5 text-gray-200 hover:bg-white/10"
                                onClick={() => {
                                  setRuleKey(it.key);
                                  setRuleOpen(true);
                                }}
                              >
                                {t('ashare.panel.rule')}
                              </Button>
                            )}

                            <Button
                              type="button"
                              size="sm"
                              className="rounded-full"
                              onClick={() => {
                                setStrategy(it.key);
                                setDlgOpen(false);
                              }}
                            >
                              {selected ? t('ashare.panel.selected') : t('ashare.panel.select')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-white/10">
                  <div className="text-xs text-gray-300 mb-2">{t('ashare.panel.parameters')}</div>
                  <StrategyParamsPanel strategy={strategy} stParams={stParams} setStParams={setStParams} />
                </div>
              </div>
            )}

            {dlgTab === 'backtest' && (
              <div className="flex gap-3 h-full min-h-0">
                {/* Left: strategy list */}
                <div className="w-64 shrink-0 rounded-xl border border-white/10 bg-white/5 overflow-hidden h-full flex flex-col min-h-0">
                  <div className="px-3 py-2 text-sm font-medium border-b border-white/10">{t('ashare.panel.strategyList')}</div>
                  <div className="overflow-auto flex-1 min-h-0">
                    {sortedStrategyItems.map((it) => {
                      const s = strategySummaryMap[it.key];
                      const win = s?.winRate;
                      const winText = win != null && Number.isFinite(win) ? `${win.toFixed(1)}%` : '--';
                      const trades = s?.tradeCount ?? 0;
                      const net = s?.netProfitPct;
                      const netText = net != null && Number.isFinite(net) ? `${net >= 0 ? '+' : ''}${net.toFixed(2)}%` : '--';
                      const selected = strategy === it.key;

                      return (
                        <button
                          key={it.key}
                          type="button"
                          className={[
                            'w-full text-left px-3 py-2 border-b border-white/5 hover:bg-white/5',
                            selected ? 'bg-white/10' : '',
                          ].join(' ')}
                          onClick={() => setStrategy(it.key)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-7 text-right text-xs text-gray-500 pt-0.5">
                              {it.key === 'none' ? '--' : strategyRankMap[it.key]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium truncate">{strategyLabel(it.key)}</div>
                                {selected && <div className="text-[11px] text-emerald-400">{t('common.current')}</div>}
                              </div>
                                <div className="text-[11px] text-gray-400 mt-0.5">
                                 {t('ashare.panel.winRate')} {winText} · {t('ashare.panel.tradeCount')} {trades} · {t('ashare.panel.netProfit')} {netText}
                                </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: backtest */}
                <div className="flex-1 space-y-3 overflow-auto pr-1 min-h-0">
                {/* === 插入：回测范围选择器 === */}
                    <div className="flex items-center gap-2 mb-3 bg-black/20 p-1 rounded-lg">
                      <div className="text-xs text-gray-500 px-2 shrink-0">{t('ashare.panel.range')}</div>
                      {(['full', 'recent_60', 'recent_120'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setBtWindowMode(m)}
                          className={cn(
                            "flex-1 text-xs py-1 rounded transition",
                            btWindowMode === m ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                          )}
                        >
                          {m === 'full'
                            ? t('ashare.panel.rangeAll')
                            : m === 'recent_60'
                              ? t('ashare.panel.rangeRecent60')
                              : t('ashare.panel.rangeRecent120')}
                        </button>
                      ))}
                    </div>
                    {/* === 插入结束 === */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex flex-col gap-1">
                      <div className="text-sm text-gray-400">{t('ashare.panel.currentStrategy')}</div>
                      <div className="text-lg font-semibold">
                        {strategyLabel(strategy)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('ashare.panel.backtestModel')}
                      </div>
                    </div>

                    <div className="mt-3">
                      <BacktestConfigPanel
                        config={{ ...btConfig, capital: btCapital }}
                        setConfig={setBtConfig}
                        onAutoPyramiding={autoPyramiding}
                        pyramidingCandidates={pyramidingCandidates}
                        pyramidingOptimizing={pyramidingOptimizing}
                        onApplyPyramidingCandidate={applyPyramidingCandidate}
                      />
                    </div>

                    {/* 策略参数 + 过滤器（可编辑） */}
                    <div className="mt-3">
                      <StrategyParamsPanel strategy={strategy} stParams={stParams} setStParams={setStParams} />
                    </div>

                    <div className="mt-3">
                      {strategy === 'none' ? (
                        <div className="text-sm text-gray-400 px-2 py-6">{t('ashare.panel.backtestEmpty')}</div>
                      ) : !backtest.ok ? (
                        <div className="text-sm text-gray-400 px-2 py-6">{backtest.error ?? t('ashare.panel.backtestFailed')}</div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-xs text-gray-500">
                            {t('ashare.panel.sample', {
                              start: backtest.startDate,
                              end: backtest.endDate,
                              bars: backtest.barCount,
                              trades: backtest.tradeCount,
                            })}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                              <div className="text-[11px] text-gray-400">{t('ashare.panel.netProfit')}</div>
                              <div className="text-base font-semibold">{fmt(backtest.netProfitPct, 2)}%</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                {t('ashare.panel.netProfitAmount', { value: fmt(backtest.netProfit, 0) })}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {t('ashare.panel.grossProfitLoss', {
                                  profit: fmt((backtest as any).grossProfit ?? 0, 0),
                                  loss: fmt((backtest as any).grossLoss ?? 0, 0),
                                })}
                              </div>
                            </div>

                            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                              <div className="text-[11px] text-gray-400">{t('ashare.panel.maxDrawdown')}</div>
                              <div className="text-base font-semibold">{fmt(backtest.maxDrawdownPct, 2)}%</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">{fmt(backtest.maxDrawdown, 0)}</div>
                            </div>

                            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                              <div className="text-[11px] text-gray-400">{t('ashare.panel.winRate')}</div>
                              <div className="text-base font-semibold">{fmt(backtest.winRate, 1)}%</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                {t('ashare.panel.tradeCount')} {backtest.tradeCount}
                              </div>
                            </div>

                            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                              <div className="text-[11px] text-gray-400">{t('ashare.panel.buyHold')}</div>
                              <div className="text-base font-semibold">{fmt(backtest.buyHoldPct, 2)}%</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                {t('ashare.panel.excessReturn', { value: fmt(backtest.netProfitPct - backtest.buyHoldPct, 2) })}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                            <div className="text-[11px] text-gray-400 mb-2">{t('ashare.panel.equityCurve')}</div>
                            {/* 注意：EquitySparkline组件需要定义或导入 */}
                            {equityPoints.length > 1 ? (
                              <EquitySparkline points={equityPoints} height={80} hoverHint={t('ashare.panel.hoverHint')} />
                            ) : (
                              <div className="h-20 rounded flex items-center justify-center bg-white/5 border border-white/10">
                                <div className="text-gray-500 text-sm">{t('ashare.panel.noEquityData')}</div>
                              </div>
                            )}
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                            <div className="text-[11px] text-gray-400 mb-2">{t('ashare.panel.tradeList')}</div>
                            <TradeTable trades={backtest.trades} lotSize={backtest.lotSize} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StrategyRulesDialog open={ruleOpen} onOpenChange={setRuleOpen} strategyKey={ruleKey} />
    </div>
  );
}




// =========================
// Equity curve sparkline (inline, no extra file)
// =========================
function EquitySparkline({
  points,
  height = 80,
  hoverHint = 'Hover to see value',
}: {
  points: Array<{ time: number; value: number }>;
  height?: number;
  hoverHint?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<any>(null);
  const seriesRef = React.useRef<any>(null);

  const [hover, setHover] = React.useState<null | { time: any; value: number }>(null);

  const data = React.useMemo(
    () =>
      (points ?? [])
        .filter((p) => p && Number.isFinite(p.time) && Number.isFinite(p.value))
        .map((p) => ({ time: p.time, value: p.value })),
    [points]
  );

  // (Re)create chart on mount / height change
  React.useEffect(() => {
    let disposed = false;

    async function init() {
      if (!containerRef.current) return;

      const { createChart, LineSeries } = await import('lightweight-charts');
      if (disposed) return;

      // dispose old
      try {
        chartRef.current?.remove?.();
      } catch {}
      chartRef.current = null;
      seriesRef.current = null;

      const chart = createChart(containerRef.current, {
        autoSize: true,
        height,
        handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
        handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: { time: false, price: false } },
        layout: { background: { color: 'transparent' }, textColor: 'rgba(255,255,255,0.65)' },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
        rightPriceScale: { visible: false },
        leftPriceScale: { visible: false },
        timeScale: { visible: false, borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      });

      const line = chart.addSeries(LineSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      // Hover tooltip
      try {
        chart.subscribeCrosshairMove((param: any) => {
          if (!param || !param.time) {
            setHover(null);
            return;
          }
          const d = param.seriesData?.get?.(line);
          const v = (d as any)?.value ?? (d as any)?.close;
          if (v == null || !Number.isFinite(v)) {
            setHover(null);
            return;
          }
          setHover({ time: param.time, value: Number(v) });
        });
      } catch {}

      chartRef.current = chart;
      seriesRef.current = line;

      try {
        line.setData(data);
        chart.timeScale().fitContent();
      } catch {}
    }

    void init();

    return () => {
      disposed = true;
      try {
        chartRef.current?.remove?.();
      } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  // Update data when points change
  React.useEffect(() => {
    try {
      if (!seriesRef.current) return;
      seriesRef.current.setData(data);
      chartRef.current?.timeScale?.()?.fitContent?.();
    } catch {}
  }, [data]);

  const formatTime = (t: any) => {
    if (!t) return '';
    // lightweight-charts time can be UTCTimestamp (number) or BusinessDay
    if (typeof t === 'number') {
      const d = new Date(t * 1000);
      if (!Number.isFinite(d.getTime())) return '';
      return d.toLocaleDateString();
    }
    const y = (t as any).year;
    const m = (t as any).month;
    const day = (t as any).day;
    if (y && m && day) return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return '';
  };

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Hover value overlay */}
      <div className="pointer-events-none absolute left-2 top-1 text-[11px] text-gray-300 bg-black/40 border border-white/10 rounded px-2 py-0.5">
        {hover ? (
          <span>
            {formatTime(hover.time)} · {fmt(hover.value, 0)}
          </span>
        ) : (
          <span className="text-gray-500">{hoverHint}</span>
        )}
      </div>
    </div>
  );
}

function buildEquityPoints(backtest: any, bars: any[], initialCapital: number): Array<{ time: number; value: number }> {
  // 1) Prefer explicit equity curve from backtest if present
  const tryArrays = ['equityCurve', 'equity', 'equitySeries', 'equityPoints', 'navCurve', 'balanceCurve'];
  for (const k of tryArrays) {
    const v = backtest?.[k];
    if (!v) continue;

    // a) array of objects
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
      const out: Array<{ time: number; value: number }> = [];
      for (const p of v) {
        const t = Number((p as any).time ?? (p as any).t ?? (p as any).timestamp);
        const val = Number((p as any).value ?? (p as any).equity ?? (p as any).nav ?? (p as any).balance);
        if (Number.isFinite(t) && Number.isFinite(val)) out.push({ time: t > 1e12 ? Math.floor(t / 1000) : Math.floor(t), value: val });
      }
      if (out.length > 1) return out;
    }

    // b) array of numbers aligned with bars
    if (Array.isArray(v) && v.length && typeof v[0] === 'number' && Array.isArray(bars) && bars.length) {
      const n = Math.min(v.length, bars.length);
      const out: Array<{ time: number; value: number }> = [];
      for (let i = 0; i < n; i++) {
        const t = Number((bars[i] as any)?.t);
        const val = Number(v[i]);
        if (Number.isFinite(t) && Number.isFinite(val)) out.push({ time: Math.floor(t), value: val });
      }
      if (out.length > 1) return out;
    }
  }

  // 2) Fallback: build step curve from closed trades (capital + cumulative PnL)
  const trades = Array.isArray(backtest?.trades) ? backtest.trades : [];
  let equity = Number.isFinite(initialCapital) ? initialCapital : 0;

  const points: Array<{ time: number; value: number }> = [];
  const t0 = Number((bars?.[0] as any)?.t);
  if (Number.isFinite(t0)) points.push({ time: Math.floor(t0), value: equity });

  for (const tr of trades) {
    if ((tr as any)?.open === true) continue;

    const pnl =
      Number((tr as any).pnl ?? (tr as any).profit ?? (tr as any).profitAmount ?? (tr as any).incomeAmount ?? (tr as any).收益金额 ?? 0) || 0;

    const t =
      Number(
        (tr as any).exitTime ??
          (tr as any).exit ??
          (tr as any).closeTime ??
          (tr as any).close ??
          (tr as any).endTime ??
          (tr as any).outTime ??
          (tr as any).出场时间
      ) || NaN;

    const tt = Number.isFinite(t) ? (t > 1e12 ? Math.floor(t / 1000) : Math.floor(t)) : NaN;
    if (!Number.isFinite(tt)) continue;

    equity += pnl;
    points.push({ time: tt, value: equity });
  }

  return points.length > 1 ? points : [];
}


// =========================
// Helpers
// =========================
function fmt(v: number | null | undefined, digits: number = 2): string {
  if (v == null || !Number.isFinite(v)) return '--';
  return Number(v).toFixed(digits);
}

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
