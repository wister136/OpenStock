const DEFAULT_SOURCE_WEIGHTS: Record<string, number> = {
  rss: 0.3,
  akshare: 0.6,
  tushare: 0.9,
  gov: 0.95,
  exchange: 0.9,
  manual: 0.4,
};

const DEFAULT_KEYWORDS = [
  '立案',
  '监管',
  '处罚',
  '问询',
  '调查',
  '业绩',
  '财报',
  '预增',
  '预亏',
  '并购',
  '重组',
  '停牌',
  '复牌',
  '减持',
  '增持',
  '回购',
  '涨停',
  '跌停',
  '暴雷',
  '违约',
  'risk',
  'investigation',
  'earnings',
  'merger',
  'acquisition',
  'halt',
  'buyback',
];

const EVENT_TYPE_RULES: Array<{ type: string; keywords: string[] }> = [
  { type: '监管', keywords: ['立案', '监管', '处罚', '问询', '调查', 'investigation'] },
  { type: '业绩', keywords: ['业绩', '财报', '预增', '预亏', 'earnings'] },
  { type: '并购', keywords: ['并购', '重组', 'merger', 'acquisition'] },
  { type: '停牌', keywords: ['停牌', '复牌', 'halt'] },
  { type: '增持', keywords: ['增持', '回购', 'buyback'] },
  { type: '减持', keywords: ['减持'] },
  { type: '涨停', keywords: ['涨停', '跌停'] },
  { type: '风险', keywords: ['暴雷', '违约', 'risk'] },
];

const POS_WORDS = ['利好', '增长', '超预期', '上调', '创新高', 'profit', 'growth', 'upgrade', 'surge', 'beat', 'strong', 'rally'];
const NEG_WORDS = ['利空', '下调', '亏损', '暴雷', '违约', '停牌', '处罚', 'loss', 'downgrade', 'miss', 'fraud', 'crash'];

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function parseSourceWeights(raw?: string): Record<string, number> {
  if (!raw) return DEFAULT_SOURCE_WEIGHTS;
  const map: Record<string, number> = { ...DEFAULT_SOURCE_WEIGHTS };
  const parts = raw.split(',').map((item) => item.trim()).filter(Boolean);
  for (const part of parts) {
    const [key, val] = part.split(':').map((v) => v.trim());
    const num = Number(val);
    if (!key || !Number.isFinite(num)) continue;
    map[key.toLowerCase()] = num;
  }
  return map;
}

function normalizeText(input?: string): string {
  return (input ?? '').toLowerCase();
}

export function extractKeywords(title: string, content?: string): string[] {
  const text = `${title} ${content ?? ''}`.toLowerCase();
  const matched: string[] = [];
  for (const kw of DEFAULT_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) matched.push(kw);
  }
  return Array.from(new Set(matched)).slice(0, 10);
}

export function inferEventType(title: string, content?: string): string | undefined {
  const text = `${title} ${content ?? ''}`.toLowerCase();
  for (const rule of EVENT_TYPE_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw.toLowerCase()))) return rule.type;
  }
  return undefined;
}

export function basicSentimentScore(title: string, content?: string): { score: number; confidence: number } {
  const text = normalizeText(`${title} ${content ?? ''}`);
  let pos = 0;
  let neg = 0;
  for (const kw of POS_WORDS) {
    if (text.includes(kw.toLowerCase())) pos += 1;
  }
  for (const kw of NEG_WORDS) {
    if (text.includes(kw.toLowerCase())) neg += 1;
  }
  const matches = pos + neg;
  if (!matches) return { score: 0, confidence: 0.3 };
  const score = clamp((pos - neg) / Math.max(3, matches), -1, 1);
  const confidence = clamp(0.25 + matches * 0.08, 0.3, 0.65);
  return { score, confidence };
}

export function scoreNewsImpact(args: {
  symbol: string;
  title: string;
  source: string;
  publishedAt: number;
  content?: string;
  marketLinked?: boolean;
}): { impactScore: number; tags: string[]; eventType?: string } {
  const sourceWeights = parseSourceWeights(process.env.NEWS_SOURCE_WEIGHTS);
  const sourceKey = String(args.source || '').toLowerCase();
  const sourceWeight = Number.isFinite(sourceWeights[sourceKey]) ? sourceWeights[sourceKey] : 0.5;

  const keywords = extractKeywords(args.title, args.content);
  const keywordBoost = Math.min(0.35, keywords.length * 0.08);

  const now = Date.now();
  const ageMin = Math.max(0, (now - args.publishedAt) / 60000);
  const recencyBoost = ageMin <= 10 ? 0.3 : ageMin <= 30 ? 0.2 : ageMin <= 120 ? 0.1 : 0;

  const symbolRaw = String(args.symbol || '').toUpperCase();
  const symbolCode = symbolRaw.includes(':') ? symbolRaw.split(':')[1] : symbolRaw;
  const symbolMatch = args.title.includes(symbolRaw) || args.title.includes(symbolCode) ? 0.2 : 0;

  const marketLinkBoost = args.marketLinked ? 0.2 : 0;

  const impactScore = clamp(sourceWeight + keywordBoost + recencyBoost + symbolMatch + marketLinkBoost, 0, 1);
  const eventType = inferEventType(args.title, args.content);
  return { impactScore, tags: keywords, eventType };
}
