'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import ExternalNewsTicker from '@/components/ExternalNewsTicker';
import { cn } from '@/lib/utils';

import type { DecisionMeta, DecisionPayload, NewsFeedItem, RegimeConfig } from '../types';
import { translateReason as translateReasonText } from '../utils/translateReason';
import { fmtAge, fmtDateTime, fmtPct, fmtTs } from '../utils/format';

type TranslateFn = (key: string, params?: Record<string, any>) => string;
type RefreshInterval = '3s' | '5s' | '10s' | 'manual';

type Props = {
  t: TranslateFn;
  symbol: string;
  decision: DecisionPayload | null;
  decisionMeta: DecisionMeta | null;
  decisionLoading: boolean;
  decisionError: string | null;
  refreshDecision: () => void;
  refreshInterval: RefreshInterval;
  setRefreshInterval: (next: RefreshInterval) => void;
  newsDlgOpen: boolean;
  setNewsDlgOpen: (open: boolean) => void;
  newsItems: NewsFeedItem[];
  newsLoading: boolean;
  newsError: string | null;
  translateCount: number | null;
  configDraft: RegimeConfig | null;
  setConfigDraft: React.Dispatch<React.SetStateAction<RegimeConfig | null>>;
  configLoading: boolean;
  applyConfig: (override?: RegimeConfig) => void | Promise<void>;
  startAutoTune: () => void | Promise<void>;
  applyRecommended: () => void | Promise<void>;
  rollbackConfig: () => void | Promise<void>;
  autoTuneLoading: boolean;
  autoTuneError: string | null;
  autoTuneResult: any;
  autoTuneBackup: RegimeConfig | null;
};

