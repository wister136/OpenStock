'use client';

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type {
  BacktestConfig,
  BacktestResult,
  IndicatorKey,
  MarketRegimeInfo,
  StrategyKey,
  StrategyParams,
  StrategyRecommendation,
} from '../types';
import type { PyramidingCandidate } from './BacktestConfigPanel';
import BacktestConfigPanel from './BacktestConfigPanel';
import StrategyParamsPanel from './StrategyParamsPanel';
import TradeTable from './TradeTable';
import StrategyRulesDialog from './StrategyRulesDialog';
import EquitySparkline from '../charts/EquitySparkline';
import { fmt } from '../utils/format';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

type IndicatorOption = {
  key: IndicatorKey;
  name: string;
  category: string;
  location: 'overlay' | 'pane';
  desc: string;
};

type StrategyOption = {
  key: StrategyKey;
  label: string;
  note?: string;
};

type Props = {
  t: TranslateFn;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dlgTab: 'indicators' | 'strategies' | 'backtest';
  setDlgTab: (tab: 'indicators' | 'strategies' | 'backtest') => void;
  dlgCategory: 'all' | 'trend' | 'range' | 'vol';
  setDlgCategory: (cat: 'all' | 'trend' | 'range' | 'vol') => void;
  dlgQuery: string;
  setDlgQuery: (value: string) => void;
  strategySort: 'winRate' | 'tradeCount' | 'netProfitPct';
  setStrategySort: (value: 'winRate' | 'tradeCount' | 'netProfitPct') => void;
  sortedIndicatorItems: IndicatorOption[];
  enabledIndicators: IndicatorKey[];
  favorites: Record<string, boolean>;
  setFavorites: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toggleIndicator: (key: IndicatorKey) => void;
  indicatorNameKey: Record<IndicatorKey, string>;
  indicatorDescKey: Record<IndicatorKey, string>;
  categoryLabel: (category: string) => string;
  sortedStrategyItems: StrategyOption[];
  strategy: StrategyKey;
  setStrategy: (key: StrategyKey) => void;
  strategyLabel: (key: StrategyKey) => string;
  strategyNote: (key: StrategyKey) => string;
  strategySummaryMap: Record<string, { winRate: number; tradeCount: number; netProfitPct: number; netProfit: number }>;
  strategyRankMap: Record<string, number>;
  recommendations: StrategyRecommendation[];
  regimeInfo: MarketRegimeInfo | null;
  regimeLabel: (regime?: MarketRegimeInfo['regime']) => string;
  stParams: StrategyParams;
  setStParams: React.Dispatch<React.SetStateAction<StrategyParams>>;
  btWindowMode: 'full' | 'recent_60' | 'recent_120';
  setBtWindowMode: (mode: 'full' | 'recent_60' | 'recent_120') => void;
  btConfig: BacktestConfig;
  setBtConfig: React.Dispatch<React.SetStateAction<BacktestConfig>>;
  btCapital: number;
  autoPyramiding: () => void;
  pyramidingCandidates: PyramidingCandidate[];
  pyramidingOptimizing: boolean;
  applyPyramidingCandidate: (c: PyramidingCandidate) => void;
  backtest: BacktestResult;
  equityPoints: Array<{ time: number; value: number }>;
};

