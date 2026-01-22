import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import AshareBar, { type AshareBarFreq } from '@/database/models/ashareBar.model';
import EventStream, { type MarketTimeframe, type MarketTrigger } from '@/database/models/EventStream';
import NewsItem from '@/database/models/NewsItem';
import { ema } from '@/lib/ashare/indicators';
import { normalizeSymbol } from '@/lib/ashare/symbol';
import { sha1 } from '@/lib/hash';

type EventCardDTO = {
  id: string;
  type: 'news' | 'market' | 'system';
  ts: number;
  source: string;
  isMock: boolean;
  title: string;
  title_zh?: string;
  subtitle?: string;
  sentimentScore?: number;
  confidence?: number;
  l2Reason?: string;
  url?: string;
  trigger?: MarketTrigger;
  timeframe?: MarketTimeframe;
  changePct?: number;
  volRatio?: number;
  level?: 'info' | 'warn' | 'error';
};

const MARKET_TIMEFRAMES: MarketTimeframe[] = ['1m', '5m'];
const MARKET_EVENT_CACHE_MS = 15_000;
const marketEventCache = new Map<string, number>();

function toEpochMs(input: unknown): number | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input.getTime() : null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return input > 1e12 ? input : Math.floor(input * 1000);
  }
  if (typeof input === 'string') {
    const parsed = Date.parse(input);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatPct(value?: number): string {
  if (!Number.isFinite(value)) return '--';
  return `${(value! * 100).toFixed(2)}%`;
}

function buildMarketTitle(event: any): string {
  const tf = event.timeframe ? `${event.timeframe}` : 'market';
  const trigger = String(event.trigger ?? 'update').replace('_', ' ');
  const change = Number.isFinite(event.changePct) ? ` ${formatPct(event.changePct)}` : '';
  return `${tf} ${trigger}${change}`.trim();
}

function buildMarketSubtitle(event: any): string | undefined {
  const parts: string[] = [];
  if (Number.isFinite(event.price)) parts.push(`price ${Number(event.price).toFixed(2)}`);
  if (Number.isFinite(event.volRatio)) parts.push(`vol ${Number(event.volRatio).toFixed(2)}x`);
  if (event.detail?.ema20 != null && Number.isFinite(event.detail.ema20)) parts.push(`ema20 ${Number(event.detail.ema20).toFixed(2)}`);
  if (event.detail?.prevHigh != null && Number.isFinite(event.detail.prevHigh)) parts.push(`prevH ${Number(event.detail.prevHigh).toFixed(2)}`);
  if (event.detail?.prevLow != null && Number.isFinite(event.detail.prevLow)) parts.push(`prevL ${Number(event.detail.prevLow).toFixed(2)}`);
  return parts.length ? parts.join(' · ') : undefined;
}

function buildNewsSubtitle(event: any): string | undefined {
  const parts: string[] = [];
  if (event.summary) parts.push(String(event.summary));
  const tags = [event.eventType, ...(Array.isArray(event.entities) ? event.entities.slice(0, 3) : [])].filter(Boolean);
  if (!parts.length && tags.length) parts.push(tags.join(' / '));
  return parts.length ? parts.join(' · ') : undefined;
}

async function upsertNewsEvents(symbol: string, limit: number): Promise<void> {
  const items = await NewsItem.find({ symbol }).sort({ publishedAt: -1 }).limit(limit).lean();
  if (!items.length) return;

  const ops = items.map((item: any) => {
    const fingerprint = item.fingerprint || sha1(`${item.source}|${item.symbol}|${item.title}|${item.publishedAt}`);
    const eventFingerprint = sha1(`news|${fingerprint}`);
    return {
      updateOne: {
        filter: { fingerprint: eventFingerprint },
        update: {
          $setOnInsert: {
            type: 'news',
            symbol: item.symbol,
            ts: item.publishedAt,
            source: item.source,
            isMock: item.isMock === true,
            sentimentScore: item.sentimentScore,
            confidence: item.confidence,
            score: item.impactScore,
            title: item.title,
            title_en: item.title_en,
            title_zh: item.title_zh,
            publishedAt: item.publishedAt,
            summary: item.summary,
            eventType: item.eventType,
            entities: item.entities,
            url: item.url,
            l2Reason: item.l2Reason,
            fingerprint: eventFingerprint,
          },
        },
        upsert: true,
      },
    };
  });

  try {
    await EventStream.bulkWrite(ops, { ordered: false });
  } catch {
    // Ignore duplicate races.
  }
}

async function upsertMarketEvents(symbol: string): Promise<void> {
  const now = Date.now();
  const last = marketEventCache.get(symbol);
  if (last && now - last < MARKET_EVENT_CACHE_MS) return;
  marketEventCache.set(symbol, now);

  const lookbackRaw = Number(process.env.MARKET_EVENT_LOOKBACK ?? 20);
  const lookback = Number.isFinite(lookbackRaw) && lookbackRaw >= 5 ? Math.min(60, lookbackRaw) : 20;
  const volRatioThresholdRaw = Number(process.env.MARKET_EVENT_VOL_RATIO ?? 2.2);
  const moveThresholdRaw = Number(process.env.MARKET_EVENT_MOVE_PCT ?? 0.006);
  const gapThresholdRaw = Number(process.env.MARKET_EVENT_GAP_PCT ?? 0.008);
  const limitThresholdRaw = Number(process.env.MARKET_EVENT_LIMIT_PCT ?? 0.095);
  const volRatioThreshold = Number.isFinite(volRatioThresholdRaw) ? volRatioThresholdRaw : 2.2;
  const moveThreshold = Number.isFinite(moveThresholdRaw) ? moveThresholdRaw : 0.006;
  const gapThreshold = Number.isFinite(gapThresholdRaw) ? gapThresholdRaw : 0.008;
  const limitThreshold = Number.isFinite(limitThresholdRaw) ? limitThresholdRaw : 0.095;

  for (const timeframe of MARKET_TIMEFRAMES) {
    const bars = await AshareBar.find({ symbol, freq: timeframe as AshareBarFreq })
      .sort({ ts: -1 })
      .limit(lookback + 1)
      .lean();
    if (bars.length < 2) continue;

    const sorted = bars.reverse();
    const latest = sorted[sorted.length - 1] as any;
    const prev = sorted[sorted.length - 2] as any;
    const window = sorted.slice(Math.max(0, sorted.length - 1 - lookback), sorted.length - 1);

    const latestTs = toEpochMs(latest.ts);
    if (!latestTs) continue;

    const prevClose = Number(prev.close);
    const close = Number(latest.close);
    const open = Number(latest.open);
    const changePct = Number.isFinite(prevClose) && prevClose !== 0 ? (close - prevClose) / prevClose : undefined;

    const hasWindow = window.length > 0;
    const prevHigh = hasWindow ? window.reduce((max, b: any) => Math.max(max, Number(b.high || -Infinity)), -Infinity) : NaN;
    const prevLow = hasWindow ? window.reduce((min, b: any) => Math.min(min, Number(b.low || Infinity)), Infinity) : NaN;
    const avgVol = window.reduce((sum, b: any) => sum + Number(b.volume || 0), 0) / Math.max(1, window.length);
    const volRatio = avgVol > 0 ? Number(latest.volume || 0) / avgVol : undefined;

    const isLimitUp = Number.isFinite(changePct) && (changePct as number) >= limitThreshold;
    const isLimitDown = Number.isFinite(changePct) && (changePct as number) <= -limitThreshold;
    const isGap = Number.isFinite(prevClose) && prevClose !== 0 ? Math.abs(open - prevClose) / prevClose >= gapThreshold : false;
    const isBreakout = Number.isFinite(prevHigh) && close > prevHigh;
    const isBreakdown = Number.isFinite(prevLow) && close < prevLow;
    const isVolSpike = Number.isFinite(volRatio) && (volRatio as number) >= volRatioThreshold;

    let trigger: MarketTrigger | null = null;
    if (isLimitUp) trigger = 'limit_up';
    else if (isLimitDown) trigger = 'limit_down';
    else if (isGap) trigger = 'gap';
    else if (isBreakout) trigger = 'breakout';
    else if (isBreakdown) trigger = 'breakdown';
    else if (isVolSpike) trigger = 'volume_spike';
    else if (Number.isFinite(changePct) && Math.abs(changePct as number) >= moveThreshold) {
      trigger = (changePct as number) >= 0 ? 'breakout' : 'breakdown';
    }

    if (!trigger) continue;

    const closes = window.map((b: any) => Number(b.close || NaN)).filter((v: number) => Number.isFinite(v));
    const ema20Arr = closes.length >= 5 ? ema(closes, 20) : [];
    const ema20 = ema20Arr.length ? ema20Arr[ema20Arr.length - 1] : undefined;

    const detail = {
      prevHigh: Number.isFinite(prevHigh) ? prevHigh : undefined,
      prevLow: Number.isFinite(prevLow) ? prevLow : undefined,
      avgVol: Number.isFinite(avgVol) ? avgVol : undefined,
      ema20: Number.isFinite(ema20) ? ema20 : undefined,
    };

    const eventFingerprint = sha1(`market|${symbol}|${timeframe}|${latestTs}|${trigger}`);
    await EventStream.updateOne(
      { fingerprint: eventFingerprint },
      {
        $setOnInsert: {
          type: 'market',
          symbol,
          ts: latestTs,
          source: `bars:${timeframe}`,
          timeframe,
          trigger,
          price: close,
          changePct,
          volRatio,
          detail,
          fingerprint: eventFingerprint,
        },
      },
      { upsert: true }
    );
  }
}

function toEventCard(event: any): EventCardDTO {
  const base: EventCardDTO = {
    id: String(event._id ?? event.fingerprint ?? `${event.type}-${event.ts}`),
    type: event.type,
    ts: event.ts,
    source: event.source,
    isMock: event.isMock === true,
    sentimentScore: event.sentimentScore,
    confidence: event.confidence,
    l2Reason: event.l2Reason,
  };

  if (event.type === 'news') {
    const title = event.title || event.title_en || 'News';
    return { ...base, title, title_zh: event.title_zh, subtitle: buildNewsSubtitle(event), url: event.url };
  }
  if (event.type === 'market') {
    return {
      ...base,
      title: buildMarketTitle(event),
      subtitle: buildMarketSubtitle(event),
      trigger: event.trigger,
      timeframe: event.timeframe,
      changePct: event.changePct,
      volRatio: event.volRatio,
    };
  }
  const title = event.message || event.title || 'System';
  return { ...base, title, level: event.level };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol') ?? 'GLOBAL') || 'GLOBAL';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100);
  const serverTime = Date.now();

  try {
    await connectToDatabase();

    await upsertNewsEvents(symbol, limit * 2);
    await upsertMarketEvents(symbol);

    let newsEvents = await EventStream.find({ symbol, type: 'news' }).sort({ ts: -1 }).limit(limit * 2).lean();
    if (!newsEvents.length && symbol !== 'GLOBAL') {
      await upsertNewsEvents('GLOBAL', limit * 2);
      newsEvents = await EventStream.find({ symbol: 'GLOBAL', type: 'news' }).sort({ ts: -1 }).limit(limit * 2).lean();
    }
    const marketEvents = await EventStream.find({ symbol, type: 'market' }).sort({ ts: -1 }).limit(limit * 2).lean();
    const systemEvents = await EventStream.find({ symbol, type: 'system' }).sort({ ts: -1 }).limit(5).lean();

    const merged = [...newsEvents, ...marketEvents, ...systemEvents]
      .sort((a: any, b: any) => Number(b.ts || 0) - Number(a.ts || 0))
      .slice(0, limit);

    const latestTs = merged[0]?.ts ? Number(merged[0].ts) : 0;
    const heartbeatDue = !latestTs || serverTime - latestTs > 30 * 60 * 1000;
    if (heartbeatDue) {
      const bucket = Math.floor(serverTime / (30 * 60 * 1000));
      const eventFingerprint = sha1(`system|${symbol}|${bucket}`);
      await EventStream.updateOne(
        { fingerprint: eventFingerprint },
        {
          $setOnInsert: {
            type: 'system',
            symbol,
            ts: serverTime,
            source: 'system',
            level: 'info',
            message: 'Event stream running. Waiting for new data.',
            fingerprint: eventFingerprint,
          },
        },
        { upsert: true }
      );
      if (!merged.find((it: any) => it.fingerprint === eventFingerprint)) {
        merged.unshift({
          type: 'system',
          symbol,
          ts: serverTime,
          source: 'system',
          level: 'info',
          message: 'Event stream running. Waiting for new data.',
          fingerprint: eventFingerprint,
        });
        if (merged.length > limit) merged.length = limit;
      }
    }

    return NextResponse.json({
      ok: true,
      symbol,
      serverTime,
      items: merged.map(toEventCard),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
