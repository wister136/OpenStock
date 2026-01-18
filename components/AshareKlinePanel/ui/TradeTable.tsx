"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import type { BacktestTrade } from "../types";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatTs(ts: number): string {
  if (!Number.isFinite(ts)) return "--";
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "--";
  return n.toFixed(digits);
}

export default function TradeTable({ trades, lotSize }: { trades: BacktestTrade[]; lotSize: number }) {
  const { t } = useI18n();
  const rows = (trades ?? []).filter((tr) => !tr.open);

  return (
    <div className="w-full overflow-auto rounded-lg border border-white/10">
      <table className="min-w-[1180px] w-full text-xs">
        <thead className="bg-white/5 text-gray-300">
          <tr>
            <th className="text-left px-3 py-2 whitespace-nowrap">{t("ashare.trade.entryTime")}</th>
            <th className="text-left px-3 py-2 whitespace-nowrap">{t("ashare.trade.exitTime")}</th>

            <th className="text-right px-3 py-2 whitespace-nowrap">{t("ashare.trade.entryPrice")}</th>
            <th className="text-right px-3 py-2 whitespace-nowrap">{t("ashare.trade.entryValue")}</th>
            <th className="text-right px-3 py-2 whitespace-nowrap">{t("ashare.trade.exitPrice")}</th>
            <th className="text-right px-3 py-2 whitespace-nowrap">{t("ashare.trade.exitValue")}</th>

            <th className="text-right px-3 py-2 whitespace-nowrap">{t("ashare.trade.pyramidIndex")}</th>
            <th className="text-right px-3 py-2 whitespace-nowrap">{t("ashare.trade.lots")}</th>
            <th className="text-right px-3 py-2 whitespace-nowrap">{t("ashare.trade.pnlAmount")}</th>
            <th className="text-right px-3 py-2 whitespace-nowrap">{t("ashare.trade.pnlPct")}</th>
            <th className="text-right px-3 py-2 whitespace-nowrap">{t("ashare.trade.holdingBars")}</th>
            <th className="text-right px-3 py-2 whitespace-nowrap">{t("ashare.trade.shares")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={12} className="px-3 py-6 text-center text-gray-500">
                {t("ashare.trade.empty")}
              </td>
            </tr>
          ) : (
            rows.map((tr, i) => {
              const pnlColor = tr.pnl >= 0 ? "text-rose-400" : "text-emerald-400";
              const shares =
                tr.shares != null ? tr.shares : tr.lots != null ? tr.lots * lotSize : Number.NaN;
              const entryUnit = Number.isFinite(tr.avgCost) ? tr.avgCost : tr.entryPrice;
              const entryTotal = Number.isFinite(shares) ? entryUnit * shares : Number.NaN;
              const exitTotal = Number.isFinite(shares) ? tr.exitPrice * shares : Number.NaN;
              return (
                <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2 whitespace-nowrap">{formatTs(tr.entryTime)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatTs(tr.exitTime)}</td>

                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(entryUnit, 2)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(entryTotal, 0)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(tr.exitPrice, 2)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(exitTotal, 0)}</td>

                  <td className="px-3 py-2 text-right whitespace-nowrap">{tr.entryFills ?? "--"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{tr.lots ?? "--"}</td>
                  <td className={"px-3 py-2 text-right whitespace-nowrap " + pnlColor}>
                    {tr.pnl >= 0 ? "+" : ""}
                    {fmt(tr.pnl, 2)}
                  </td>
                  <td className={"px-3 py-2 text-right whitespace-nowrap " + pnlColor}>
                    {tr.pnlPct >= 0 ? "+" : ""}
                    {fmt(tr.pnlPct, 2)}%
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{tr.barsHeld ?? "--"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {Number.isFinite(shares) ? shares : "--"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <div className="px-3 py-2 text-[11px] text-gray-500 border-t border-white/5">
        {t("ashare.trade.lotHint", { lot: lotSize })}
      </div>
    </div>
  );
}
