import { connectToDatabase } from '@/database/mongoose';
import NewsItem from '@/database/models/NewsItem';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';
import { normalizeSymbol } from '@/lib/ashare/symbol';

import type { NewsProvider, NewsSignal } from './types';

const DEFAULT_WINDOW_MINUTES = 120;
const DEFAULT_DECAY_LAMBDA = 0.02;
const STALE_MS = 4 * 60 * 60 * 1000;

export type NewsSignalWithSource = NewsSignal & {
  sourceType: 'items_rolling' | 'snapshot' | 'none';
  explain?: { topTitles: string[]; n: number; avgImpact: number };
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export class NewsFromItemsProvider implements NewsProvider {
  async getNewsSignal(args: { symbol: string }): Promise<NewsSignalWithSource | null> {
    const symbol = normalizeSymbol(args.symbol);
    try {
      await connectToDatabase();
      const windowMinutes = Number(process.env.NEWS_ROLLING_WINDOW_MINUTES ?? DEFAULT_WINDOW_MINUTES);
      const decayLambda = Number(process.env.NEWS_DECAY_LAMBDA ?? DEFAULT_DECAY_LAMBDA);
      const effectiveWindowMinutes = Number.isFinite(windowMinutes) ? windowMinutes : DEFAULT_WINDOW_MINUTES;
      const effectiveLambda = Number.isFinite(decayLambda) ? decayLambda : DEFAULT_DECAY_LAMBDA;
      const windowMs = effectiveWindowMinutes * 60 * 1000;

      const now = Date.now();
      const items = await NewsItem.find({ symbol, publishedAt: { $gte: now - windowMs } })
        .sort({ publishedAt: -1 })
        .limit(200)
        .lean();

      const mockCount = items.filter((it: any) => it.isMock === true).length;
      const mockRatio = items.length ? mockCount / items.length : 0;

      if (!items.length) return null;
      const latestTs = Math.max(...items.map((it: any) => it.publishedAt || 0));
      if (now - latestTs > windowMs) return null;

      let weightSum = 0;
      let weightedScore = 0;
      let weightedConfidence = 0;
      let count = 0;

      const scoredItems = items.filter((it: any) => Number.isFinite(it.sentimentScore));
      for (const it of scoredItems) {
        const ts = Number(it.publishedAt);
        if (!Number.isFinite(ts)) continue;
        const ageMinutes = Math.max(0, (now - ts) / 60000);
        const weight = Math.exp(-effectiveLambda * ageMinutes);
        weightSum += weight;
        weightedScore += Number(it.sentimentScore) * weight;
        if (Number.isFinite(it.confidence)) {
          weightedConfidence += Number(it.confidence) * weight;
        }
        count += 1;
      }

      if (count > 0 && weightSum > 0) {
        const score = Math.max(-1, Math.min(1, weightedScore / weightSum));
        const confidence = clamp01(weightedConfidence / weightSum);
        const topTitles = scoredItems
          .slice()
          .sort((a: any, b: any) => Math.abs(Number(b.sentimentScore)) - Math.abs(Number(a.sentimentScore)))
          .slice(0, 3)
          .map((it: any) => String(it.title || '').trim())
          .filter(Boolean);
        const sources = Array.from(new Set(scoredItems.map((it: any) => it.source).filter(Boolean))) as string[];

        return {
          score,
          confidence,
          ts: latestTs,
          sources,
          sourceType: 'items_rolling',
          explain: { topTitles, n: count, avgImpact: confidence },
          mockRatio,
        };
      }

      const snap =
        ((await NewsSentimentSnapshot.findOne({ symbol }).sort({ ts: -1 }).lean()) as any) ||
        ((await NewsSentimentSnapshot.findOne({ symbol: 'GLOBAL' }).sort({ ts: -1 }).lean()) as any);
      if (!snap) return null;
      if (!(snap.confidence > 0) || !Number.isFinite(snap.score) || snap.score === 0) return null;
      if (Date.now() - snap.ts > STALE_MS) return null;
      return {
        score: snap.score,
        confidence: snap.confidence,
        ts: snap.ts,
        sources: snap.sources,
        sourceType: 'snapshot',
        mockRatio,
      };
    } catch {
      return null;
    }
  }
}
