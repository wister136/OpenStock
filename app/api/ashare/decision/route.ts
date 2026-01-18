import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import AshareBar, { type AshareBarFreq } from '@/database/models/ashareBar.model';
import AshareStrategyConfig from '@/database/models/AshareStrategyConfig';
import { buildDefaultConfig, normalizeConfig } from '@/lib/ashare/config';
import { getDecision } from '@/lib/ashare/engine';

const CACHE_TTL_MS = 4_000;
const cache = new Map<string, { ts: number; data: any }>();

const ALLOWED_FREQS: ReadonlySet<AshareBarFreq> = new Set(['1m', '5m', '15m', '30m', '60m', '1d']);

function normalizeSymbol(input: string | null): string {
  const s = (input || '').trim().toUpperCase();
  if (!s.includes(':')) return s;
  const [ex, tk] = s.split(':');
  return `${ex}:${tk}`;
}

function normalizeIsoCandidate(s: string): string {
  let x = (s || '').trim();
  if (x.includes(' ') && !x.includes('T')) x = x.replace(' ', 'T');
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(x);
  if (!hasTimezone && /^\d{4}-\d{2}-\d{2}T/.test(x)) x = `${x}Z`;
  return x;
}

function toEpochMillis(ts: unknown): number | null {
  if (ts == null) return null;
  if (ts instanceof Date) {
    const ms = ts.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof ts === 'number') {
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(normalizeIsoCandidate(ts));
    return Number.isFinite(parsed) ? parsed : null;
  }
  try {
    const ms = new Date(ts as any).getTime();
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol'));
  const tf = (searchParams.get('tf') || '1d').trim() as AshareBarFreq;
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '500', 10) || 500, 100), 5000);

  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Missing symbol' }, { status: 400 });
  }
  if (!ALLOWED_FREQS.has(tf)) {
    return NextResponse.json({ ok: false, error: `Unsupported tf: ${tf}` }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const userId = String(session.user.id);
    let config = await AshareStrategyConfig.findOne({ userId, symbol }).lean();
    if (!config) {
      config = (await AshareStrategyConfig.create(buildDefaultConfig(userId, symbol))).toObject();
    }
    const normalized = normalizeConfig(config, userId, symbol);

    const configHash = hashString(JSON.stringify(normalized));
    const cacheKey = `${symbol}|${tf}|${limit}|${configHash}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const docs = await AshareBar.find({ symbol, freq: tf }).sort({ ts: -1 }).limit(limit).lean();
    const bars = docs
      .reverse()
      .map((d: any) => {
        const t = toEpochMillis(d.ts);
        if (!Number.isFinite(t)) return null;
        return {
          ts: t as number,
          open: Number(d.open),
          high: Number(d.high),
          low: Number(d.low),
          close: Number(d.close),
          volume: Number(d.volume),
          amount: d.amount == null ? undefined : Number(d.amount),
        };
      })
      .filter(Boolean) as Array<{ ts: number; open: number; high: number; low: number; close: number; volume: number; amount?: number }>;

    const decision = await getDecision({
      symbol,
      timeframe: tf,
      bars,
      config: normalized,
      overrides: {
        mockNewsScore: searchParams.get('mockNewsScore') ? Number(searchParams.get('mockNewsScore')) : undefined,
        mockNewsConfidence: searchParams.get('mockNewsConfidence') ? Number(searchParams.get('mockNewsConfidence')) : undefined,
      },
    });

    const response = {
      ok: true,
      symbol,
      tf,
      decision,
      config: normalized,
    };

    cache.set(cacheKey, { ts: Date.now(), data: response });

    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
