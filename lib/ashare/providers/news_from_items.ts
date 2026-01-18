import { connectToDatabase } from '@/database/mongoose';
import NewsItem from '@/database/models/NewsItem';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';
import { computeRollingNewsSignal, type NewsItemLite } from '@/lib/ashare/news_aggregation';
import { normalizeSymbol } from '@/lib/ashare/symbol';

import type { NewsProvider, NewsSignal } from './types';

const WINDOW_MS = 2 * 60 * 60 * 1000;
const HALF_LIFE_MS = 20 * 60 * 1000;
const STALE_MS = 4 * 60 * 60 * 1000;
const MIN_CONFIDENCE = 0.25;

export type NewsSignalWithSource = NewsSignal & {
  sourceType: 'items_rolling' | 'snapshot' | 'none';
  explain?: { topTitles: string[]; n: number; avgImpact: number };
};

export class NewsFromItemsProvider implements NewsProvider {
  async getNewsSignal(args: { symbol: string }): Promise<NewsSignalWithSource | null> {
    const symbol = normalizeSymbol(args.symbol);
    try {
      await connectToDatabase();
      const items = await NewsItem.find({ symbol, ts: { $gte: Date.now() - WINDOW_MS } })
        .sort({ ts: -1 })
        .limit(100)
        .lean();

      const lite: NewsItemLite[] = items.map((it: any) => ({
        ts: it.ts,
        title: it.title,
        source: it.source,
        sentimentScore: it.sentimentScore,
        impactScore: it.impactScore,
      }));

      const rolling = computeRollingNewsSignal({ items: lite, nowMs: Date.now(), windowMs: WINDOW_MS, halfLifeMs: HALF_LIFE_MS });
      if (rolling && rolling.confidence >= MIN_CONFIDENCE) {
        return { score: rolling.score, confidence: rolling.confidence, ts: rolling.ts, sources: rolling.sources, sourceType: 'items_rolling', explain: rolling.explain };
      }

      const snap =
        (await NewsSentimentSnapshot.findOne({ symbol }).sort({ ts: -1 }).lean()) ||
        (await NewsSentimentSnapshot.findOne({ symbol: 'GLOBAL' }).sort({ ts: -1 }).lean());
      if (!snap) return null;
      if (!(snap.confidence > 0) || !Number.isFinite(snap.score) || snap.score === 0) return null;
      if (Date.now() - snap.ts > STALE_MS) return null;
      return { score: snap.score, confidence: snap.confidence, ts: snap.ts, sources: snap.sources, sourceType: 'snapshot' };
    } catch {
      return null;
    }
  }
}
