'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { MarketRegimeInfo, StrategyKey, StrategyRecommendation } from '../types';
import { fmt } from '../utils/format';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

type StrategySummary = {
  winRate: number;
  tradeCount: number;
  netProfitPct: number;
  netProfit: number;
};

type Props = {
  t: TranslateFn;
  regimeInfo: MarketRegimeInfo | null;
  derived: {
    ma5: number | null;
    ma10: number | null;
    ma20: number | null;
    rsi14: number | null;
  };
  strategy: StrategyKey;
  strategyLabel: (key: StrategyKey) => string;
  strategyStatus?: string | null;
  autoStrategy: boolean;
  onToggleAutoStrategy: () => void;
  recommendations: StrategyRecommendation[];
  strategySummaryMap: Record<string, StrategySummary>;
};

export default function FooterCards({
  t,
  regimeInfo,
  derived,
  strategy,
  strategyLabel,
  strategyStatus,
  autoStrategy,
  onToggleAutoStrategy,
  recommendations,
  strategySummaryMap,
}: Props) {
  return (
    <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* ... 淇濈暀鍘熸湁鐨?MA, RSI 鍗＄墖 ... */}
      {/* === 鏂板锛氬競鍦虹姸鎬佸崱鐗?(鎻掑叆鍦ㄧ瓥鐣ュ崱鐗囦箣鍓? === */}
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
          <div className="mt-2 text-sm text-gray-100 font-medium truncate">{regimeInfo?.description || t('ashare.panel.regime.loading')}</div>
          <div className="mt-1 text-[10px] text-gray-500 font-mono">
            ADX:{regimeInfo?.adx.toFixed(0)} ATR%:{regimeInfo?.atrPct.toFixed(2)}
          </div>
        </div>
        <div
          className={cn(
            'absolute -right-2 -bottom-4 text-6xl opacity-10 select-none',
            regimeInfo?.regime === 'TREND_UP' ? 'text-red-500' : regimeInfo?.regime === 'TREND_DOWN' ? 'text-green-500' : 'text-blue-500'
          )}
        >
            {regimeInfo?.regime === 'TREND_UP' ? '↗' : regimeInfo?.regime === 'TREND_DOWN' ? '↘' : '≈'}
        </div>
      </div>
      {/* === 鏂板缁撴潫 === */}
      {/* ... 淇濈暀鍘熸湁鐨勭瓥鐣ュ崱鐗?... */}
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
        <div className="mt-1 text-xs text-gray-500">{strategyStatus ?? t('ashare.panel.statusHint')}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={autoStrategy ? 'secondary' : 'ghost'}
            size="sm"
            className={cn('rounded-full text-[10px]', autoStrategy ? 'bg-yellow-500/15 text-yellow-200 hover:bg-yellow-500/25' : 'text-gray-300')}
            onClick={onToggleAutoStrategy}
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
            {t('ashare.panel.winRate')}{' '}
            {strategySummaryMap[strategy].tradeCount > 0 && Number.isFinite(strategySummaryMap[strategy].winRate)
              ? `${fmt(strategySummaryMap[strategy].winRate, 2)}%`
              : '--'}
                <span className="mx-2 text-gray-600">·</span>
            {t('ashare.panel.tradeCount')} {strategySummaryMap[strategy].tradeCount}
          </div>
        )}
      </div>
    </div>
  );
}
