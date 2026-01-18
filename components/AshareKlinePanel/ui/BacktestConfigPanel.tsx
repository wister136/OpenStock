'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { DEFAULT_BACKTEST_CONFIG, type BacktestConfig } from '../types';

export type PyramidingCandidate = {
  orderLots: number;
  maxEntries: number;
  profitFactor: number | null;
  netProfitPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  score: number;
};

type Props = {
  /** Backtest config (controlled) */
  config: BacktestConfig;
  /** Setter that supports value or updater fn (same style as React.setState) */
  setConfig: (next: BacktestConfig | ((prev: BacktestConfig) => BacktestConfig)) => void;

  /** Optional: for hint text; defaults to 100 */
  lotSize?: number;

  /** Auto optimize pyramiding (orderLots / maxEntries) */
  onAutoPyramiding?: () => void;
  pyramidingCandidates?: PyramidingCandidate[];
  pyramidingOptimizing?: boolean;
  onApplyPyramidingCandidate?: (c: PyramidingCandidate) => void;
};

function clampNumber(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function sanitizeIntText(raw: string) {
  // allow empty while editing
  const s = raw.replace(/[^0-9]/g, '');
  return s;
}

export default function BacktestConfigPanel({
  config,
  setConfig,
  lotSize = 100,
  onAutoPyramiding,
  pyramidingCandidates,
  pyramidingOptimizing,
  onApplyPyramidingCandidate,
}: Props) {
  const { t } = useI18n();
  // --- local editable text states ---
  const capEditing = useRef(false);
  const feeEditing = useRef(false);
  const slipEditing = useRef(false);
  const lotsEditing = useRef(false);
  const entEditing = useRef(false);
  const ddEditing = useRef(false);

  const [capitalText, setCapitalText] = useState<string>(() => (config.capital != null ? String(config.capital) : ''));
  const [feeBpsText, setFeeBpsText] = useState<string>(() => String(config.feeBps ?? 0));
  const [slippageBpsText, setSlippageBpsText] = useState<string>(() => String(config.slippageBps ?? 0));
  const [orderLotsText, setOrderLotsText] = useState<string>(() => String(config.orderLots ?? 1));
  const [maxEntriesText, setMaxEntriesText] = useState<string>(() => String(config.maxEntries ?? 1));
  const [ddLimitText, setDdLimitText] = useState<string>(() => String(config.risk?.hardMaxDdPct ?? 5));

  // sync down only when not editing
  useEffect(() => {
    if (!capEditing.current) setCapitalText(config.capital != null ? String(config.capital) : '');
  }, [config.capital]);
  useEffect(() => {
    if (!feeEditing.current) setFeeBpsText(String(config.feeBps ?? 0));
  }, [config.feeBps]);
  useEffect(() => {
    if (!slipEditing.current) setSlippageBpsText(String(config.slippageBps ?? 0));
  }, [config.slippageBps]);
  useEffect(() => {
    if (!lotsEditing.current) setOrderLotsText(String(config.orderLots ?? 1));
  }, [config.orderLots]);
  useEffect(() => {
    if (!entEditing.current) setMaxEntriesText(String(config.maxEntries ?? 1));
  }, [config.maxEntries]);
  useEffect(() => {
    if (!ddEditing.current) setDdLimitText(String(config.risk?.hardMaxDdPct ?? 5));
  }, [config.risk?.hardMaxDdPct]);

  const allowPyramiding = Boolean(config.allowPyramiding);
  const allowSameDirRepeat = Boolean(config.allowSameDirectionRepeat);
  const entryMode = (config.entryMode ?? 'FIXED') as 'FIXED' | 'ALL_IN';
  const allInMode = entryMode === 'ALL_IN';

  const commitCapital = () => {
    const v = Math.floor(Number(capitalText));
    const committed = Number.isFinite(v) && v > 0 ? v : 100000;
    setCapitalText(String(committed));
    setConfig((prev) => ({ ...prev, capital: committed }));
  };

  const commitFeeBps = () => {
    const v = Math.floor(Number(feeBpsText));
    const committed = clampNumber(Number.isFinite(v) ? v : 0, 0, 500);
    setFeeBpsText(String(committed));
    setConfig((prev) => ({ ...prev, feeBps: committed }));
  };

  const commitSlippageBps = () => {
    const v = Math.floor(Number(slippageBpsText));
    const committed = clampNumber(Number.isFinite(v) ? v : 0, 0, 500);
    setSlippageBpsText(String(committed));
    setConfig((prev) => ({ ...prev, slippageBps: committed }));
  };

  const commitOrderLots = () => {
    const v = Math.floor(Number(orderLotsText));
    const committed = clampNumber(Number.isFinite(v) ? v : 1, 1, 100);
    setOrderLotsText(String(committed));
    setConfig((prev) => ({ ...prev, orderLots: committed }));
  };

  const commitMaxEntries = () => {
    const v = Math.floor(Number(maxEntriesText));
    const committed = clampNumber(Number.isFinite(v) ? v : 1, 1, 50);
    setMaxEntriesText(String(committed));
    setConfig((prev) => ({ ...prev, maxEntries: committed }));
  };

  const commitDdLimit = () => {
    const v = Number(ddLimitText);
    const committed = Number.isFinite(v) && v > 0 ? clampNumber(v, 0.5, 50) : 5;
    setDdLimitText(String(committed));

    // Keep circuit breaker slightly below hard limit so it can pause before hard stop triggers.
    const circuit = committed > 0 ? Math.max(0, Math.min(committed * 0.84, committed - 0.3)) : 0;

    setConfig((prev) => {
      const baseRisk = prev.risk ?? DEFAULT_BACKTEST_CONFIG.risk;
      return {
        ...prev,
        risk: {
          ...(baseRisk ?? {}),
          hardMaxDdPct: committed,
          maxDdCircuitPct: circuit,
        } as any,
      };
    });
  };


  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-gray-400">{t('backtest.initialCapital')}</div>
        <Input
          value={capitalText}
          onFocus={() => (capEditing.current = true)}
          onChange={(e) => setCapitalText(sanitizeIntText(e.target.value))}
          onBlur={() => {
            capEditing.current = false;
            commitCapital();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement)?.blur();
            }
          }}
          className="h-8 w-28 rounded-lg bg-white/5 border-white/10 text-gray-100 text-xs"
        />

        <div className="ml-2 text-xs text-gray-400">{t('backtest.feeBps')}</div>
        <Input
          value={feeBpsText}
          onFocus={() => (feeEditing.current = true)}
          onChange={(e) => setFeeBpsText(sanitizeIntText(e.target.value))}
          onBlur={() => {
            feeEditing.current = false;
            commitFeeBps();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement)?.blur();
          }}
          className="h-8 w-20 rounded-lg bg-white/5 border-white/10 text-gray-100 text-xs"
        />

        {/* Entry mode */}
        <label className="ml-2 flex items-center gap-2 text-xs text-gray-300 select-none" title={t('backtest.allInHint')}>
          <input
            type="checkbox"
            checked={allInMode}
            onChange={(e) => setConfig((prev) => ({ ...prev, entryMode: e.target.checked ? 'ALL_IN' : 'FIXED' }))}
          />
          {t('backtest.allIn')}
        </label>

        <div className="ml-2 text-xs text-gray-400">{t('backtest.slippageBps')}</div>
        <Input
          value={slippageBpsText}
          onFocus={() => (slipEditing.current = true)}
          onChange={(e) => setSlippageBpsText(sanitizeIntText(e.target.value))}
          onBlur={() => {
            slipEditing.current = false;
            commitSlippageBps();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement)?.blur();
          }}
          className="h-8 w-20 rounded-lg bg-white/5 border-white/10 text-gray-100 text-xs"
        />

        <div className="ml-2 text-xs text-gray-400">{t('backtest.tradeDate')}</div>
        <Input
          type="date"
          value={config.dateFrom ?? ''}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              dateFrom: e.target.value ? e.target.value : undefined,
            }))
          }
          className="h-8 w-[150px] rounded-lg bg-white/5 border-white/10 text-gray-100 text-xs"
          title={t('backtest.dateFromTitle')}
        />
        <div className="text-xs text-gray-500">~</div>
        <Input
          type="date"
          value={config.dateTo ?? ''}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              dateTo: e.target.value ? e.target.value : undefined,
            }))
          }
          className="h-8 w-[150px] rounded-lg bg-white/5 border-white/10 text-gray-100 text-xs"
          title={t('backtest.dateToTitle')}
        />

        <button
          type="button"
          onClick={() => setConfig((prev) => ({ ...prev, dateFrom: undefined, dateTo: undefined }))}
          className="h-8 px-2 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-gray-100"
          title={t('backtest.clearDateRangeTitle')}
        >
          {t('common.clear')}
        </button>



        <div className="ml-2 text-xs text-gray-400">{t('backtest.maxDrawdown')}</div>
        <Input
          value={ddLimitText}
          onFocus={() => (ddEditing.current = true)}
          onChange={(e) => setDdLimitText(e.target.value.replace(/[^0-9.]/g, ''))}
          onBlur={() => {
            ddEditing.current = false;
            commitDdLimit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement)?.blur();
          }}
          className="h-8 w-20 rounded-lg bg-white/5 border-white/10 text-gray-100 text-xs"
          title={t('backtest.maxDrawdownTitle')}
        />

        {/* Confirm button: apply DD limit without needing to blur the input */}
        <button
          type="button"
          onClick={commitDdLimit}
          className="h-8 px-2 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-gray-100"
          title={t('common.confirm')}
        >
          {t('common.confirm')}
        </button>
        <label className="ml-2 flex items-center gap-2 text-xs text-gray-300 select-none">
          <input
            type="checkbox"
            checked={allowPyramiding}
            onChange={(e) => setConfig((prev) => ({ ...prev, allowPyramiding: e.target.checked }))}
          />
          {t('backtest.allowPyramiding')}
        </label>

        <button
          type="button"
          onClick={onAutoPyramiding}
          disabled={!onAutoPyramiding || pyramidingOptimizing || allInMode}
          className={cn(
            'ml-1 h-8 px-2 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-gray-100',
            (!onAutoPyramiding || pyramidingOptimizing || allInMode) && 'opacity-50 cursor-not-allowed'
          )}
          title={allInMode ? t('backtest.allInPyramidingDisabled') : t('backtest.autoPyramidingHint')}
        >
          {pyramidingOptimizing ? t('backtest.optimizing') : t('backtest.autoPyramiding')}
        </button>

        <div className={cn('ml-2 text-xs text-gray-400', (!allowPyramiding || allInMode) && 'opacity-50')}>
          {t('backtest.orderLots')}
        </div>
        <Input
          value={orderLotsText}
          disabled={!allowPyramiding || allInMode}
          onFocus={() => (lotsEditing.current = true)}
          onChange={(e) => setOrderLotsText(sanitizeIntText(e.target.value))}
          onBlur={() => {
            lotsEditing.current = false;
            commitOrderLots();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement)?.blur();
          }}
          className="h-8 w-16 rounded-lg bg-white/5 border-white/10 text-gray-100 text-xs disabled:opacity-50"
        />

        {/* Confirm button: make sure the edited value takes effect immediately */}
        <button
          type="button"
          onClick={commitOrderLots}
          disabled={!allowPyramiding || allInMode}
          className={cn(
            'h-8 px-2 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-gray-100',
            (!allowPyramiding || allInMode) && 'opacity-50 cursor-not-allowed'
          )}
          title={allInMode ? t('backtest.orderLotsDisabled') : t('backtest.orderLotsConfirm')}
        >
          {t('common.confirm')}
        </button>

        <div className={cn('ml-2 text-xs text-gray-400', !allowPyramiding && 'opacity-50')}>{t('backtest.maxEntries')}</div>
        <Input
          value={maxEntriesText}
          disabled={!allowPyramiding}
          onFocus={() => (entEditing.current = true)}
          onChange={(e) => setMaxEntriesText(sanitizeIntText(e.target.value))}
          onBlur={() => {
            entEditing.current = false;
            commitMaxEntries();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement)?.blur();
          }}
          className="h-8 w-16 rounded-lg bg-white/5 border-white/10 text-gray-100 text-xs disabled:opacity-50"
        />

        {/* Confirm button: make sure the edited value takes effect immediately */}
        <button
          type="button"
          onClick={commitMaxEntries}
          disabled={!allowPyramiding}
          className={cn(
            'h-8 px-2 rounded-lg text-xs border border-white/10 bg-white/5 hover:bg-white/10 text-gray-100',
            !allowPyramiding && 'opacity-50 cursor-not-allowed'
          )}
          title={t('backtest.maxEntriesConfirm')}
        >
          {t('common.confirm')}
        </button>

        <label className={cn('ml-2 flex items-center gap-2 text-xs text-gray-300 select-none', !allowPyramiding && 'opacity-50')}>
          <input
            type="checkbox"
            checked={allowSameDirRepeat}
            disabled={!allowPyramiding}
            onChange={(e) => setConfig((prev) => ({ ...prev, allowSameDirectionRepeat: e.target.checked }))}
          />
          {t('backtest.allowSameDirectionRepeat')}
        </label>

        <div className="ml-auto text-xs text-gray-500">{t('backtest.executionHint')}</div>
      </div>

      <div className="text-[11px] text-gray-500 -mt-1">
        {t('backtest.footnote', { lotSize })}
      </div>

      {pyramidingCandidates && pyramidingCandidates.length > 0 && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-200">
              {t('backtest.autoPyramidingTop', { count: Math.min(8, pyramidingCandidates.length) })}
            </div>
            <div className="text-[11px] text-gray-500">{t('backtest.autoPyramidingApply')}</div>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left font-normal py-1">{t('backtest.orderLots')}</th>
                  <th className="text-left font-normal py-1">{t('backtest.maxEntries')}</th>
                  <th className="text-left font-normal py-1">PF</th>
                  <th className="text-left font-normal py-1">{t('backtest.netProfitPct')}</th>
                  <th className="text-left font-normal py-1">{t('backtest.maxDrawdownPct')}</th>
                  <th className="text-left font-normal py-1">{t('backtest.tradeCount')}</th>
                </tr>
              </thead>
              <tbody>
                {pyramidingCandidates.slice(0, 8).map((c, i) => (
                  <tr
                    key={`${c.orderLots}-${c.maxEntries}-${i}`}
                    className="text-gray-200 hover:bg-white/10 cursor-pointer"
                    onClick={() => onApplyPyramidingCandidate?.(c)}
                  >
                    <td className="py-1">{c.orderLots}</td>
                    <td className="py-1">{c.maxEntries}</td>
                    <td className="py-1">{c.profitFactor == null ? '-' : !Number.isFinite(c.profitFactor) ? '∞' : c.profitFactor.toFixed(2)}</td>
                    <td className="py-1">{c.netProfitPct.toFixed(2)}</td>
                    <td className="py-1">{c.maxDrawdownPct.toFixed(2)}</td>
                    <td className="py-1">{c.tradeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
