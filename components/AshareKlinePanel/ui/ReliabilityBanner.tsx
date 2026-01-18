"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import type { BacktestResult } from "../types";

export default function ReliabilityBanner({ backtest }: { backtest: BacktestResult }) {
  const { t } = useI18n();
  if (!backtest?.ok) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white font-medium">{t("ashare.reliability.title")}</div>
        <div className="text-xs text-gray-300">
          {t("ashare.reliability.level")}{" "}
          <span className="text-white font-medium">{backtest.reliabilityLevel}</span>
        </div>
      </div>

      {backtest.reliabilityNotes?.length ? (
        <ul className="mt-2 list-disc pl-4 text-[11px] text-gray-200 space-y-1">
          {backtest.reliabilityNotes.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-[11px] text-gray-200">{t("ashare.reliability.good")}</div>
      )}

      <div className="mt-2 text-[11px] text-gray-300">
        {t("ashare.reliability.sample", {
          start: backtest.sampleStart || "--",
          end: backtest.sampleEnd || "--",
          days: backtest.coverDays || "--",
          bars: backtest.barCount,
          trades: backtest.tradeCount,
        })}
      </div>
    </div>
  );
}
