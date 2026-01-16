'use client';

import React from 'react';
import type { StrategyKey, StrategyParams } from '../types';
import { Input } from '@/components/ui/input';

type Props = {
  strategy: StrategyKey;
  stParams: StrategyParams;
  setStParams: (next: StrategyParams) => void;
};

export default function StrategyParamsPanel({ strategy, stParams, setStParams }: Props) {
  if (!(strategy === 'supertrend' || strategy === 'atrBreakout' || strategy === 'turtle')) return null;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white font-medium">策略参数</div>

      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-gray-300">
        {strategy === 'supertrend' && (
          <>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
              <div>ATR 周期</div>
              <Input
                value={String(stParams.supertrend.atrLen)}
                onChange={(e) =>
                  setStParams({
                    ...stParams,
                    supertrend: { ...stParams.supertrend, atrLen: Math.max(2, Number(e.target.value) || 2) },
                  })
                }
                className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
              <div>倍数</div>
              <Input
                value={String(stParams.supertrend.mult)}
                onChange={(e) =>
                  setStParams({
                    ...stParams,
                    supertrend: { ...stParams.supertrend, mult: Math.max(0.5, Number(e.target.value) || 1) },
                  })
                }
                className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
              />
            </div>
          </>
        )}

        {strategy === 'atrBreakout' && (
          <>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
              <div>通道长度</div>
              <Input
                value={String(stParams.atrBreakout.donLen)}
                onChange={(e) =>
                  setStParams({
                    ...stParams,
                    atrBreakout: { ...stParams.atrBreakout, donLen: Math.max(5, Number(e.target.value) || 20) },
                  })
                }
                className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
              <div>ATR 周期</div>
              <Input
                value={String(stParams.atrBreakout.atrLen)}
                onChange={(e) =>
                  setStParams({
                    ...stParams,
                    atrBreakout: { ...stParams.atrBreakout, atrLen: Math.max(2, Number(e.target.value) || 14) },
                  })
                }
                className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
              <div>ATR 缓冲倍数</div>
              <Input
                value={String(stParams.atrBreakout.atrMult)}
                onChange={(e) =>
                  setStParams({
                    ...stParams,
                    atrBreakout: { ...stParams.atrBreakout, atrMult: Math.max(0, Number(e.target.value) || 0) },
                  })
                }
                className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
              />
            </div>
          </>
        )}

        {strategy === 'turtle' && (
          <>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
              <div>入场长度</div>
              <Input
                value={String(stParams.turtle.entryLen)}
                onChange={(e) =>
                  setStParams({
                    ...stParams,
                    turtle: { ...stParams.turtle, entryLen: Math.max(10, Number(e.target.value) || 20) },
                  })
                }
                className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
              <div>退出长度</div>
              <Input
                value={String(stParams.turtle.exitLen)}
                onChange={(e) =>
                  setStParams({
                    ...stParams,
                    turtle: { ...stParams.turtle, exitLen: Math.max(5, Number(e.target.value) || 10) },
                  })
                }
                className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
