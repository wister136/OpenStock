export function buildEquityPoints(backtest: any, bars: any[], initialCapital: number): Array<{ time: number; value: number }> {
  const tryArrays = ['equityCurve', 'equity', 'equitySeries', 'equityPoints', 'navCurve', 'balanceCurve'];
  for (const k of tryArrays) {
    const v = backtest?.[k];
    if (!v) continue;

    if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
      const out: Array<{ time: number; value: number }> = [];
      for (const p of v) {
        const t = Number((p as any).time ?? (p as any).t ?? (p as any).timestamp);
        const val = Number((p as any).value ?? (p as any).equity ?? (p as any).nav ?? (p as any).balance);
        if (Number.isFinite(t) && Number.isFinite(val)) out.push({ time: t > 1e12 ? Math.floor(t / 1000) : Math.floor(t), value: val });
      }
      if (out.length > 1) return out;
    }

    if (Array.isArray(v) && v.length && typeof v[0] === 'number' && Array.isArray(bars) && bars.length) {
      const n = Math.min(v.length, bars.length);
      const out: Array<{ time: number; value: number }> = [];
      for (let i = 0; i < n; i++) {
        const t = Number((bars[i] as any)?.t);
        const val = Number(v[i]);
        if (Number.isFinite(t) && Number.isFinite(val)) out.push({ time: Math.floor(t), value: val });
      }
      if (out.length > 1) return out;
    }
  }

  const trades = Array.isArray(backtest?.trades) ? backtest.trades : [];
  let equity = Number.isFinite(initialCapital) ? initialCapital : 0;

  const points: Array<{ time: number; value: number }> = [];

  for (const tr of trades) {
    if ((tr as any)?.open === true) continue;

    const pnl =
      Number((tr as any).pnl ?? (tr as any).profit ?? (tr as any).profitAmount ?? (tr as any).incomeAmount ?? (tr as any).收益金额 ?? 0) || 0;

    const t =
      Number(
        (tr as any).exitTime ??
          (tr as any).exit ??
          (tr as any).closeTime ??
          (tr as any).close ??
          (tr as any).endTime ??
          (tr as any).outTime ??
          (tr as any).出场时间
      ) || NaN;

    const tt = Number.isFinite(t) ? (t > 1e12 ? Math.floor(t / 1000) : Math.floor(t)) : NaN;
    if (!Number.isFinite(tt)) continue;

    equity += pnl;
    points.push({ time: tt, value: equity });
  }

  return points.length > 1 ? points : [];
}
