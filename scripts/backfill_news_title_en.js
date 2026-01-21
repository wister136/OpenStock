const crypto = require('node:crypto');
require('dotenv').config();
const { MongoClient } = require('mongodb');

function parseArgs() {
  const args = process.argv.slice(2);
  const res = { days: 10, limit: 500 };
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const val = args[i + 1];
    if (key === '--days' && val) res.days = Math.max(1, Number(val));
    if (key === '--limit' && val) res.limit = Math.max(1, Number(val));
  }
  return res;
}

function hasChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

function normalizeTitle(title) {
  return String(title || '').trim().replace(/\s+/g, ' ');
}

function decodeHtmlEntities(input) {
  return String(input || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const TOKEN_REGEX =
  /(SSE:\d{6}|SZSE:\d{6}|\b\d{6}\b|\bEMA\d+\b|\bMA\d+\b|\bADX\b|\bATR\b|\bRSI\b|\bMACD\b|\bBOLL\b|\b[A-Z]{1,5}\b)/g;

function protectTokens(text) {
  const tokens = [];
  const replaced = text.replace(TOKEN_REGEX, (match) => {
    const placeholder = `[[P${tokens.length}]]`;
    tokens.push(match);
    return placeholder;
  });
  return { text: replaced, tokens };
}

function restoreTokens(text, tokens) {
  return String(text || '').replace(/\[\[?P(\d+)\]\]?/g, (_, idx) => tokens[Number(idx)] || '');
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function translateWithBaidu(q, from, to, timeoutMs) {
  const appId = process.env.BAIDU_FANYI_APP_ID;
  const secret = process.env.BAIDU_FANYI_SECRET;
  if (!appId || !secret) return null;

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
  const res = await fetchWithTimeout(
    `https://fanyi-api.baidu.com/api/trans/vip/translate?${params.toString()}`,
    { method: 'GET' },
    timeoutMs
  );
  if (!res.ok) return null;
  const data = await res.json();
  const dst = data?.trans_result?.[0]?.dst;
  return typeof dst === 'string' && dst.trim() ? dst.trim() : null;
}

async function translateWithAliyun(q, from, to, timeoutMs) {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const endpoint = process.env.ALIYUN_MT_ENDPOINT;
  if (!accessKeyId || !accessKeySecret || !endpoint) return null;

  let Alimt20181012;
  let OpenApi;
  let Util;
  try {
    Alimt20181012 = require('@alicloud/alimt20181012');
    OpenApi = require('@alicloud/openapi-client');
    Util = require('@alicloud/tea-util');
  } catch {
    return null;
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
  try {
    const res = await client.translateGeneralWithOptions(request, runtime);
    const dst = res?.body?.data?.translated ?? res?.body?.data?.translatedText;
    return typeof dst === 'string' && dst.trim() ? dst.trim() : null;
  } catch (err) {
    const code = err?.code || err?.name || 'ALIYUN_ERROR';
    console.warn('[backfill_news_title_en] aliyun failed', code);
    return null;
  }
}

async function translateTitle(text, fromLang, toLang, timeoutMs) {
  const protectedTokens = protectTokens(text);
  const protectedText = protectedTokens.text;
  const baidu = await translateWithBaidu(protectedText, fromLang, toLang, timeoutMs);
  if (baidu) return restoreTokens(decodeHtmlEntities(baidu), protectedTokens.tokens).trim();
  const aliyun = await translateWithAliyun(protectedText, fromLang, toLang, timeoutMs);
  if (aliyun) return restoreTokens(aliyun, protectedTokens.tokens).trim();
  return text;
}

async function main() {
  const { days, limit } = parseArgs();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const now = Date.now();
  const since = now - days * 24 * 60 * 60 * 1000;
  const ttlDays = Number(process.env.TRANSLATE_CACHE_TTL_DAYS || 30);
  const timeoutMs = Number(process.env.TRANSLATE_TIMEOUT_MS || 2500);
  const allowEnToZh = process.env.TRANSLATE_EN_TO_ZH === '1';

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection('news_items');
  const cacheCol = db.collection('translation_cache');

  const cursor = col
    .find({ publishedAt: { $gte: since }, isMock: { $ne: true } }, { projection: { title: 1, title_en: 1, publishedAt: 1 } })
    .sort({ publishedAt: -1 })
    .limit(limit);

  let scanned = 0;
  let updated = 0;
  const bulkOps = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned += 1;
    const title = normalizeTitle(doc.title);
    const titleEn = typeof doc.title_en === 'string' ? doc.title_en.trim() : '';
    if (!title) continue;
    if (hasChinese(title)) continue;
    if (!allowEnToZh) continue;
    if (titleEn && titleEn !== title) continue;

    const fromLang = 'en';
    const toLang = 'zh';
    const key = crypto.createHash('sha1').update(`${fromLang}->${toLang}|${title}`).digest('hex');
    const cached = await cacheCol.findOne({ key, expiresAt: { $gt: new Date() } });
    const translated =
      cached?.dstText && typeof cached.dstText === 'string'
        ? cached.dstText
        : await translateTitle(title, fromLang, toLang, timeoutMs);
    if (!translated || translated === title) continue;

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { title_en: translated } },
      },
    });

    if (!cached) {
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
      await cacheCol.updateOne(
        { key },
        {
          $set: {
            key,
            fromLang,
            toLang,
            srcText: title,
            dstText: translated,
            provider: translated === title ? 'none' : 'baidu',
            expiresAt,
          },
        },
        { upsert: true }
      );
    }

    if (bulkOps.length >= 50) {
      const res = await col.bulkWrite(bulkOps, { ordered: false });
      updated += res.modifiedCount || 0;
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length) {
    const res = await col.bulkWrite(bulkOps, { ordered: false });
    updated += res.modifiedCount || 0;
  }

  await client.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        days,
        limit,
        scanned,
        updated,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('[backfill_news_title_en] failed', err);
  process.exit(1);
});
