import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsItem from '@/database/models/NewsItem';
import { normalizeSymbol } from '@/lib/ashare/symbol';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol') ?? 'GLOBAL') || 'GLOBAL';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100);
  const source = (searchParams.get('source') || '').trim();

  try {
    await connectToDatabase();
    const query: Record<string, any> = { symbol, isMock: { $ne: true } };
    if (source) query.source = source;

    const items = await NewsItem.find(query).sort({ publishedAt: -1 }).limit(limit).lean();
    return NextResponse.json({
      ok: true,
      symbol,
      serverTime: Date.now(),
      items: items.map((it: any) => ({
        title: it.title,
        title_en: it.title_en,
        source: it.source,
        url: it.url,
        publishedAt: it.publishedAt,
        sentimentScore: it.sentimentScore,
        confidence: it.confidence,
        isMock: it.isMock === true,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
