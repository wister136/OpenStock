import type { OHLCVBar } from '@/lib/indicators';

export function mapRawBarsToOHLCV(rawBars: any[]): OHLCVBar[] {
  return (rawBars ?? [])
    .map((b) => {
      const t0 = b.t;
      const t = typeof t0 === 'number' ? (t0 > 1e12 ? Math.floor(t0 / 1000) : Math.floor(t0)) : NaN;
      return {
        t,
        o: Number(b.o),
        h: Number(b.h),
        l: Number(b.l),
        c: Number(b.c),
        v: Number(b.v ?? 0),
      };
    })
    .filter((b) => Number.isFinite(b.t) && Number.isFinite(b.o) && Number.isFinite(b.h) && Number.isFinite(b.l) && Number.isFinite(b.c));
}
