import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import EventStream from '@/database/models/EventStream';
import NewsItem from '@/database/models/NewsItem';
import { buildNewsFingerprint } from '@/lib/ashare/news_fingerprint';
import { analyzeNewsItem, syncNewsAnalysisToStorage } from '@/lib/ashare/news_analysis';
import { scoreNewsImpact } from '@/lib/ashare/news_scoring';
import { normalizeSymbol } from '@/lib/ashare/symbol';
import { sha1 } from '@/lib/hash';
import { translateTitle } from '@/lib/translateTitle';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

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
  const body = await req.json();
  const symbol = normalizeSymbol(body?.symbol ?? 'GLOBAL') || 'GLOBAL';
  const publishedAt = Number(body?.publishedAt ?? body?.ts ?? Date.now());
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content =
    typeof body?.content === 'string'
      ? body.content.trim()
      : typeof body?.summary === 'string'
      ? body.summary.trim()
      : typeof body?.contentSnippet === 'string'
          ? body.contentSnippet.trim()
          : undefined;
  const url = typeof body?.url === 'string' ? body.url.trim() : undefined;
  const source = typeof body?.source === 'string' ? body.source.trim() : '';
  const sentimentScore = body?.sentimentScore == null ? undefined : Number(body.sentimentScore);
  const confidenceRaw = body?.confidence == null ? body?.impactScore : body?.confidence;
  const confidence = confidenceRaw == null ? undefined : Number(confidenceRaw);
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

  if (!title || !source) {
    return NextResponse.json({ ok: false, error: 'Missing title/source' }, { status: 400 });
  }
  if (!Number.isFinite(publishedAt) || String(publishedAt).length < 12) {
    return NextResponse.json({ ok: false, error: 'Invalid publishedAt' }, { status: 400 });
  }
  if (sentimentScore != null && (!Number.isFinite(sentimentScore) || sentimentScore < -1 || sentimentScore > 1)) {
    return NextResponse.json({ ok: false, error: 'Invalid sentimentScore' }, { status: 400 });
  }
  if (confidence != null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    return NextResponse.json({ ok: false, error: 'Invalid confidence' }, { status: 400 });
  }
  if (body?.impactScore != null && impactScoreInput == null) {
    return NextResponse.json({ ok: false, error: 'Invalid impactScore' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const title_en = await translateTitle(title);
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
    const fingerprint = buildNewsFingerprint({ url, title, publishedAt, source });
    const saved = await NewsItem.create({
      symbol,
      publishedAt,
      title,
      title_en,
      content,
      summary,
      eventType,
      entities,
      tags,
      url,
      source,
      fingerprint,
      sentimentScore,
      confidence: isFiniteNumber(confidence) ? confidence : undefined,
      impactScore,
      isMock,
    });

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
          confidence: saved.confidence,
          score: impactScore,
          title,
          title_en,
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
      console.warn('[news_item] analysis failed', String(error?.message ?? error));
    }

    return NextResponse.json({
      ok: true,
      saved: {
        symbol: saved.symbol,
        publishedAt: saved.publishedAt,
        title: saved.title,
        source: saved.source,
        sentimentScore: saved.sentimentScore,
        confidence: saved.confidence,
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
    const items = await NewsItem.find({ symbol }).sort({ publishedAt: -1 }).limit(limit).lean();
    return NextResponse.json({
      ok: true,
      symbol,
      serverTime: Date.now(),
      items: items.map((it: any) => ({
        publishedAt: it.publishedAt,
        title: it.title,
        title_en: it.title_en,
        source: it.source,
        url: it.url,
        content: it.content,
        sentimentScore: it.sentimentScore,
        confidence: it.confidence,
        impactScore: it.impactScore,
        summary: it.summary,
        eventType: it.eventType,
        entities: it.entities,
        tags: it.tags,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