export default function TradingViewDialog({
  t,
  open,
  onOpenChange,
  dlgTab,
  setDlgTab,
  dlgCategory,
  setDlgCategory,
  dlgQuery,
  setDlgQuery,
  strategySort,
  setStrategySort,
  sortedIndicatorItems,
  enabledIndicators,
  favorites,
  setFavorites,
  toggleIndicator,
  indicatorNameKey,
  indicatorDescKey,
  categoryLabel,
  sortedStrategyItems,
  strategy,
  setStrategy,
  strategyLabel,
  strategyNote,
  strategySummaryMap,
  strategyRankMap,
  recommendations,
  regimeInfo,
  regimeLabel,
  stParams,
  setStParams,
  btWindowMode,
  setBtWindowMode,
  btConfig,
  setBtConfig,
  btCapital,
  autoPyramiding,
  pyramidingCandidates,
  pyramidingOptimizing,
  applyPyramidingCandidate,
  backtest,
  equityPoints,
}: Props) {
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleKey, setRuleKey] = useState<StrategyKey>('none');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="!w-[90vw] !max-w-[90vw] !h-[90vh] !max-h-[90vh] p-0 border border-white/10 bg-[#0d0d0d] text-white overflow-hidden flex flex-col"
          style={{ width: '90vw', height: '90vh', maxWidth: '90vw', maxHeight: '90vh' }}
        >
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
              className={cn('rounded-full bg-white/5 text-gray-200 hover:bg-white/10', dlgTab === 'indicators' && 'bg-white/15 text-white')}
              onClick={() => setDlgTab('indicators')}
            >
              {t('ashare.panel.indicators')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn('rounded-full bg-white/5 text-gray-200 hover:bg-white/10', dlgTab === 'strategies' && 'bg-white/15 text-white')}
              onClick={() => setDlgTab('strategies')}
            >
              {t('ashare.panel.strategies')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn('rounded-full bg-white/5 text-gray-200 hover:bg-white/10', dlgTab === 'backtest' && 'bg-white/15 text-white')}
              onClick={() => setDlgTab('backtest')}
            >
              {t('ashare.panel.backtest')}
            </Button>

            <div className="flex-1" />

            <Input
              value={dlgQuery}
              onChange={(e) => setDlgQuery(e.target.value)}
              placeholder={dlgTab === 'indicators' ? t('ashare.searchIndicators') : t('ashare.searchStrategies')}
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
                  className={cn('rounded-full bg-white/5 text-gray-200 hover:bg-white/10', dlgCategory === c && 'bg-white/15 text-white')}
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
              <div className="ml-auto text-[11px] text-gray-500">{t('ashare.panel.enableHint')}</div>
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
                            {fav ? '¡ï' : '¡î'}
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
                  {/* === æ™ºèƒ½æŽ¨èï¼ˆç½®äºŽåˆ—è¡¨é¡¶éƒ¨ï¼‰ === */}
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
                              onOpenChange(false);
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
                  {/* === æ™ºèƒ½æŽ¨èç»“æŸ === */}
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
                        className={cn('rounded-xl border px-3 py-2 bg-white/5 border-white/10', selected && 'border-white/25 bg-white/10')}
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
                                onOpenChange(false);
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
                          className={['w-full text-left px-3 py-2 border-b border-white/5 hover:bg-white/5', selected ? 'bg-white/10' : ''].join(' ')}
                          onClick={() => setStrategy(it.key)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-7 text-right text-xs text-gray-500 pt-0.5">{it.key === 'none' ? '--' : strategyRankMap[it.key]}</div>
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
                  {/* === æ’å…¥ï¼šå›žæµ‹èŒƒå›´é€‰æ‹©å™?=== */}
                  <div className="flex items-center gap-2 mb-3 bg-black/20 p-1 rounded-lg">
                    <div className="text-xs text-gray-500 px-2 shrink-0">{t('ashare.panel.range')}</div>
                    {(['full', 'recent_60', 'recent_120'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setBtWindowMode(m)}
                        className={cn(
                          'flex-1 text-xs py-1 rounded transition',
                          btWindowMode === m ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
                        )}
                      >
                        {m === 'full' ? t('ashare.panel.rangeAll') : m === 'recent_60' ? t('ashare.panel.rangeRecent60') : t('ashare.panel.rangeRecent120')}
                      </button>
                    ))}
                  </div>
                  {/* === æ’å…¥ç»“æŸ === */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex flex-col gap-1">
                      <div className="text-sm text-gray-400">{t('ashare.panel.currentStrategy')}</div>
                      <div className="text-lg font-semibold">{strategyLabel(strategy)}</div>
                      <div className="text-xs text-gray-500">{t('ashare.panel.backtestModel')}</div>
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

                    {/* ç­–ç•¥å‚æ•° + è¿‡æ»¤å™¨ï¼ˆå¯ç¼–è¾‘ï¼‰ */}
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
                                {t('ashare.panel.excessReturn', { value: fmt(backtest.netProfitPct - (backtest.buyHoldPct ?? 0), 2) })}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                            <div className="text-[11px] text-gray-400 mb-2">{t('ashare.panel.equityCurve')}</div>
                            {/* æ³¨æ„ï¼šEquitySparklineç»„ä»¶éœ€è¦å®šä¹‰æˆ–å¯¼å…¥ */}
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
    </>
  );
}
