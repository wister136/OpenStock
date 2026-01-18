import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';
import { normalizeSymbol } from '@/lib/ashare/symbol';

const NEWS_TTL_MS = 4 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const body = await req.json();
  const symbol = normalizeSymbol(body?.symbol ?? 'GLOBAL') || 'GLOBAL';
  const ts = Number(body?.ts ?? Date.now());
  const score = Number(body?.score);
  const confidence = Number(body?.confidence);
  const sources = Array.isArray(body?.sources) ? body.sources.map(String).filter(Boolean) : [];
  const topKeywords = Array.isArray(body?.topKeywords) ? body.topKeywords.map(String).filter(Boolean) : [];
  const rawCount = body?.rawCount == null ? undefined : Number(body.rawCount);

  if (!Number.isFinite(ts) || String(ts).length < 12) {
    return NextResponse.json({ ok: false, error: 'Invalid ts' }, { status: 400 });
  }
  if (!Number.isFinite(score) || score < -1 || score > 1) {
    return NextResponse.json({ ok: false, error: 'Invalid score' }, { status: 400 });
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return NextResponse.json({ ok: false, error: 'Invalid confidence' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const saved = await NewsSentimentSnapshot.create({
      symbol,
      ts,
      score,
      confidence,
      sources,
      topKeywords: topKeywords.length ? topKeywords : undefined,
      rawCount: Number.isFinite(rawCount) ? rawCount : undefined,
    });
    return NextResponse.json({
      ok: true,
      saved: {
        symbol: saved.symbol,
        ts: saved.ts,
        score: saved.score,
        confidence: saved.confidence,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol') ?? 'GLOBAL') || 'GLOBAL';
  try {
    await connectToDatabase();
    const latest =
      (await NewsSentimentSnapshot.findOne({ symbol }).sort({ ts: -1 }).lean()) ||
      (await NewsSentimentSnapshot.findOne({ symbol: 'GLOBAL' }).sort({ ts: -1 }).lean());
    const now = Date.now();
    if (!latest) {
      return NextResponse.json({ ok: true, symbol, latest: null });
    }
    const ageMs = now - latest.ts;
    return NextResponse.json({
      ok: true,
      symbol,
      latest: {
        ts: latest.ts,
        score: latest.score,
        confidence: latest.confidence,
        sources: latest.sources,
        topKeywords: latest.topKeywords,
      },
      ageMs,
      ttlMs: NEWS_TTL_MS,
      isStale: ageMs > NEWS_TTL_MS,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
