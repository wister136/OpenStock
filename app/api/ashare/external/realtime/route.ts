import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import RealtimeTapeSnapshot, { type RealtimeTimeframe } from '@/database/models/RealtimeTapeSnapshot';
import { normalizeSymbol } from '@/lib/ashare/symbol';

const LOOKBACK = 20;

export async function POST(req: Request) {
  const body = await req.json();
  const rawSymbol = body?.symbol;
  if (!rawSymbol) {
    return NextResponse.json({ ok: false, error: 'Missing symbol' }, { status: 400 });
  }
  const symbol = normalizeSymbol(rawSymbol);
  const timeframe = (body?.timeframe ?? '1m') as RealtimeTimeframe;
  const volume = Number(body?.volume);
  const amount = Number(body?.amount);
  const ts = Number(body?.ts ?? Date.now());
  const expectedVolume = body?.expectedVolume == null ? undefined : Number(body.expectedVolume);
  const expectedAmount = body?.expectedAmount == null ? undefined : Number(body.expectedAmount);

  if (!symbol || !['1m', '5m'].includes(timeframe)) {
    return NextResponse.json({ ok: false, error: 'Invalid symbol/timeframe' }, { status: 400 });
  }
  if (!Number.isFinite(ts) || String(ts).length < 12) {
    return NextResponse.json({ ok: false, error: 'Invalid ts' }, { status: 400 });
  }
  if (!Number.isFinite(volume) || !Number.isFinite(amount)) {
    return NextResponse.json({ ok: false, error: 'Invalid volume/amount' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const prev = await RealtimeTapeSnapshot.find({ symbol, timeframe }).sort({ ts: -1 }).limit(LOOKBACK).lean();
    const avgVol =
      prev.length > 0 ? prev.reduce((sum, p) => sum + Number(p.volume || 0), 0) / prev.length : undefined;
    const avgAmt =
      prev.length > 0 ? prev.reduce((sum, p) => sum + Number(p.amount || 0), 0) / prev.length : undefined;

    const expVol = Number.isFinite(expectedVolume) ? expectedVolume : avgVol;
    const expAmt = Number.isFinite(expectedAmount) ? expectedAmount : avgAmt;

    const volSurprise = expVol && expVol > 0 ? volume / expVol - 1 : undefined;
    const amtSurprise = expAmt && expAmt > 0 ? amount / expAmt - 1 : undefined;

    const saved = await RealtimeTapeSnapshot.create({
      symbol,
      timeframe,
      ts,
      volume,
      amount,
      expectedVolume: expVol,
      expectedAmount: expAmt,
      volSurprise,
      amtSurprise,
    });

    return NextResponse.json({
      ok: true,
      saved: {
        symbol: saved.symbol,
        ts: saved.ts,
        volSurprise: saved.volSurprise,
        amtSurprise: saved.amtSurprise,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol') ?? '');
  const timeframe = (searchParams.get('timeframe') ?? '1m') as RealtimeTimeframe;
  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Missing symbol' }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const latest = await RealtimeTapeSnapshot.findOne({ symbol, timeframe }).sort({ ts: -1 }).lean();
    const now = Date.now();
    if (!latest) {
      return NextResponse.json({ ok: true, symbol, latest: null });
    }
    return NextResponse.json({
      ok: true,
      symbol,
      timeframe,
      latest: {
        ts: latest.ts,
        volume: latest.volume,
        amount: latest.amount,
        expectedVolume: latest.expectedVolume,
        expectedAmount: latest.expectedAmount,
        volSurprise: latest.volSurprise,
        amtSurprise: latest.amtSurprise,
      },
      ageMs: now - latest.ts,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
