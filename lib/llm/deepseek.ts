type DeepSeekUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type DeepSeekAnalysis = {
  sentimentScore: number;
  confidence: number;
  eventType?: string;
  entities?: string[];
  summary?: string;
  impactScore?: number;
};

export type DeepSeekResult = {
  analysis: DeepSeekAnalysis;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  model: string;
};

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL_CHAT = 'deepseek-chat';
const DEFAULT_MODEL_REASONER = 'deepseek-reasoner';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_API_STYLE = 'chat';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeParseJson(text: string): any | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function resolveApiStyle(baseUrl: string): 'chat' | 'responses' {
  const raw = (process.env.DEEPSEEK_API_STYLE ?? DEFAULT_API_STYLE).toLowerCase();
  if (raw === 'responses') return 'responses';
  if (raw === 'chat') return 'chat';
  if (baseUrl.includes('volces.com')) return 'responses';
  return 'chat';
}

function extractTextFromResponse(data: any): string | null {
  const chatContent = data?.choices?.[0]?.message?.content;
  if (typeof chatContent === 'string') return chatContent;
  const output = data?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.output_text === 'string') return part.output_text;
      }
    }
  }
  return null;
}

function extractUsageFromResponse(data: any): DeepSeekUsage {
  const usage = data?.usage ?? {};
  return {
    prompt_tokens: usage.prompt_tokens ?? usage.input_tokens,
    completion_tokens: usage.completion_tokens ?? usage.output_tokens,
    total_tokens: usage.total_tokens,
  };
}

function normalizeAnalysis(input: any, fallbackImpact?: number): DeepSeekAnalysis | null {
  if (!input || typeof input !== 'object') return null;
  const sentimentScore = clamp(Number(input.sentimentScore ?? 0), -1, 1);
  const confidence = clamp(Number(input.confidence ?? 0), 0, 1);
  const impactScoreRaw = input.impactScore == null ? fallbackImpact : Number(input.impactScore);
  const impactScore = impactScoreRaw == null ? undefined : clamp(Number(impactScoreRaw), 0, 1);
  const eventType = typeof input.eventType === 'string' ? input.eventType.trim() : undefined;
  const summary = typeof input.summary === 'string' ? input.summary.trim() : undefined;
  const entities = Array.isArray(input.entities)
    ? Array.from(new Set(input.entities.map((v: any) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))).slice(0, 12)
    : undefined;
  return {
    sentimentScore,
    confidence,
    impactScore,
    eventType,
    summary,
    entities,
  };
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function buildPrompt(args: {
  symbol: string;
  title: string;
  content?: string;
  source: string;
  publishedAt: number;
  impactScore?: number;
}): { system: string; user: string } {
  const system = [
    'You are a financial news analyst.',
    'Return ONLY valid JSON with keys: sentimentScore, confidence, eventType, entities, summary, impactScore.',
    'sentimentScore: -1..1, confidence: 0..1, impactScore: 0..1.',
    'summary: <= 2 short lines.',
  ].join(' ');
  const user = JSON.stringify(
    {
      symbol: args.symbol,
      title: args.title,
      content: args.content ?? '',
      source: args.source,
      publishedAt: args.publishedAt,
      impactScore_hint: args.impactScore,
    },
    null,
    2
  );
  return { system, user };
}

export async function callDeepSeekAnalysis(params: {
  symbol: string;
  title: string;
  content?: string;
  source: string;
  publishedAt: number;
  impactScore?: number;
  model?: 'chat' | 'reasoner';
}): Promise<DeepSeekResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY');
  }
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const apiStyle = resolveApiStyle(baseUrl);
  const url =
    apiStyle === 'responses' ? `${baseUrl}/responses` : `${baseUrl}/v1/chat/completions`;
  const model =
    params.model === 'reasoner'
      ? process.env.DEEPSEEK_MODEL_REASONER ?? DEFAULT_MODEL_REASONER
      : process.env.DEEPSEEK_MODEL_CHAT ?? DEFAULT_MODEL_CHAT;
  const timeoutMsRaw = Number(process.env.DEEPSEEK_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutMsRaw) ? timeoutMsRaw : DEFAULT_TIMEOUT_MS;
  const maxTokensRaw = Number(process.env.LLM_MAX_TOKENS ?? DEFAULT_MAX_TOKENS);
  const maxTokens = Number.isFinite(maxTokensRaw) ? maxTokensRaw : DEFAULT_MAX_TOKENS;
  const temperatureRaw = Number(process.env.LLM_TEMPERATURE ?? 0.0);
  const temperature = Number.isFinite(temperatureRaw) ? temperatureRaw : 0.0;

  const prompt = buildPrompt(params);
  const body =
    apiStyle === 'responses'
      ? {
          model,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `${prompt.system}\n\n${prompt.user}`,
                },
              ],
            },
          ],
          temperature,
          max_output_tokens: maxTokens,
        }
      : {
          model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        };

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`DeepSeek HTTP ${res.status} ${text}`);
  }

  const data = (await res.json()) as any;
  const content = extractTextFromResponse(data);
  if (typeof content !== 'string') {
    throw new Error('DeepSeek response missing content');
  }

  const parsed = safeParseJson(content);
  const analysis = normalizeAnalysis(parsed, params.impactScore);
  if (!analysis) {
    throw new Error('DeepSeek response invalid JSON');
  }

  const usage: DeepSeekUsage = extractUsageFromResponse(data);
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens);

  return {
    analysis,
    usage: {
      inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
      outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
      totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
    },
    model,
  };
}
