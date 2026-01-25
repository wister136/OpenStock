import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import EventStream from '@/database/models/EventStream';
import NewsItem from '@/database/models/NewsItem';
import { analyzeNewsItem, syncNewsAnalysisToStorage } from '@/lib/ashare/news_analysis';
import { scoreNewsImpact } from '@/lib/ashare/news_scoring';
import NewsCursor from '@/database/models/NewsCursor';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';
import { computeRollingSentiment } from '@/lib/ashare/news_aggregation';
import { normalizeSymbol } from '@/lib/ashare/symbol';
import { sha1 } from '@/lib/hash';
import { classifyNewsRegion, normalizeNewsSource } from '@/lib/newsRegion';
import { translateTitle, translateTitleToZh } from '@/lib/translateTitle';

function normalizeImpactScore(value: unknown): number | undefined {
  if (value == null) return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  if (num >= 0 && num <= 1) return num;
  if (num > 1 && num <= 100) return Math.min(1, num / 100);
  return undefined;
}

function normalizeStringArray(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const cleaned = input
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  if (!cleaned.length) return undefined;
  return Array.from(new Set(cleaned)).slice(0, 12);
}

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
  const provider = typeof body?.provider === 'string' ? body.provider.trim() : '';
  const sentimentScore = body?.score == null ? (body?.sentimentScore == null ? undefined : Number(body.sentimentScore)) : Number(body.score);
  const confidence = body?.confidence == null ? undefined : Number(body.confidence);
  const impactScoreInput = normalizeImpactScore(body?.impactScore);
  const summaryRaw = typeof body?.summary === 'string' ? body.summary.trim() : undefined;
  const summary =
    summaryRaw ||
    (content
      ? content.length > 160
        ? `${content.slice(0, 157)}...`
        : content
      : undefined);
  const eventTypeInput = typeof body?.eventType === 'string' ? body.eventType.trim() : undefined;
  const entities = normalizeStringArray(body?.entities);
  const tagsInput = normalizeStringArray(body?.tags);
  const isMock = body?.isMock === true;

  if (!Number.isFinite(publishedAt)) {
    return NextResponse.json({ ok: false, error: 'Invalid publishedAt' }, { status: 400 });
  }
  if (!title || !source || !content) {
    return NextResponse.json({ ok: false, error: 'Missing title/source/content' }, { status: 400 });
  }
  if (impactScoreInput != null && (impactScoreInput < 0 || impactScoreInput > 1)) {
    return NextResponse.json({ ok: false, error: 'Invalid impactScore' }, { status: 400 });
  }

  const fingerprint = sha1(`${source}|${symbol}|${title}|${publishedAt}`);
  const serverTime = Date.now();

  try {
    await connectToDatabase();
    const existing = await NewsItem.findOne({ fingerprint }).select('_id').lean();
    if (existing) {
      return NextResponse.json({ ok: true, status: 'skipped', reason: 'duplicate', symbol, serverTime });
    }
    const normalized = normalizeNewsSource({ source_name: source, provider, url, title, feedName: body?.feedName, feedId: body?.feedId });
    const regionResult = classifyNewsRegion(normalized);
    const title_en = await translateTitle(title);
    const title_zh = await translateTitleToZh(title);
    const marketLinkWindowRaw = Number(process.env.NEWS_MARKET_LINK_WINDOW_MINUTES ?? 30);
    const marketLinkWindow = Number.isFinite(marketLinkWindowRaw) ? marketLinkWindowRaw : 30;
    const marketLinked =
      (await EventStream.exists({
        symbol,
        type: 'market',
        ts: { $gte: publishedAt - marketLinkWindow * 60 * 1000, $lte: publishedAt + marketLinkWindow * 60 * 1000 },
      })) != null;
    const level1 = scoreNewsImpact({
      symbol,
      title,
      source,
      publishedAt,
      content,
      marketLinked,
    });
    const impactScore = impactScoreInput ?? level1.impactScore;
    const eventType = eventTypeInput ?? level1.eventType;
    const tags = tagsInput ?? level1.tags;
    const result = await NewsItem.updateOne(
      { fingerprint },
      {
        $setOnInsert: {
          symbol,
          publishedAt,
          title,
          title_en,
          title_zh,
          provider: normalized.provider,
          url_host: normalized.url_host,
          region: regionResult.region,
          region_reason: regionResult.reason,
          region_confidence: regionResult.confidence,
          region_updated_at: Date.now(),
          content,
          summary,
          eventType,
          entities,
          tags,
          url,
          source,
          fingerprint,
          sentimentScore,
          confidence,
          impactScore,
          isMock,
        },
      },
      { upsert: true }
    );
    const inserted = result.upsertedCount > 0;

    const eventFingerprint = sha1(`news|${fingerprint}`);
    await EventStream.updateOne(
      { fingerprint: eventFingerprint },
      {
        $setOnInsert: {
          type: 'news',
          symbol,
          ts: publishedAt,
          source,
          isMock,
          sentimentScore,
          confidence,
          score: impactScore,
          title,
          title_en,
          title_zh,
          region: regionResult.region,
          region_reason: regionResult.reason,
          region_confidence: regionResult.confidence,
          publishedAt,
          summary,
          eventType,
          entities,
          url,
          fingerprint: eventFingerprint,
        },
      },
      { upsert: true }
    );

    await NewsCursor.updateOne(
      { source, symbol },
      { $max: { lastTs: publishedAt }, $setOnInsert: { source, symbol } },
      { upsert: true }
    );

    if (inserted) {
      try {
        const analysis = await analyzeNewsItem({
          symbol,
          title,
          source,
          publishedAt,
          content,
          impactScore,
          summary,
          eventType,
          entities,
          tags,
          marketLinked,
        });
        await syncNewsAnalysisToStorage({ fingerprint, analysis });
      } catch (error: any) {
        console.warn('[news] analysis failed', String(error?.message ?? error));
      }

      const windowMinutesRaw = Number(process.env.NEWS_ROLLING_WINDOW_MINUTES);
      const windowHoursRaw = Number(process.env.NEWS_DECAY_WINDOW_HOURS);
      const windowMinutes = Number.isFinite(windowMinutesRaw)
        ? windowMinutesRaw
        : Number.isFinite(windowHoursRaw)
          ? windowHoursRaw * 60
          : 120;
      const decayLambdaRaw = Number(process.env.NEWS_DECAY_LAMBDA);
      const decayKRaw = Number(process.env.NEWS_DECAY_K);
      const decayLambda = Number.isFinite(decayLambdaRaw)
        ? decayLambdaRaw
        : Number.isFinite(decayKRaw)
          ? decayKRaw
          : 0.01;
      const windowMs = windowMinutes * 60 * 1000;
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
        windowMinutes / 60,
        decayLambda
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
