// Filters (future refactor target)
export function adaptiveQuantile(values: number[], q: number): number {
  const xs = values.filter((v) => Number.isFinite(v)).slice().sort((a,b)=>a-b);
  if (!xs.length) return NaN;
  const pos = Math.min(xs.length - 1, Math.max(0, (xs.length - 1) * q));
  const base = Math.floor(pos);
  const rest = pos - base;
  const v0 = xs[base];
  const v1 = xs[Math.min(xs.length - 1, base + 1)];
  return v0 + (v1 - v0) * rest;
}
