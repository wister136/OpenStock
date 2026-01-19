import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import AshareBar, { type AshareBarFreq } from '@/database/models/ashareBar.model';
import AutoTuneSnapshot from '@/database/models/AutoTuneSnapshot';
import { normalizeSymbol } from '@/lib/ashare/symbol';
import { searchParams as searchParamsCore } from '@/lib/ashare/autotune/core';

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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const symbol = normalizeSymbol(body?.symbol);
  const tf = (body?.tf ?? '1d') as AshareBarFreq;
  const trainDays = Math.min(Math.max(Number(body?.trainDays ?? 180), 30), 720);
  const trials = Math.min(Math.max(Number(body?.trials ?? 80), 20), 200);

  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Missing symbol' }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ? String(session.user.id) : 'user_default';

  try {
    await connectToDatabase();
    const docs = await AshareBar.find({ symbol, freq: tf }).sort({ ts: -1 }).limit(5000).lean();
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

    const cutoff = Date.now() - trainDays * 24 * 60 * 60 * 1000;
    const trainBars = bars.filter((b) => b.ts >= cutoff);
    if (trainBars.length < 120) {
      return NextResponse.json({ ok: false, error: 'Insufficient bars for autotune' }, { status: 400 });
    }

    const { bestParams, metrics } = searchParamsCore(trainBars, trials);
    const snapshot = await AutoTuneSnapshot.create({
      userId,
      symbol,
      tf,
      trainDays,
      trials,
      objective: 'netReturn - 0.7*maxDD - 0.001*trades',
      bestParams,
      metrics,
    });

    return NextResponse.json({
      ok: true,
      bestParams,
      metrics,
      serverTime: Date.now(),
      trainDays,
      trials,
      objective: snapshot.objective,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol'));
  const tf = (searchParams.get('tf') ?? '1d') as AshareBarFreq;
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ? String(session.user.id) : 'user_default';

  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Missing symbol' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const latest = (await AutoTuneSnapshot.findOne({ userId, symbol, tf }).sort({ createdAt: -1 }).lean()) as any;
    return NextResponse.json({
      ok: true,
      symbol,
      tf,
      latest: latest
        ? {
            trainDays: latest.trainDays,
            trials: latest.trials,
            objective: latest.objective,
            bestParams: latest.bestParams,
            metrics: latest.metrics,
            createdAt: latest.createdAt,
          }
        : null,
      serverTime: Date.now(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
