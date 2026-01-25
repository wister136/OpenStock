import fs from 'fs';
import path from 'path';

type Region = 'domestic' | 'global';

type NewsRegionRules = {
  publisherRules: Record<string, Region>;
  hostRules: Record<string, Region>;
};

type NormalizedNewsSource = {
  source_name: string;
  provider: string;
  url_host: string;
  title: string;
  feed_name?: string;
  feed_id?: string;
};

type RegionResult = {
  region: Region;
  reason: 'publisherRule' | 'feedRule' | 'hostRule' | 'tldRule' | 'langFallback' | 'default';
  confidence: number;
};

const DEFAULT_RULES: NewsRegionRules = {
  publisherRules: {},
  hostRules: {},
};

const RULES_PATH = path.join(process.cwd(), 'config', 'news_region_rules.json');
let cachedRules: NewsRegionRules = DEFAULT_RULES;
let cachedMtimeMs = 0;

const stats = {
  publisherRule: 0,
  feedRule: 0,
  hostRule: 0,
  tldRule: 0,
  langFallback: 0,
  default: 0,
};
let lastLogAt = 0;

function safeLower(value?: string) {
  return (value || '').trim().toLowerCase();
}

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text || '');
}

function parseHost(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.host || '';
  } catch {
    return '';
  }
}

function loadRules(): NewsRegionRules {
  try {
    const stat = fs.statSync(RULES_PATH);
    if (stat.mtimeMs === cachedMtimeMs) return cachedRules;
    const raw = fs.readFileSync(RULES_PATH, 'utf-8');
    const json = JSON.parse(raw) as Partial<NewsRegionRules>;
    cachedRules = {
      publisherRules: json.publisherRules ?? {},
      hostRules: json.hostRules ?? {},
    };
    cachedMtimeMs = stat.mtimeMs;
    return cachedRules;
  } catch {
    return cachedRules;
  }
}

function normalizeKey(value: string) {
  return value.trim();
}

function recordStat(reason: RegionResult['reason']) {
  if (process.env.NODE_ENV !== 'development') return;
  stats[reason] += 1;
  const now = Date.now();
  if (now - lastLogAt < 10_000) return;
  lastLogAt = now;
  console.info('[news-region] stats', { ...stats });
}

export function normalizeNewsSource(input: any): NormalizedNewsSource {
  const source_name =
    normalizeKey(String(input?.source_name || input?.publisher || input?.source || input?.feedName || input?.feed || '')) || '';
  const provider = normalizeKey(String(input?.provider || input?.channel || input?.feedProvider || '')) || '';
  const url_host = parseHost(String(input?.url || input?.link || ''));
  const title = normalizeKey(String(input?.title || '')) || '';
  const feed_name = input?.feedName ? normalizeKey(String(input.feedName)) : undefined;
  const feed_id = input?.feedId ? normalizeKey(String(input.feedId)) : undefined;
  return {
    source_name,
    provider,
    url_host,
    title,
    feed_name,
    feed_id,
  };
}

export function classifyNewsRegion(input: NormalizedNewsSource): RegionResult {
  const rules = loadRules();
  const sourceName = normalizeKey(input.source_name);
  const feedName = normalizeKey(input.feed_name || '');
  const feedId = normalizeKey(input.feed_id || '');
  const host = safeLower(input.url_host);
  const title = input.title || '';

  if (sourceName && rules.publisherRules[sourceName]) {
    const region = rules.publisherRules[sourceName];
    const res: RegionResult = { region, reason: 'publisherRule', confidence: 0.98 };
    recordStat(res.reason);
    return res;
  }

  if (feedName && rules.publisherRules[feedName]) {
    const region = rules.publisherRules[feedName];
    const res: RegionResult = { region, reason: 'feedRule', confidence: 0.97 };
    recordStat(res.reason);
    return res;
  }

  if (feedId && rules.publisherRules[feedId]) {
    const region = rules.publisherRules[feedId];
    const res: RegionResult = { region, reason: 'feedRule', confidence: 0.97 };
    recordStat(res.reason);
    return res;
  }

  if (host && rules.hostRules[host]) {
    const region = rules.hostRules[host];
    const res: RegionResult = { region, reason: 'hostRule', confidence: 0.9 };
    recordStat(res.reason);
    return res;
  }

  if (host.endsWith('.cn')) {
    const res: RegionResult = { region: 'domestic', reason: 'tldRule', confidence: 0.75 };
    recordStat(res.reason);
    return res;
  }

  if (title) {
    const res: RegionResult = {
      region: hasChinese(title) ? 'domestic' : 'global',
      reason: 'langFallback',
      confidence: 0.6,
    };
    recordStat(res.reason);
    return res;
  }

  const res: RegionResult = { region: 'global', reason: 'default', confidence: 0.5 };
  recordStat(res.reason);
  return res;
}
