'use client';

import React from 'react';
import type { BacktestResult } from '../types';

export default function ReliabilityBanner({ backtest }: { backtest: BacktestResult }) {
  if (!backtest?.ok) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white font-medium">可信度提示</div>
        <div className="text-xs text-gray-300">
          级别：<span className="text-white font-medium">{backtest.reliabilityLevel}</span>
        </div>
      </div>

      {backtest.reliabilityNotes?.length ? (
        <ul className="mt-2 list-disc pl-4 text-[11px] text-gray-200 space-y-1">
          {backtest.reliabilityNotes.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-[11px] text-gray-200">样本充足，结果相对稳定（仍不保证未来表现）。</div>
      )}

      <div className="mt-2 text-[11px] text-gray-300">
        样本：{backtest.sampleStart || '--'} ~ {backtest.sampleEnd || '--'}（{backtest.coverDays || '--'} 个交易日，{backtest.barCount} 根K，交易 {backtest.tradeCount} 笔）
      </div>
    </div>
  );
}
