import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsItem from '@/database/models/NewsItem';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';
import { computeRollingSentiment } from '@/lib/ashare/news_aggregation';
import { buildNewsFingerprint } from '@/lib/ashare/news_fingerprint';
import { normalizeSymbol } from '@/lib/ashare/symbol';

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.NEWS_INGEST_API_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const symbol = normalizeSymbol(body?.symbol ?? 'GLOBAL') || 'GLOBAL';
  const publishedAt = Number(body?.publishedAt ?? body?.ts);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content =
    typeof body?.content === 'string'
      ? body.content.trim()
      : typeof body?.summary === 'string'
        ? body.summary.trim()
        : undefined;
  const url = typeof body?.url === 'string' ? body.url.trim() : undefined;
  const source = typeof body?.source === 'string' ? body.source.trim() : '';
  const sentimentScore = body?.sentimentScore == null ? undefined : Number(body.sentimentScore);
  const confidence = body?.confidence == null ? undefined : Number(body.confidence);
  const isMock = body?.isMock === true;

  if (!Number.isFinite(publishedAt)) {
    return NextResponse.json({ ok: false, error: 'Invalid publishedAt' }, { status: 400 });
  }
  if (!title || !source) {
    return NextResponse.json({ ok: false, error: 'Missing title/source' }, { status: 400 });
  }

  const fingerprint = buildNewsFingerprint({ url, title, publishedAt, source });
  const serverTime = Date.now();

  try {
    await connectToDatabase();
    const result = await NewsItem.updateOne(
      { fingerprint },
      {
        $setOnInsert: {
          symbol,
          publishedAt,
          title,
          content,
          url,
          source,
          fingerprint,
          sentimentScore,
          confidence,
          isMock,
        },
      },
      { upsert: true }
    );
    const inserted = result.upsertedCount > 0;

    if (inserted) {
      const windowHours = Number(process.env.NEWS_DECAY_WINDOW_HOURS ?? 2);
      const decayK = Number(process.env.NEWS_DECAY_K ?? 0.01);
      const windowMs = (Number.isFinite(windowHours) ? windowHours : 2) * 60 * 60 * 1000;
      const recent = await NewsItem.find({ symbol, publishedAt: { $gte: serverTime - windowMs } })
        .sort({ publishedAt: -1 })
        .limit(200)
        .lean();
      const rolling = computeRollingSentiment(
        recent.map((it: any) => ({
          publishedAt: it.publishedAt,
          sentimentScore: it.sentimentScore,
          confidence: it.confidence,
        })),
        serverTime,
        Number.isFinite(windowHours) ? windowHours : 2,
        Number.isFinite(decayK) ? decayK : 0.01
      );
      if (rolling) {
        const sources = Array.from(new Set(recent.map((it: any) => it.source).filter(Boolean))) as string[];
        await NewsSentimentSnapshot.updateOne(
          { symbol, ts: serverTime },
          {
            $set: {
              symbol,
              ts: serverTime,
              score: rolling.score,
              confidence: rolling.confidence,
              sources,
              rawCount: rolling.count,
            },
          },
          { upsert: true }
        );
      }
    }
    return NextResponse.json({
      ok: true,
      status: inserted ? 'inserted' : 'skipped_duplicate',
      symbol,
      serverTime,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
