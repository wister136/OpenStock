import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const symbol = typeof body?.symbol === 'string' && body.symbol.trim() ? body.symbol.trim().toUpperCase() : 'GLOBAL';
  const score = Number(body?.score);
  const confidence = Number(body?.confidence);
  const sources = Array.isArray(body?.sources) ? body.sources.map(String).filter(Boolean) : [];
  const topKeywords = Array.isArray(body?.topKeywords) ? body.topKeywords.map(String).filter(Boolean) : undefined;
  const rawCount = body?.rawCount == null ? undefined : Number(body.rawCount);

  if (!Number.isFinite(score) || !Number.isFinite(confidence) || sources.length === 0) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    await NewsSentimentSnapshot.create({
      symbol,
      ts: Date.now(),
      score,
      confidence,
      sources,
      topKeywords,
      rawCount: Number.isFinite(rawCount) ? rawCount : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
