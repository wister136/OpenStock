import { connectToDatabase } from '@/database/mongoose';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';
import { normalizeSymbol } from '@/lib/ashare/symbol';

import type { NewsProvider, NewsSignal } from './types';

const STALE_MS = 4 * 60 * 60 * 1000;

export class DbNewsProvider implements NewsProvider {
  async getNewsSignal(args: { symbol: string }): Promise<NewsSignal | null> {
    try {
      await connectToDatabase();
      const symbol = normalizeSymbol(args.symbol);
      const latest =
        (await NewsSentimentSnapshot.findOne({ symbol }).sort({ ts: -1 }).lean()) ||
        (await NewsSentimentSnapshot.findOne({ symbol: 'GLOBAL' }).sort({ ts: -1 }).lean());

      if (!latest) return null;
      if (Date.now() - latest.ts > STALE_MS) return null;
      if (!(latest.confidence > 0)) return null;
      if (!Number.isFinite(latest.score) || latest.score === 0) return null;
      return { score: latest.score, confidence: latest.confidence, ts: latest.ts, sources: latest.sources };
    } catch {
      return null;
    }
  }
}
