"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { StrategyKey, StrategyParams } from "../types";

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
  const { t } = useI18n();
  if (strategy === "none") return null;

  const f = stParams.filters;

  return (
    <div className="mt-3 space-y-3">
      {(strategy === "supertrend" || strategy === "atrBreakout" || strategy === "turtle") && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white font-medium">{t("ashare.params.strategyParams")}</div>

          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-gray-300">
            {strategy === "supertrend" && (
              <>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
                  <div>{t("ashare.params.atrLen")}</div>
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
                  <div>{t("ashare.params.mult")}</div>
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

            {strategy === "atrBreakout" && (
              <>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
                  <div>{t("ashare.params.channelLen")}</div>
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
                  <div>{t("ashare.params.atrLen")}</div>
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
                  <div>{t("ashare.params.atrBuffer")}</div>
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

            {strategy === "turtle" && (
              <>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
                  <div>{t("ashare.params.entryLen")}</div>
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
                  <div>{t("ashare.params.exitLen")}</div>
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

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white font-medium">{t("ashare.panel.filters")}</div>
          <label
            className="flex items-center gap-2 text-[11px] text-gray-300 select-none"
            title={t("ashare.params.tip.enable")}
          >
            <input
              type="checkbox"
              checked={Boolean(f.enable)}
              onChange={(e) => setStParams({ ...stParams, filters: { ...f, enable: e.target.checked } })}
            />
            {t("ashare.params.enable")}
          </label>
        </div>

        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-gray-300">
          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.trendEma")}
          >
            <div>{t("ashare.params.trendEma")}</div>
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

          <label
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1 select-none"
            title={t("ashare.params.tip.requireAboveEma")}
          >
            <span>{t("ashare.params.requireAboveEma")}</span>
            <input
              type="checkbox"
              checked={Boolean(f.requireAboveEma)}
              onChange={(e) => setStParams({ ...stParams, filters: { ...f, requireAboveEma: e.target.checked } })}
            />
          </label>

          <label
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1 select-none"
            title={t("ashare.params.tip.emaSlopeUp")}
          >
            <span>{t("ashare.params.emaSlopeUp")}</span>
            <input
              type="checkbox"
              checked={Boolean(f.requireEmaSlopeUp)}
              onChange={(e) => setStParams({ ...stParams, filters: { ...f, requireEmaSlopeUp: e.target.checked } })}
            />
          </label>

          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.emaSlopeLookback")}
          >
            <div>{t("ashare.params.emaSlopeLookback")}</div>
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

          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.volLookback")}
          >
            <div>{t("ashare.params.volLookback")}</div>
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

          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.volMult")}
          >
            <div>{t("ashare.params.volMult")}</div>
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

          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.volFloorPct")}
          >
            <div>{t("ashare.params.volFloorPct")}</div>
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

          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.minBarsBetweenBuys")}
          >
            <div>{t("ashare.params.minBarsBetweenBuys")}</div>
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

          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.adxLen")}
          >
            <div>{t("ashare.params.adxLen")}</div>
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

          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.minAdx")}
          >
            <div>{t("ashare.params.minAdx")}</div>
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

          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.atrLen")}
          >
            <div>{t("ashare.params.atrFilterLen")}</div>
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

          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.minAtrPct")}
          >
            <div>{t("ashare.params.minAtrPct")}</div>
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

          <div
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1"
            title={t("ashare.params.tip.maxAtrPct")}
          >
            <div>{t("ashare.params.maxAtrPct")}</div>
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
