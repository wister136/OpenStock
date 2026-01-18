import { connectToDatabase } from '@/database/mongoose';
import NewsSentimentSnapshot from '@/database/models/NewsSentimentSnapshot';

import type { NewsProvider, NewsSignal } from './types';

const CACHE_TTL_MS = 5 * 60 * 1000;

const NEGATIVE_KEYWORDS = ['crash', 'panic', 'default', 'lawsuit', 'fraud', 'halt', 'sanction', 'loss', 'down', 'bear'];
const POSITIVE_KEYWORDS = ['beat', 'growth', 'upgrade', 'surge', 'profit', 'strong', 'rally', 'bull', 'record'];

function simpleSentimentScore(texts: string[]): { score: number; keywords: string[] } {
  let score = 0;
  const matched: string[] = [];
  for (const t of texts) {
    const text = t.toLowerCase();
    for (const kw of NEGATIVE_KEYWORDS) {
      if (text.includes(kw)) {
        score -= 1;
        matched.push(kw);
      }
    }
    for (const kw of POSITIVE_KEYWORDS) {
      if (text.includes(kw)) {
        score += 1;
        matched.push(kw);
      }
    }
  }
  if (texts.length === 0) return { score: 0, keywords: [] };
  const normalized = Math.max(-1, Math.min(1, score / Math.max(3, texts.length)));
  return { score: normalized, keywords: matched.slice(0, 6) };
}

export class ExternalNewsProvider implements NewsProvider {
  async getNewsSignal(args: { symbol: string }): Promise<NewsSignal | null> {
    const endpoint = process.env.NEWS_ENDPOINT;
    const apiKey = process.env.NEWS_API_KEY;
    const timeoutMs = Number(process.env.NEWS_TIMEOUT_MS ?? 2500);
    if (!endpoint) return null;

    try {
      await connectToDatabase();
      const cached = await NewsSentimentSnapshot.findOne({ symbol: args.symbol }).sort({ ts: -1 }).lean();
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return { score: cached.score, confidence: cached.confidence, ts: cached.ts, sources: cached.sources };
      }

      const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}symbol=${encodeURIComponent(args.symbol)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 2500);
      const res = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        cache: 'no-store',
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (!res || !res.ok) return null;
      const json = await res.json();

      const items: Array<{ title?: string; summary?: string; source?: string }> =
        Array.isArray(json?.items) ? json.items : Array.isArray(json?.data) ? json.data : [];

      const texts = items.map((it) => `${it.title ?? ''} ${it.summary ?? ''}`.trim()).filter(Boolean);
      const sources = items.map((it) => it.source).filter(Boolean) as string[];

      const { score, keywords } = simpleSentimentScore(texts);
      const confidence = Math.min(1, texts.length / 10);
      const ts = Date.now();

      await NewsSentimentSnapshot.create({
        symbol: args.symbol,
        ts,
        score,
        confidence,
        sources: sources.length ? sources : ['external'],
        topKeywords: keywords.length ? keywords : undefined,
        rawCount: texts.length,
      });

      return { score, confidence, ts, sources: sources.length ? sources : ['external'] };
    } catch {
      return null;
    }
  }
}
