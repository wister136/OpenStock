import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsItem from '@/database/models/NewsItem';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '2000', 10) || 2000, 1), 5000);

  try {
    await connectToDatabase();
    const docs = await NewsItem.aggregate([
      { $sort: { publishedAt: -1 } },
      {
        $group: {
          _id: {
            source_name: '$source',
            provider: '$provider',
            url_host: '$url_host',
          },
          count: { $sum: 1 },
          example_title: { $first: '$title' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    const sources = docs.map((doc: any) => ({
      source_name: doc?._id?.source_name || '',
      provider: doc?._id?.provider || '',
      url_host: doc?._id?.url_host || '',
      count: Number(doc?.count ?? 0),
      example_title: doc?.example_title || '',
    }));

    return NextResponse.json({ ok: true, sources });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
