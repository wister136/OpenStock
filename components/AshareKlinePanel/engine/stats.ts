// Stats helpers (future refactor target)
export function pct(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return NaN;
  return (b - a) / a;
}
