import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsItem from '@/database/models/NewsItem';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '6', 10) || 6, 1), 50);

  try {
    await connectToDatabase();
    const items = await NewsItem.find({ isMock: { $ne: true } }).sort({ publishedAt: -1 }).limit(limit).lean();
    return NextResponse.json({
      ok: true,
      items: items.map((it: any) => ({
        id: String(it._id),
        title: it.title,
        title_zh: it.title_zh,
        source_name: it.source,
        url_host: it.url_host,
        provider: it.provider,
        url: it.url,
        published_at: it.publishedAt,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
