import crypto from 'crypto';
import { createRequire } from 'module';

import TranslationCache from '@/database/models/TranslationCache';
import { connectToDatabase } from '@/database/mongoose';
import { sha1 } from '@/lib/hash';

type TranslateMeta = { title_en: string; provider: 'baidu' | 'aliyun' | 'none'; cached: boolean };
type TranslateAttempt = { text: string | null; reason?: string };

const memoryCache = new Map<string, { value: string; provider: 'baidu' | 'aliyun' | 'none'; expiresAt: number }>();
const inflight = new Map<string, Promise<TranslateMeta>>();
const statBuffer: Array<{
  provider: 'baidu' | 'aliyun' | 'none';
  cached: boolean;
  durationMs: number;
  reason: string;
}> = [];
let statFlushCounter = 0;

const DEFAULT_TTL_DAYS = 30;
const FAILURE_TTL_MS = 60 * 60 * 1000;

function logDebug(message: string, meta?: Record<string, unknown>) {
  if (process.env.TRANSLATE_DEBUG !== '1') return;
  const payload = meta ? ` ${JSON.stringify(meta)}` : '';
  console.warn(`[translateTitle] ${message}${payload}`);
}

async function recordTranslateStat(input: {
  provider: 'baidu' | 'aliyun' | 'none';
  cached: boolean;
  durationMs: number;
  reason: string;
}): Promise<void> {
  console.info('[translateTitle] event', {
    provider: input.provider,
    cached: input.cached,
    durationMs: input.durationMs,
    reason: input.reason,
  });
  statBuffer.push(input);
  statFlushCounter += 1;
  const shouldFlush = statBuffer.length >= 10 || statFlushCounter % 10 === 0;
  if (!shouldFlush) return;

  const batch = statBuffer.splice(0, statBuffer.length);
  const summary = batch.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.cached += item.cached ? 1 : 0;
      acc.providers[item.provider] = (acc.providers[item.provider] ?? 0) + 1;
      acc.reasons[item.reason] = (acc.reasons[item.reason] ?? 0) + 1;
      acc.durationMs += item.durationMs;
      return acc;
    },
    { total: 0, cached: 0, durationMs: 0, providers: {} as Record<string, number>, reasons: {} as Record<string, number> }
  );

  console.info('[translateTitle] summary', {
    total: summary.total,
    cached: summary.cached,
    avgMs: summary.total ? Math.round(summary.durationMs / summary.total) : 0,
    providers: summary.providers,
    reasons: summary.reasons,
  });

  try {
    const { connectToDatabase } = await import('@/database/mongoose');
    const TranslationStat = (await import('@/database/models/TranslationStat')).default;
    await connectToDatabase();

    const dateKey = new Date().toISOString().slice(0, 10);
    const inc: Record<string, number> = {
      total: summary.total,
      cached: summary.cached,
      durationMs: summary.durationMs,
    };
    for (const [key, val] of Object.entries(summary.providers)) {
      inc[`providers.${key}`] = val;
    }
    for (const [key, val] of Object.entries(summary.reasons)) {
      inc[`reasons.${key}`] = val;
    }

    await TranslationStat.updateOne(
      { dateKey },
      { $setOnInsert: { dateKey, createdAt: new Date() }, $inc: inc },
      { upsert: true }
    );
  } catch {
    // Ignore stat write errors.
  }
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function getTtlMs(): number {
  const ttlDaysRaw = Number(process.env.TRANSLATE_CACHE_TTL_DAYS ?? DEFAULT_TTL_DAYS);
  const ttlDays = Number.isFinite(ttlDaysRaw) && ttlDaysRaw > 0 ? ttlDaysRaw : DEFAULT_TTL_DAYS;
  return ttlDays * 24 * 60 * 60 * 1000;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const TOKEN_REGEX =
  /(SSE:\d{6}|SZSE:\d{6}|\b\d{6}\b|\bEMA\d+\b|\bMA\d+\b|\bADX\b|\bATR\b|\bRSI\b|\bMACD\b|\bBOLL\b|\b[A-Z]{1,5}\b)/g;

function protectTokens(text: string): { text: string; tokens: string[] } {
  const tokens: string[] = [];
  const replaced = text.replace(TOKEN_REGEX, (match) => {
    const placeholder = `[[P${tokens.length}]]`;
    tokens.push(match);
    return placeholder;
  });
  return { text: replaced, tokens };
}

function restoreTokens(text: string, tokens: string[]): string {
  return text.replace(/\[\[?P(\d+)\]\]?/g, (_, idx) => tokens[Number(idx)] ?? '');
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

async function translateWithBaidu(q: string, from: string, to: string, timeoutMs: number): Promise<TranslateAttempt> {
  const appId = process.env.BAIDU_FANYI_APP_ID;
  const secret = process.env.BAIDU_FANYI_SECRET;
  if (!appId || !secret) {
    logDebug('baidu skipped: missing credentials');
    return { text: null, reason: 'baidu_missing_credentials' };
  }

  const salt = String(Date.now());
  const sign = crypto.createHash('md5').update(`${appId}${q}${salt}${secret}`).digest('hex');
  const params = new URLSearchParams({
    q,
    from,
    to,
    appid: appId,
    salt,
    sign,
  });

  const res = await fetchWithTimeout(`https://fanyi-api.baidu.com/api/trans/vip/translate?${params.toString()}`, { method: 'GET' }, timeoutMs);
  if (!res.ok) {
    logDebug('baidu http error', { status: res.status });
    return { text: null, reason: 'baidu_http_error' };
  }
  const data = (await res.json()) as { trans_result?: Array<{ dst?: string }> };
  const dst = data?.trans_result?.[0]?.dst;
  if (!dst) logDebug('baidu response missing dst');
  if (typeof dst === 'string' && dst.trim()) return { text: dst.trim() };
  return { text: null, reason: 'baidu_invalid_response' };
}

async function translateWithAliyun(q: string, from: string, to: string, timeoutMs: number): Promise<TranslateAttempt> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const endpoint = process.env.ALIYUN_MT_ENDPOINT;
  if (!accessKeyId || !accessKeySecret || !endpoint) {
    logDebug('aliyun skipped: missing credentials');
    return { text: null, reason: 'aliyun_missing_credentials' };
  }

  let Alimt20181012: any;
  let OpenApi: any;
  let Util: any;
  try {
    const require = createRequire(import.meta.url);
    Alimt20181012 = require('@alicloud/alimt20181012');
    OpenApi = require('@alicloud/openapi-client');
    Util = require('@alicloud/tea-util');
  } catch {
    logDebug('aliyun skipped: sdk not installed');
    return { text: null, reason: 'aliyun_sdk_missing' };
  }

  const config = new OpenApi.Config({
    accessKeyId,
    accessKeySecret,
    endpoint,
  });
  const client = new Alimt20181012.default(config);
  const request = new Alimt20181012.TranslateGeneralRequest({
    sourceLanguage: from,
    targetLanguage: to,
    sourceText: q,
  });
  const runtime = new Util.RuntimeOptions({
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
  });

  const res = await client.translateGeneralWithOptions(request, runtime);
  const dst = res?.body?.data?.translated ?? res?.body?.data?.translatedText;
  if (!dst) logDebug('aliyun response missing translated text');
  if (typeof dst === 'string' && dst.trim()) return { text: dst.trim() };
  return { text: null, reason: 'aliyun_invalid_response' };
}

async function writeCache(params: {
  key: string;
  fromLang: string;
  toLang: string;
  srcText: string;
  dstText: string;
  provider: 'baidu' | 'aliyun' | 'none';
  ttlMs: number;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + params.ttlMs);
  memoryCache.set(params.key, { value: params.dstText, provider: params.provider, expiresAt: expiresAt.getTime() });

  try {
    await connectToDatabase();
    await TranslationCache.updateOne(
      { key: params.key },
      {
        $set: {
          key: params.key,
          fromLang: params.fromLang,
          toLang: params.toLang,
          srcText: params.srcText,
          dstText: params.dstText,
          provider: params.provider,
          expiresAt,
        },
      },
      { upsert: true }
    );
  } catch {
    // Ignore cache write errors to avoid blocking main flow.
  }
}

export async function translateTitleWithMeta(
  title: string,
  opts?: { allowEnToZh?: boolean; skipZhToEn?: boolean }
): Promise<TranslateMeta> {
  const start = Date.now();
  const normalized = normalizeTitle(title ?? '');
  if (!normalized) {
    await recordTranslateStat({ provider: 'none', cached: true, durationMs: Date.now() - start, reason: 'empty' });
    return { title_en: normalized, provider: 'none', cached: true };
  }
  const allowEnToZh = opts?.allowEnToZh ?? process.env.TRANSLATE_EN_TO_ZH === '1';
  const hasZh = hasChinese(normalized);
  if (hasZh && opts?.skipZhToEn) {
    await recordTranslateStat({ provider: 'none', cached: true, durationMs: Date.now() - start, reason: 'skip_zh_to_en' });
    return { title_en: normalized, provider: 'none', cached: true };
  }
  if (!hasZh && !allowEnToZh) {
    await recordTranslateStat({ provider: 'none', cached: false, durationMs: Date.now() - start, reason: 'no_chinese' });
    return { title_en: normalized, provider: 'none', cached: false };
  }

  const fromLang = hasZh ? 'zh' : 'en';
  const toLang = hasZh ? 'en' : 'zh';
  const key = sha1(`${fromLang}->${toLang}|${normalized}`);
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > now) {
    await recordTranslateStat({ provider: mem.provider, cached: true, durationMs: Date.now() - start, reason: 'cache_memory' });
    return { title_en: mem.value, provider: mem.provider, cached: true };
  }

  try {
    await connectToDatabase();
    const cached = await TranslationCache.findOne({ key, expiresAt: { $gt: new Date() } }).lean();
    if (cached?.dstText) {
      memoryCache.set(key, { value: cached.dstText, provider: cached.provider ?? 'none', expiresAt: new Date(cached.expiresAt).getTime() });
      await recordTranslateStat({ provider: cached.provider ?? 'none', cached: true, durationMs: Date.now() - start, reason: 'cache_db' });
      return { title_en: cached.dstText, provider: cached.provider ?? 'none', cached: true };
    }
  } catch {
    // Ignore cache read errors.
  }

  if (inflight.has(key)) return await inflight.get(key)!;

  const task = (async (): Promise<TranslateMeta> => {
    const timeoutMsRaw = Number(process.env.TRANSLATE_TIMEOUT_MS ?? 2500);
    const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 2500;
    const ttlMs = getTtlMs();

    const protectedTokens = protectTokens(normalized);
    const protectedText = protectedTokens.text;

    try {
      const baidu = await translateWithBaidu(protectedText, fromLang, toLang, timeoutMs);
      if (baidu.text) {
        const restored = restoreTokens(decodeHtmlEntities(baidu.text), protectedTokens.tokens).trim();
        await writeCache({ key, fromLang, toLang, srcText: normalized, dstText: restored, provider: 'baidu', ttlMs });
        await recordTranslateStat({ provider: 'baidu', cached: false, durationMs: Date.now() - start, reason: 'baidu_success' });
        return { title_en: restored, provider: 'baidu', cached: false };
      }
      if (baidu.reason) {
        await recordTranslateStat({ provider: 'none', cached: false, durationMs: Date.now() - start, reason: baidu.reason });
      }
    } catch {
      logDebug('baidu failed: exception');
      await recordTranslateStat({ provider: 'none', cached: false, durationMs: Date.now() - start, reason: 'baidu_exception' });
      // Ignore and fallback to Aliyun.
    }

    try {
      const aliyun = await translateWithAliyun(protectedText, fromLang, toLang, timeoutMs);
      if (aliyun.text) {
        const restored = restoreTokens(aliyun.text, protectedTokens.tokens).trim();
        await writeCache({ key, fromLang, toLang, srcText: normalized, dstText: restored, provider: 'aliyun', ttlMs });
        await recordTranslateStat({ provider: 'aliyun', cached: false, durationMs: Date.now() - start, reason: 'aliyun_success' });
        return { title_en: restored, provider: 'aliyun', cached: false };
      }
      if (aliyun.reason) {
        await recordTranslateStat({ provider: 'none', cached: false, durationMs: Date.now() - start, reason: aliyun.reason });
      }
    } catch {
      logDebug('aliyun failed: exception');
      await recordTranslateStat({ provider: 'none', cached: false, durationMs: Date.now() - start, reason: 'aliyun_exception' });
      // Ignore and fallback to original.
    }

    logDebug('fallback to original', { key });
    await writeCache({ key, fromLang, toLang, srcText: normalized, dstText: normalized, provider: 'none', ttlMs: FAILURE_TTL_MS });
    await recordTranslateStat({ provider: 'none', cached: false, durationMs: Date.now() - start, reason: 'fallback_original' });
    return { title_en: normalized, provider: 'none', cached: false };
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

export async function translateTitle(title: string): Promise<string> {
  const res = await translateTitleWithMeta(title);
  return res.title_en;
}

export async function translateTitleToZh(title: string): Promise<string> {
  const normalized = normalizeTitle(title ?? '');
  if (!normalized) return normalized;
  if (hasChinese(normalized)) return normalized;
  const res = await translateTitleWithMeta(normalized, { allowEnToZh: true, skipZhToEn: true });
  return res.title_en;
}
