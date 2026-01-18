import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsItem from '@/database/models/NewsItem';
import { normalizeSymbol } from '@/lib/ashare/symbol';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function POST(req: Request) {
  const body = await req.json();
  const symbol = normalizeSymbol(body?.symbol);
  const ts = Number(body?.ts ?? Date.now());
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const summary = typeof body?.summary === 'string' ? body.summary.trim() : undefined;
  const url = typeof body?.url === 'string' ? body.url.trim() : undefined;
  const source = typeof body?.source === 'string' ? body.source.trim() : '';
  const sentimentScore = body?.sentimentScore == null ? undefined : Number(body.sentimentScore);
  const impactScore = body?.impactScore == null ? undefined : Number(body.impactScore);
  const keywords = Array.isArray(body?.keywords) ? body.keywords.map(String).filter(Boolean) : undefined;

  if (!title || !source) {
    return NextResponse.json({ ok: false, error: 'Missing title/source' }, { status: 400 });
  }
  if (!Number.isFinite(ts) || String(ts).length < 12) {
    return NextResponse.json({ ok: false, error: 'Invalid ts' }, { status: 400 });
  }
  if (sentimentScore != null && (!Number.isFinite(sentimentScore) || sentimentScore < -1 || sentimentScore > 1)) {
    return NextResponse.json({ ok: false, error: 'Invalid sentimentScore' }, { status: 400 });
  }
  if (impactScore != null && (!Number.isFinite(impactScore) || impactScore < 0 || impactScore > 1)) {
    return NextResponse.json({ ok: false, error: 'Invalid impactScore' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const saved = await NewsItem.create({
      symbol,
      ts,
      title,
      summary,
      url,
      source,
      sentimentScore,
      impactScore: isFiniteNumber(impactScore) ? impactScore : undefined,
      keywords,
      raw: body?.raw,
    });
    return NextResponse.json({
      ok: true,
      saved: {
        symbol: saved.symbol,
        ts: saved.ts,
        title: saved.title,
        source: saved.source,
        sentimentScore: saved.sentimentScore,
        impactScore: saved.impactScore,
      },
      serverTime: Date.now(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol'));
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

  try {
    await connectToDatabase();
    const items = await NewsItem.find({ symbol }).sort({ ts: -1 }).limit(limit).lean();
    return NextResponse.json({
      ok: true,
      symbol,
      serverTime: Date.now(),
      items: items.map((it: any) => ({
        ts: it.ts,
        title: it.title,
        source: it.source,
        url: it.url,
        summary: it.summary,
        sentimentScore: it.sentimentScore,
        impactScore: it.impactScore,
        keywords: it.keywords,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
