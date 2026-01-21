import EventStream from '@/database/models/EventStream';
import NewsAnalysisCache from '@/database/models/NewsAnalysisCache';
import NewsItem from '@/database/models/NewsItem';
import { sha1 } from '@/lib/hash';
import { callDeepSeekAnalysis } from '@/lib/llm/deepseek';
import { checkBudget, recordUsage, estimateCostRmb } from '@/lib/llm/usageLedger';
import { basicSentimentScore, scoreNewsImpact } from '@/lib/ashare/news_scoring';

export type NewsAnalysisOutcome = {
  impactScore: number;
  sentimentScore: number;
  confidence: number;
  summary?: string;
  eventType?: string;
  entities?: string[];
  tags?: string[];
  provider: 'deepseek' | 'none';
  model?: string;
  cached: boolean;
  reason?: string;
};

const DEFAULT_L2_THRESHOLD = 0.65;
const FALLBACK_CONFIDENCE = 0.3;

function logDebug(message: string, meta?: Record<string, unknown>) {
  if (process.env.NEWS_ANALYSIS_DEBUG !== '1') return;
  const payload = meta ? ` ${JSON.stringify(meta)}` : '';
  console.info(`[news_analysis] ${message}${payload}`);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function buildSummary(content?: string): string | undefined {
  if (!content) return undefined;
  const text = content.trim();
  if (!text) return undefined;
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function buildAnalysisKey(args: { title: string; source: string; publishedAt: number }): string {
  return sha1(`${args.title}|${args.source}|${args.publishedAt}`);
}

function shouldUseReasoner(impactScore: number, confidence: number): boolean {
  return impactScore >= 0.8 && confidence < 0.6;
}

function resolveL2Reason(outcome: NewsAnalysisOutcome): string | undefined {
  if (outcome.provider === 'deepseek') return undefined;
  const reason = String(outcome.reason ?? '').toLowerCase();
  if (reason === 'below_threshold') return 'below_threshold';
  if (reason === 'budget_exceeded') return 'budget_exceeded';
  if (reason === 'input_tokens_exceeded') return 'input_tokens_exceeded';
  if (reason === 'output_tokens_exceeded') return 'output_tokens_exceeded';
  if (reason === 'budget_blocked') return 'budget_exceeded';
  return 'llm_error';
}

export async function analyzeNewsItem(params: {
  symbol: string;
  title: string;
  source: string;
  publishedAt: number;
  content?: string;
  impactScore?: number;
  summary?: string;
  eventType?: string;
  entities?: string[];
  tags?: string[];
  marketLinked?: boolean;
}): Promise<NewsAnalysisOutcome> {
  const level1 = scoreNewsImpact({
    symbol: params.symbol,
    title: params.title,
    source: params.source,
    publishedAt: params.publishedAt,
    content: params.content,
    marketLinked: params.marketLinked,
  });
  const impactScore = clamp(params.impactScore ?? level1.impactScore, 0, 1);
  const tags = params.tags ?? level1.tags;
  const eventType = params.eventType ?? level1.eventType;
  const summary = params.summary ?? buildSummary(params.content);

  const thresholdRaw = Number(process.env.IMPACT_L2_THRESHOLD ?? DEFAULT_L2_THRESHOLD);
  const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : DEFAULT_L2_THRESHOLD;
  const allowL2 = impactScore >= threshold;
  if (!allowL2) {
    const basic = basicSentimentScore(params.title, params.content);
    logDebug('skip_l2_below_threshold', { impactScore, threshold });
    return {
      impactScore,
      sentimentScore: basic.score,
      confidence: basic.confidence,
      summary,
      eventType,
      entities: params.entities,
      tags,
      provider: 'none',
      cached: false,
      reason: 'below_threshold',
    };
  }

  const key = buildAnalysisKey({ title: params.title, source: params.source, publishedAt: params.publishedAt });
  const cached = await NewsAnalysisCache.findOne({ key, status: 'ok' }).lean();
  if (cached) {
    logDebug('cache_hit', { key });
    return {
      impactScore: Number.isFinite(cached.impactScore) ? (cached.impactScore as number) : impactScore,
      sentimentScore: Number.isFinite(cached.sentimentScore) ? (cached.sentimentScore as number) : 0,
      confidence: Number.isFinite(cached.confidence) ? (cached.confidence as number) : FALLBACK_CONFIDENCE,
      summary: cached.summary ?? summary,
      eventType: cached.eventType ?? eventType,
      entities: cached.entities ?? params.entities,
      tags,
      provider: cached.provider ?? 'deepseek',
      model: cached.model ?? undefined,
      cached: true,
      reason: 'cache_hit',
    };
  }

  const budget = await checkBudget();
  if (!budget.allowed) {
    logDebug('budget_blocked', { reason: budget.reason, totals: budget.totals });
    return {
      impactScore,
      sentimentScore: 0,
      confidence: FALLBACK_CONFIDENCE,
      summary,
      eventType,
      entities: params.entities,
      tags,
      provider: 'none',
      cached: false,
      reason: budget.reason ?? 'budget_blocked',
    };
  }

  try {
    const first = await callDeepSeekAnalysis({
      symbol: params.symbol,
      title: params.title,
      content: params.content,
      source: params.source,
      publishedAt: params.publishedAt,
      impactScore,
      model: 'chat',
    });

    let analysis = first.analysis;
    let model = first.model;
    let inputTokens = first.usage.inputTokens;
    let outputTokens = first.usage.outputTokens;

    if (shouldUseReasoner(analysis.impactScore ?? impactScore, analysis.confidence)) {
      const budget2 = await checkBudget();
      if (budget2.allowed) {
        const second = await callDeepSeekAnalysis({
          symbol: params.symbol,
          title: params.title,
          content: params.content,
          source: params.source,
          publishedAt: params.publishedAt,
          impactScore: analysis.impactScore ?? impactScore,
          model: 'reasoner',
        });
        analysis = second.analysis;
        model = second.model;
        inputTokens += second.usage.inputTokens;
        outputTokens += second.usage.outputTokens;
      }
    }

    const costRmb = estimateCostRmb(inputTokens, outputTokens);
    await recordUsage({ model, inputTokens, outputTokens, costRmb });

    await NewsAnalysisCache.updateOne(
      { key },
      {
        $set: {
          key,
          symbol: params.symbol,
          source: params.source,
          title: params.title,
          publishedAt: params.publishedAt,
          provider: 'deepseek',
          model,
          status: 'ok',
          sentimentScore: analysis.sentimentScore,
          confidence: analysis.confidence,
          impactScore: analysis.impactScore ?? impactScore,
          summary: analysis.summary ?? summary,
          eventType: analysis.eventType ?? eventType,
          entities: analysis.entities ?? params.entities,
          inputTokens,
          outputTokens,
          costRmb,
          reason: 'llm_success',
        },
      },
      { upsert: true }
    );

    logDebug('llm_success', { model, inputTokens, outputTokens, costRmb });
    return {
      impactScore: analysis.impactScore ?? impactScore,
      sentimentScore: analysis.sentimentScore,
      confidence: analysis.confidence,
      summary: analysis.summary ?? summary,
      eventType: analysis.eventType ?? eventType,
      entities: analysis.entities ?? params.entities,
      tags,
      provider: 'deepseek',
      model,
      cached: false,
      reason: 'llm_success',
    };
  } catch (error: any) {
    const reason = String(error?.message ?? error);
    await NewsAnalysisCache.updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          symbol: params.symbol,
          source: params.source,
          title: params.title,
          publishedAt: params.publishedAt,
          provider: 'none',
          status: 'fallback',
          sentimentScore: 0,
          confidence: FALLBACK_CONFIDENCE,
          impactScore,
          summary,
          eventType,
          entities: params.entities,
          reason,
        },
      },
      { upsert: true }
    );

    logDebug('llm_fallback', { reason });
    return {
      impactScore,
      sentimentScore: 0,
      confidence: FALLBACK_CONFIDENCE,
      summary,
      eventType,
      entities: params.entities,
      tags,
      provider: 'none',
      cached: false,
      reason,
    };
  }
}

