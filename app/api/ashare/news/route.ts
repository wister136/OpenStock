import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsItem from '@/database/models/NewsItem';
import { normalizeSymbol } from '@/lib/ashare/symbol';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol') ?? 'GLOBAL') || 'GLOBAL';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '30', 10) || 30, 1), 100);

  try {
    await connectToDatabase();
    const items = await NewsItem.find({ symbol }).sort({ publishedAt: -1 }).limit(limit).lean();
    return NextResponse.json({
      ok: true,
      symbol,
      serverTime: Date.now(),
      items: items.map((it: any) => ({
        publishedAt: it.publishedAt,
        title: it.title,
        source: it.source,
        url: it.url,
        sentimentScore: it.sentimentScore,
        confidence: it.confidence,
        isMock: it.isMock === true,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
