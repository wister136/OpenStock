import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import RealtimeTapeSnapshot, { type RealtimeTimeframe } from '@/database/models/RealtimeTapeSnapshot';

const LOOKBACK = 20;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const symbol = typeof body?.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  const timeframe = (body?.timeframe ?? '1m') as RealtimeTimeframe;
  const volume = Number(body?.volume);
  const amount = Number(body?.amount);

  if (!symbol || !['1m', '5m'].includes(timeframe)) {
    return NextResponse.json({ ok: false, error: 'Invalid symbol/timeframe' }, { status: 400 });
  }
  if (!Number.isFinite(volume) || !Number.isFinite(amount)) {
    return NextResponse.json({ ok: false, error: 'Invalid volume/amount' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const prev = await RealtimeTapeSnapshot.find({ symbol, timeframe }).sort({ ts: -1 }).limit(LOOKBACK).lean();
    const avgVol =
      prev.length > 0 ? prev.reduce((sum, p) => sum + Number(p.volume || 0), 0) / prev.length : volume;
    const avgAmt =
      prev.length > 0 ? prev.reduce((sum, p) => sum + Number(p.amount || 0), 0) / prev.length : amount;

    const expectedVolume = avgVol > 0 ? avgVol : volume;
    const expectedAmount = avgAmt > 0 ? avgAmt : amount;

    const volSurprise = expectedVolume > 0 ? volume / expectedVolume - 1 : 0;
    const amtSurprise = expectedAmount > 0 ? amount / expectedAmount - 1 : 0;

    await RealtimeTapeSnapshot.create({
      symbol,
      timeframe,
      ts: Date.now(),
      volume,
      amount,
      expectedVolume,
      expectedAmount,
      volSurprise,
      amtSurprise,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