export async function syncNewsAnalysisToStorage(args: {
  fingerprint: string;
  analysis: NewsAnalysisOutcome;
}): Promise<void> {
  const l2Reason = resolveL2Reason(args.analysis);

  await NewsItem.updateOne(
    { fingerprint: args.fingerprint },
    {
      $set: {
        sentimentScore: args.analysis.sentimentScore,
        confidence: args.analysis.confidence,
        impactScore: args.analysis.impactScore,
        summary: args.analysis.summary,
        eventType: args.analysis.eventType,
        entities: args.analysis.entities,
        tags: args.analysis.tags,
        ...(l2Reason ? { l2Reason } : {}),
      },
      ...(l2Reason ? {} : { $unset: { l2Reason: '' } }),
    }
  );

  const eventFingerprint = sha1(`news|${args.fingerprint}`);
  await EventStream.updateOne(
    { fingerprint: eventFingerprint },
    {
      $set: {
        sentimentScore: args.analysis.sentimentScore,
        confidence: args.analysis.confidence,
        score: args.analysis.impactScore,
        summary: args.analysis.summary,
        eventType: args.analysis.eventType,
        entities: args.analysis.entities,
        ...(l2Reason ? { l2Reason } : {}),
      },
      ...(l2Reason ? {} : { $unset: { l2Reason: '' } }),
    }
  );
}
