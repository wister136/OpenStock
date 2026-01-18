import { connectToDatabase } from '@/database/mongoose';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';

import type { NewsProvider, NewsSignal } from './types';

export type MockNewsProviderOptions = {
  score?: number;
  confidence?: number;
  sources?: string[];
  ts?: number;
};

function readEnvNumber(key: string): number | undefined {
  const raw = process.env[key];
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export class MockNewsProvider implements NewsProvider {
  private options: MockNewsProviderOptions;

  constructor(options: MockNewsProviderOptions = {}) {
    this.options = options;
  }

  async getNewsSignal(args: { symbol: string }): Promise<NewsSignal | null> {
    const envScore = readEnvNumber('MOCK_NEWS_SCORE');
    const envConfidence = readEnvNumber('MOCK_NEWS_CONFIDENCE');

    const score = this.options.score ?? envScore ?? 0;
    const confidence = this.options.confidence ?? envConfidence ?? 0;
    const ts = this.options.ts ?? Date.now();
    const sources = this.options.sources ?? ['mock'];

    try {
      await connectToDatabase();
      await NewsSentimentSnapshot.create({
        symbol: args.symbol,
        ts,
        score,
        confidence,
        sources,
      });
    } catch {
      // fail-soft for mock provider
    }

    return { score, confidence, ts, sources };
  }
}