export default function RegimeExternalPanel({
  t,
  symbol,
  decision,
  decisionMeta,
  decisionLoading,
  decisionError,
  refreshDecision,
  refreshInterval,
  setRefreshInterval,
  newsDlgOpen,
  setNewsDlgOpen,
  newsItems,
  newsLoading,
  newsError,
  translateCount,
  configDraft,
  setConfigDraft,
  configLoading,
  applyConfig,
  startAutoTune,
  applyRecommended,
  rollbackConfig,
  autoTuneLoading,
  autoTuneError,
  autoTuneResult,
  autoTuneBackup,
}: Props) {
  const [showAllReasons, setShowAllReasons] = useState(false);
  const [showParams, setShowParams] = useState(true);
  const [paramPanelHeight, setParamPanelHeight] = useState<number | null>(null);
  const paramPanelRef = useRef<HTMLDivElement | null>(null);

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
    [setConfigDraft]
  );

  const recomputeParamHeight = useCallback(() => {
    if (!showParams) {
      setParamPanelHeight(null);
      return;
    }
    const panel = paramPanelRef.current;
    if (!panel) return;
    setParamPanelHeight(panel.getBoundingClientRect().height);
  }, [showParams]);

  useLayoutEffect(() => {
    recomputeParamHeight();
    if (!showParams) return;
    const panel = paramPanelRef.current;
    if (!panel) return;
    const ro = new ResizeObserver(() => recomputeParamHeight());
    ro.observe(panel);
    window.addEventListener('resize', recomputeParamHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recomputeParamHeight);
    };
  }, [recomputeParamHeight, showParams]);

  const fmtNewsSource = (source?: DecisionMeta['news_source']) => {
    if (!source) return '--';
    if (source === 'items_rolling') return t('ashare.panel.newsSourceRolling');
    if (source === 'snapshot') return t('ashare.panel.newsSourceSnapshot');
    return t('ashare.panel.newsSourceNone');
  };

  const translateReason = useCallback((reason: string) => translateReasonText(t, reason), [t]);

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

  return (
    <div className="px-5 pb-3 grid grid-cols-1 lg:grid-cols-[0.8fr_1.4fr_1fr] gap-3 items-stretch">
      <div className="rounded-xl bg-white/5 border border-white/5 p-4 h-full">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">{t('ashare.panel.regimeDecision')}</div>
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
        <div className="mt-2 text-base text-gray-100">
          {decisionLoading ? t('common.loading') : decisionError ? `${t('common.error')}: ${decisionError}` : decision?.strategy ?? '--'}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-400">
          <div>{t('ashare.panel.action')}</div>
          <div className="text-gray-100">{decision?.action ?? '--'}</div>
          <div>{t('ashare.panel.regimeConfidence')}</div>
          <div className="text-gray-100">{decision ? fmtPct(decision.regime_confidence) : '--'}</div>
          <div>{t('ashare.panel.positionCap')}</div>
          <div className="text-gray-100">{decision ? fmtPct(decision.position_cap) : '--'}</div>
          <div>{t('ashare.panel.serverTime')}</div>
          <div className="text-gray-100">{decision ? fmtTs(decision.serverTime) : '--'}</div>
          <div>{t('ashare.panel.cacheHit')}</div>
          <div className="text-gray-100">{decisionMeta ? (decisionMeta.cacheHit ? t('common.yes') : t('common.no')) : '--'}</div>
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
        <div className="mt-3 text-sm text-gray-400">{t('ashare.panel.reasons')}</div>
        <div className="mt-1 space-y-1 text-sm text-gray-300">
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
            className="mt-2 h-7 px-2 text-xs text-gray-300"
            onClick={() => setShowAllReasons((v) => !v)}
          >
            {showAllReasons ? t('common.collapse') : t('common.expandMore')}
          </Button>
        )}
      </div>

      <div
        className="rounded-xl bg-white/5 border border-white/5 p-4 h-full grid grid-rows-[auto_auto_auto_1fr] gap-2 overflow-hidden"
        style={showParams && paramPanelHeight ? { height: paramPanelHeight } : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">{t('ashare.panel.externalSignals')}</div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setNewsDlgOpen(true)}
          >
            新闻
          </Button>
        </div>
        <div className="text-sm text-gray-300">
          {decision?.external_signals?.news ? (
            <div>
                {t('ashare.panel.newsSentiment')}: {decision.external_signals.news.score.toFixed(2)} / {t('ashare.panel.confidence')}{' '}
              {decision.external_signals.news.confidence.toFixed(2)} · {fmtTs(decision.external_signals.news.ts)}
            </div>
          ) : (
            <div>{t('ashare.panel.newsFallback')}</div>
          )}
        </div>
        <div className="text-sm text-gray-300">
          {decision?.external_signals?.realtime ? (
            <div>
                {t('ashare.panel.realtimeSurprise')}: {t('ashare.panel.vol')} {decision.external_signals.realtime.volSurprise.toFixed(2)} · {t('ashare.panel.amt')}{' '}
              {decision.external_signals.realtime.amtSurprise.toFixed(2)} · {fmtTs(decision.external_signals.realtime.ts)}
            </div>
          ) : (
            <div>{t('ashare.panel.realtimeFallback')}</div>
          )}
        </div>
        <div className="min-h-0">
          <ExternalNewsTicker symbol={symbol} fill={showParams} listClassName={!showParams ? 'max-h-56' : undefined} />
        </div>
      </div>

      <Dialog open={newsDlgOpen} onOpenChange={setNewsDlgOpen}>
        <DialogContent className="!w-[80vw] !max-w-[80vw] !h-[80vh] !max-h-[80vh] p-0 border border-white/10 bg-[#0d0d0d] text-white overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>新闻</DialogTitle>
          </DialogHeader>
          <div className="px-5 pt-2 flex items-center justify-between text-xs text-gray-400">
            <div>翻译次数: {translateCount == null ? '--' : translateCount}</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] text-gray-300"
              onClick={() => setNewsDlgOpen(false)}
            >
              关闭
            </Button>
          </div>
          <div className="mt-3 px-5 pb-5 flex-1 min-h-0 overflow-auto">
            {newsLoading && <div className="text-sm text-gray-400">加载中..</div>}
            {!newsLoading && newsError && <div className="text-sm text-yellow-400">{newsError}</div>}
            {!newsLoading && !newsError && newsItems.length === 0 && <div className="text-sm text-gray-400">暂无新闻</div>}
            {!newsLoading && !newsError && newsItems.length > 0 && (
              <div className="space-y-3">
                {newsItems.map((it) => {
                  const showTitle = it.title_en ?? it.title;
                  return (
                    <div key={`${it.publishedAt}-${it.title}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="text-sm text-gray-100">
                        {it.url ? (
                          <a href={it.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {showTitle}
                          </a>
                        ) : (
                          <span>{showTitle}</span>
                        )}
                      </div>
                      <div className="mt-2 text-[11px] text-gray-400 flex flex-wrap items-center gap-2">
                        <span>来源: {it.source || '--'}</span>
                        <span>时间: {fmtDateTime(it.publishedAt)}</span>
                        {it.url && (
                          <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:underline">
                            访问链接
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl bg-white/5 border border-white/5 p-4 h-full" ref={paramPanelRef}>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">{t('ashare.panel.configPanel')}</div>
          <div className="flex items-center gap-2">
            {refreshInterval === 'manual' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-gray-300"
                onClick={refreshDecision}
              >
                {t('common.refresh')}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-gray-300"
              onClick={() => setShowParams((v) => !v)}
            >
              {showParams ? t('common.collapse') : t('common.expand')}
            </Button>
            <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-xs" onClick={() => applyConfig()} disabled={configLoading}>
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
              className={cn('h-7 px-2 text-xs', refreshInterval === opt ? 'bg-white/10 text-white' : 'text-gray-300')}
              onClick={() => setRefreshInterval(opt)}
            >
              {opt === 'manual' ? t('ashare.panel.refreshManual') : t('ashare.panel.refreshEvery', { sec: opt.replace('s', '') })}
            </Button>
          ))}
        </div>
        {showParams && configDraft && (
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <div className="text-gray-400">{t('ashare.panel.weights')}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.weightTrend')}</div>
                  <Input type="number" step="0.01" value={configDraft.weights.w_trend} onChange={(e) => updateConfigField('weights', 'w_trend', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.weightRange')}</div>
                  <Input type="number" step="0.01" value={configDraft.weights.w_range} onChange={(e) => updateConfigField('weights', 'w_range', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.weightPanic')}</div>
                  <Input type="number" step="0.01" value={configDraft.weights.w_panic} onChange={(e) => updateConfigField('weights', 'w_panic', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.weightNews')}</div>
                  <Input type="number" step="0.01" value={configDraft.weights.w_news} onChange={(e) => updateConfigField('weights', 'w_news', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.weightRealtime')}</div>
                  <Input type="number" step="0.01" value={configDraft.weights.w_realtime} onChange={(e) => updateConfigField('weights', 'w_realtime', Number(e.target.value))} />
                </div>
              </div>
            </div>
            <div>
              <div className="text-gray-400">{t('ashare.panel.thresholds')}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.trendScoreThreshold')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.trendScoreThreshold} onChange={(e) => updateConfigField('thresholds', 'trendScoreThreshold', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.panicVolRatio')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.panicVolRatio} onChange={(e) => updateConfigField('thresholds', 'panicVolRatio', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.panicDrawdown')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.panicDrawdown} onChange={(e) => updateConfigField('thresholds', 'panicDrawdown', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.volRatioLow')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.volRatioLow} onChange={(e) => updateConfigField('thresholds', 'volRatioLow', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.volRatioHigh')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.volRatioHigh} onChange={(e) => updateConfigField('thresholds', 'volRatioHigh', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.minLiquidityAmountRatio')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.minLiquidityAmountRatio} onChange={(e) => updateConfigField('thresholds', 'minLiquidityAmountRatio', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.minLiquidityVolumeRatio')}</div>
                  <Input
                    type="number"
                    step="0.01"
                    value={configDraft.thresholds.minLiquidityVolumeRatio ?? ''}
                    onChange={(e) => updateConfigField('thresholds', 'minLiquidityVolumeRatio', Number(e.target.value))}
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.realtimeVolSurprise')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.realtimeVolSurprise} onChange={(e) => updateConfigField('thresholds', 'realtimeVolSurprise', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.realtimeAmtSurprise')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.realtimeAmtSurprise} onChange={(e) => updateConfigField('thresholds', 'realtimeAmtSurprise', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.newsPanicThreshold')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.newsPanicThreshold} onChange={(e) => updateConfigField('thresholds', 'newsPanicThreshold', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.newsTrendThreshold')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.newsTrendThreshold} onChange={(e) => updateConfigField('thresholds', 'newsTrendThreshold', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.hysteresisThreshold')}</div>
                  <Input type="number" step="0.01" value={configDraft.thresholds.hysteresisThreshold} onChange={(e) => updateConfigField('thresholds', 'hysteresisThreshold', Number(e.target.value))} />
                </div>
              </div>
            </div>
            <div>
              <div className="text-gray-400">{t('ashare.panel.positionCaps')}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.positionTrend')}</div>
                  <Input type="number" step="0.01" value={configDraft.positionCaps.trend} onChange={(e) => updateConfigField('positionCaps', 'trend', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.positionRange')}</div>
                  <Input type="number" step="0.01" value={configDraft.positionCaps.range} onChange={(e) => updateConfigField('positionCaps', 'range', Number(e.target.value))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">{t('ashare.panel.positionPanic')}</div>
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
              <div className="mt-2 text-[11px] text-gray-500">{t('ashare.panel.autoTuneHint')}</div>
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
        {!showParams && configDraft && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-300">
            <div className="text-gray-400">{t('ashare.panel.weightTrend')}</div>
            <div className="text-gray-100">{configDraft.weights.w_trend.toFixed(2)}</div>
            <div className="text-gray-400">{t('ashare.panel.weightRange')}</div>
            <div className="text-gray-100">{configDraft.weights.w_range.toFixed(2)}</div>
            <div className="text-gray-400">{t('ashare.panel.weightPanic')}</div>
            <div className="text-gray-100">{configDraft.weights.w_panic.toFixed(2)}</div>
            <div className="text-gray-400">{t('ashare.panel.weightNews')}</div>
            <div className="text-gray-100">{configDraft.weights.w_news.toFixed(2)}</div>
            <div className="text-gray-400">{t('ashare.panel.weightRealtime')}</div>
            <div className="text-gray-100">{configDraft.weights.w_realtime.toFixed(2)}</div>
            <div className="text-gray-400">{t('ashare.panel.newsPanicThreshold')}</div>
            <div className="text-gray-100">{configDraft.thresholds.newsPanicThreshold.toFixed(2)}</div>
            <div className="text-gray-400">{t('ashare.panel.newsTrendThreshold')}</div>
            <div className="text-gray-100">{configDraft.thresholds.newsTrendThreshold.toFixed(2)}</div>
            <div className="text-gray-400">{t('ashare.panel.realtimeVolSurprise')}</div>
            <div className="text-gray-100">{configDraft.thresholds.realtimeVolSurprise.toFixed(2)}</div>
            <div className="text-gray-400">{t('ashare.panel.realtimeAmtSurprise')}</div>
            <div className="text-gray-100">{configDraft.thresholds.realtimeAmtSurprise.toFixed(2)}</div>
          </div>
        )}
        {!configDraft && <div className="mt-3 text-xs text-gray-500">{t('common.loading')}</div>}
      </div>
    </div>
  );
}
