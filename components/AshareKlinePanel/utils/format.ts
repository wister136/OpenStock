export function fmtPct(v?: number) {
  if (v == null || !Number.isFinite(v)) return '--';
  return `${(v * 100).toFixed(0)}%`;
}

export function fmtTs(ts?: number) {
  if (!ts || !Number.isFinite(ts)) return '--';
  return new Date(ts).toLocaleTimeString();
}

export function fmtDateTime(ts?: number) {
  if (!ts || !Number.isFinite(ts)) return '--';
  return new Date(ts).toLocaleString();
}

export function fmtAge(ms?: number | null) {
  if (ms == null || !Number.isFinite(ms)) return '--';
  const min = Math.max(0, Math.floor(ms / 60000));
  return `${min}m`;
}

export function fmt(v: number | null | undefined, digits: number = 2): string {
  if (v == null || !Number.isFinite(v)) return '--';
  return Number(v).toFixed(digits);
}
