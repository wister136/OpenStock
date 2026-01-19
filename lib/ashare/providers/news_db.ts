import { connectToDatabase } from '@/database/mongoose';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';
import { normalizeSymbol } from '@/lib/ashare/symbol';

import type { NewsProvider, NewsSignal } from './types';

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

export class DbNewsProvider implements NewsProvider {
  async getNewsSignal(args: { symbol: string }): Promise<NewsSignal | null> {
    try {
      await connectToDatabase();
      const symbol = normalizeSymbol(args.symbol);
      const latest =
        ((await NewsSentimentSnapshot.findOne({ symbol }).sort({ ts: -1 }).lean()) as any) ||
        ((await NewsSentimentSnapshot.findOne({ symbol: 'GLOBAL' }).sort({ ts: -1 }).lean()) as any);

      if (!latest) return null;
      const ttlMs = Number(process.env.NEWS_TTL_MS ?? DEFAULT_TTL_MS);
      const ttl = Number.isFinite(ttlMs) ? ttlMs : DEFAULT_TTL_MS;
      if (Date.now() - latest.ts > ttl) return null;
      if (!(latest.confidence > 0)) return null;
      if (!Number.isFinite(latest.score) || latest.score === 0) return null;
      return {
        score: latest.score,
        confidence: latest.confidence,
        ts: latest.ts,
        sources: latest.sources,
        sourceType: 'snapshot',
      };
    } catch {
      return null;
    }
  }
}
