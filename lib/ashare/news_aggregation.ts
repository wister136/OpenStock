export type NewsItemLite = {
  ts: number;
  title: string;
  source?: string;
  sentimentScore?: number;
  impactScore?: number;
};

type RollingExplain = { topTitles: string[]; n: number; avgImpact: number };

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export type NewsItemSentimentLite = {
  publishedAt: number;
  sentimentScore?: number;
  confidence?: number;
};

export function computeRollingSentiment(
  items: NewsItemSentimentLite[],
  nowMs: number,
  windowHours: number,
  decayK: number
): { score: number; confidence: number; count: number } | null {
  const windowMs = Math.max(0, windowHours) * 60 * 60 * 1000;
  const cutoff = nowMs - windowMs;
  let weightedScore = 0;
  let weightedConfidence = 0;
  let weightSum = 0;
  let count = 0;

  for (const item of items) {
    const ts = item.publishedAt;
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    const score = item.sentimentScore;
    if (!Number.isFinite(score)) continue;
    const ageMinutes = Math.max(0, (nowMs - ts) / 60000);
    const weight = Math.exp(-decayK * ageMinutes);
    weightSum += weight;
    weightedScore += (score as number) * weight;
    if (Number.isFinite(item.confidence)) {
      weightedConfidence += (item.confidence as number) * weight;
    }
    count += 1;
  }

  if (count < 3 || !(weightSum > 0)) return null;
  return {
    score: Math.max(-1, Math.min(1, weightedScore / weightSum)),
    confidence: clamp01(weightedConfidence / weightSum),
    count,
  };
}

export function computeRollingNewsSignal(args: {
  items: NewsItemLite[];
  nowMs: number;
  windowMs?: number;
  halfLifeMs?: number;
}): { score: number; confidence: number; ts: number; sources: string[]; explain: RollingExplain } | null {
  const windowMs = args.windowMs ?? 2 * 60 * 60 * 1000;
  const halfLifeMs = args.halfLifeMs ?? 20 * 60 * 1000;
  const items = args.items ?? [];

  const cutoff = args.nowMs - windowMs;
  const filtered = items.filter((it) => Number.isFinite(it.ts) && it.ts >= cutoff);
  if (filtered.length < 3) return null;

  let weightSum = 0;
  let weightedScore = 0;
  let impactSum = 0;
  let scoredCount = 0;

  const scoredItems = filtered
    .map((it) => {
      const sentiment = it.sentimentScore;
      if (!Number.isFinite(sentiment)) return null;
      const impact = Number.isFinite(it.impactScore) ? (it.impactScore as number) : 0.5;
      const dt = Math.max(0, args.nowMs - it.ts);
      const w = impact * Math.exp(-dt / halfLifeMs);
      return { title: it.title, source: it.source, sentiment, weight: w, impact };
    })
    .filter(Boolean) as Array<{ title: string; source?: string; sentiment: number; weight: number; impact: number }>;

  if (scoredItems.length < 3) return null;

  for (const it of scoredItems) {
    weightSum += it.weight;
    weightedScore += it.sentiment * it.weight;
    impactSum += it.impact;
    scoredCount += 1;
  }

  if (!(weightSum > 0)) return null;

  const score = Math.max(-1, Math.min(1, weightedScore / weightSum));
  const avgImpact = scoredCount ? impactSum / scoredCount : 0.5;
  const confidence = clamp01(Math.min(1, scoredCount / 6) * avgImpact);

  const topTitles = scoredItems
    .slice()
    .sort((a, b) => Math.abs(b.sentiment * b.weight) - Math.abs(a.sentiment * a.weight))
    .slice(0, 3)
    .map((it) => it.title);

  const sources = Array.from(new Set(scoredItems.map((it) => it.source).filter(Boolean))) as string[];
  const latestTs = Math.max(...filtered.map((it) => it.ts));

  return {
    score,
    confidence,
    ts: latestTs,
    sources,
    explain: { topTitles, n: scoredCount, avgImpact },
  };
}
