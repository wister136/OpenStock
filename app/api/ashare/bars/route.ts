import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import AshareBar, { type AshareBarFreq } from '@/database/models/ashareBar.model';

const ALLOWED_FREQS: ReadonlySet<AshareBarFreq> = new Set(['1m', '5m', '15m', '30m', '60m', '1d']);

function normalizeSymbol(input: string | null): string {
  const s = (input || '').trim().toUpperCase();
  // expect: SSE:603516 / SZSE:002317
  if (!s.includes(':')) return s;
  const [ex, tk] = s.split(':');
  return `${ex}:${tk}`;
}

function normalizeIsoCandidate(s: string): string {
  let x = (s || '').trim();
  // "2025-12-18 02:00:00.000" -> "2025-12-18T02:00:00.000"
  if (x.includes(' ') && !x.includes('T')) x = x.replace(' ', 'T');
  // If no explicit timezone is present, treat it as UTC.
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(x);
  if (!hasTimezone && /^\d{4}-\d{2}-\d{2}T/.test(x)) x = `${x}Z`;
  return x;
}

function toEpochSeconds(ts: unknown): number | null {
  if (ts == null) return null;

  if (ts instanceof Date) {
    const ms = ts.getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  if (typeof ts === 'number') {
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  if (typeof ts === 'string') {
    const parsed = Date.parse(normalizeIsoCandidate(ts));
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }

  try {
    const ms = new Date(ts as any).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol'));
  const freq = (searchParams.get('freq') || '30m').trim() as AshareBarFreq;
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '800', 10) || 800, 50), 5000);

  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Missing symbol' }, { status: 400 });
  }
  if (!ALLOWED_FREQS.has(freq)) {
    return NextResponse.json({ ok: false, error: `Unsupported freq: ${freq}` }, { status: 400 });
  }

  console.log(`[ashare/bars] query symbol=${symbol} freq=${freq} limit=${limit}`);

  try {
    await connectToDatabase();

    // Get last N then reverse to ascending for chart
    const docs = await AshareBar.find({ symbol, freq })
      .sort({ ts: -1 })
      .limit(limit)
      .lean();

    const asc = docs.reverse();

    const bars = asc
      .map((d: any) => {
        const t = toEpochSeconds(d.ts);
        return {
          t: t ?? NaN,
          o: Number(d.open),
          h: Number(d.high),
          l: Number(d.low),
          c: Number(d.close),
          v: Number(d.volume),
          a: d.amount == null ? undefined : Number(d.amount),
        };
      })
      .filter((b) => Number.isFinite(b.t));

    const dropped = asc.length - bars.length;

    const updatedAt = docs.length ? docs[0]?.updatedAt ?? docs[0]?.createdAt : null;
    const firstTs = asc.length ? asc[0]?.ts : null;
    const lastTs = asc.length ? asc[asc.length - 1]?.ts : null;

    console.log(
      `[ashare/bars] result count=${bars.length}/${asc.length} dropped=${dropped} firstTs=${String(firstTs)} lastTs=${String(lastTs)} elapsedMs=${
        Date.now() - startedAt
      }`
    );

    if (dropped > 0) {
      const samples = asc
        .filter((d: any) => !Number.isFinite(toEpochSeconds(d.ts) ?? NaN))
        .slice(0, 3)
        .map((d: any) => d.ts);
      console.warn(`[ashare/bars] WARNING bad ts sample:`, samples);
    }

    return NextResponse.json({ ok: true, symbol, freq, limit, count: bars.length, bars, updatedAt });
  } catch (e: any) {
    console.error(`[ashare/bars] ERROR symbol=${symbol} freq=${freq}`, e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
