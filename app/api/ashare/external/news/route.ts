import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsItem from '@/database/models/NewsItem';
import NewsCursor from '@/database/models/NewsCursor';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';
import { computeRollingSentiment } from '@/lib/ashare/news_aggregation';
import { normalizeSymbol } from '@/lib/ashare/symbol';
import { sha1 } from '@/lib/hash';

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.NEWS_INGEST_API_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const symbol = normalizeSymbol(body?.symbol ?? 'GLOBAL') || 'GLOBAL';
  const publishedAt = Number(body?.ts ?? body?.publishedAt);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content =
    typeof body?.content === 'string'
      ? body.content.trim()
      : typeof body?.contentSnippet === 'string'
        ? body.contentSnippet.trim()
      : typeof body?.summary === 'string'
        ? body.summary.trim()
        : undefined;
  const url = typeof body?.url === 'string' ? body.url.trim() : undefined;
  const source = typeof body?.source === 'string' ? body.source.trim() : '';
  const sentimentScore = body?.score == null ? (body?.sentimentScore == null ? undefined : Number(body.sentimentScore)) : Number(body.score);
  const confidence = body?.confidence == null ? undefined : Number(body.confidence);
  const isMock = body?.isMock === true;

  if (!Number.isFinite(publishedAt)) {
    return NextResponse.json({ ok: false, error: 'Invalid publishedAt' }, { status: 400 });
  }
  if (!title || !source || !content) {
    return NextResponse.json({ ok: false, error: 'Missing title/source/content' }, { status: 400 });
  }

  const fingerprint = sha1(`${source}|${symbol}|${title}|${publishedAt}`);
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

    await NewsCursor.updateOne(
      { source, symbol },
      { $max: { lastTs: publishedAt }, $setOnInsert: { source, symbol } },
      { upsert: true }
    );

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
    if (!inserted) {
      return NextResponse.json({ ok: true, status: 'skipped', reason: 'duplicate', symbol, serverTime });
    }
    return NextResponse.json({ ok: true, status: 'inserted', symbol, serverTime });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
