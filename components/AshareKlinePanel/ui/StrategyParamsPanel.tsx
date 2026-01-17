'use client';

import React from 'react';
import type { StrategyKey, StrategyParams } from '../types';
import { Input } from '@/components/ui/input';

type Props = {
  strategy: StrategyKey;
  stParams: StrategyParams;
  setStParams: (next: StrategyParams) => void;
};

function clampNum(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export default function StrategyParamsPanel({ strategy, stParams, setStParams }: Props) {
  if (strategy === 'none') return null;

  const f = stParams.filters;

  return (
    <div className="mt-3 space-y-3">
      {/* Strategy-specific params */}
      {(strategy === 'supertrend' || strategy === 'atrBreakout' || strategy === 'turtle') && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
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
      )}

      {/* Editable filters */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white font-medium">过滤器（可编辑）</div>
          <label className="flex items-center gap-2 text-[11px] text-gray-300 select-none" title="开启后会减少震荡市假信号，但可能降低交易次数。">
            <input
              type="checkbox"
              checked={Boolean(f.enable)}
              onChange={(e) => setStParams({ ...stParams, filters: { ...f, enable: e.target.checked } })}
            />
            启用
          </label>
        </div>

        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-gray-300">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="趋势 EMA 长度（用于站上/斜率过滤）">
            <div>趋势EMA</div>
            <Input
              value={String(f.trendEmaLen)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, trendEmaLen: Math.max(2, Math.floor(Number(e.target.value) || 50)) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>

          <label className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1 select-none" title="要求价格站上趋势EMA才允许开仓（趋势确认）">
            <span>站上EMA</span>
            <input
              type="checkbox"
              checked={Boolean(f.requireAboveEma)}
              onChange={(e) => setStParams({ ...stParams, filters: { ...f, requireAboveEma: e.target.checked } })}
            />
          </label>

          <label className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1 select-none" title="要求EMA最近几根K线向上（避免震荡反复）">
            <span>EMA斜率↑</span>
            <input
              type="checkbox"
              checked={Boolean(f.requireEmaSlopeUp)}
              onChange={(e) => setStParams({ ...stParams, filters: { ...f, requireEmaSlopeUp: e.target.checked } })}
            />
          </label>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="EMA斜率回看根数（例如5表示与5根前比较）">
            <div>斜率回看</div>
            <Input
              value={String(f.emaSlopeLookback)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, emaSlopeLookback: clampNum(Math.floor(Number(e.target.value) || 5), 1, 200) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="成交量均线周期">
            <div>均量周期</div>
            <Input
              value={String(f.volLookback)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, volLookback: clampNum(Math.floor(Number(e.target.value) || 20), 1, 300) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="成交量爆发倍数（1.1=大于均量10%才允许开仓；0表示关闭）">
            <div>量能倍数</div>
            <Input
              value={String(f.volMult)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, volMult: clampNum(Number(e.target.value) || 0, 0, 20) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="软性缩量底线：低于均量的该百分比则拒绝开仓（0=关闭）。建议 0~10">
            <div>最小量(%)</div>
            <Input
              value={String(f.volFloorPct ?? 5)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, volFloorPct: clampNum(Number(e.target.value) || 0, 0, 100) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="两次BUY之间至少间隔多少根K线（0=关闭）">
            <div>买入冷却</div>
            <Input
              value={String(f.minBarsBetweenBuys)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, minBarsBetweenBuys: clampNum(Math.floor(Number(e.target.value) || 0), 0, 500) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="ADX计算周期">
            <div>ADX周期</div>
            <Input
              value={String(f.adxLen ?? 14)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, adxLen: clampNum(Math.floor(Number(e.target.value) || 14), 2, 100) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="最小ADX阈值（0=关闭）。典型：15~25">
            <div>ADX阈值</div>
            <Input
              value={String(f.minAdx ?? 0)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, minAdx: clampNum(Number(e.target.value) || 0, 0, 80) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="ATR过滤周期">
            <div>ATR周期</div>
            <Input
              value={String(f.atrLen)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, atrLen: clampNum(Math.floor(Number(e.target.value) || 14), 2, 200) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="最小ATR%(ATR/Close*100)。过滤低波动噪声（0=关闭）">
            <div>最小ATR%</div>
            <Input
              value={String(f.minAtrPct)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, minAtrPct: clampNum(Number(e.target.value) || 0, 0, 100) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1" title="最大ATR%(ATR/Close*100)。过滤极端风险（0=关闭）">
            <div>最大ATR%</div>
            <Input
              value={String(f.maxAtrPct)}
              onChange={(e) =>
                setStParams({
                  ...stParams,
                  filters: { ...f, maxAtrPct: clampNum(Number(e.target.value) || 0, 0, 200) },
                })
              }
              className="h-7 w-16 rounded-md bg-white/5 border-white/10 text-gray-100 text-[11px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
