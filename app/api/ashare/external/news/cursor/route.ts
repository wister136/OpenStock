import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsCursor from '@/database/models/NewsCursor';
import { normalizeSymbol } from '@/lib/ashare/symbol';

function requireApiKey(req: Request): boolean {
  const apiKey = req.headers.get('x-api-key');
  return Boolean(apiKey && apiKey === process.env.NEWS_INGEST_API_KEY);
}

function parseKey(key: string): { symbol: string; source: string } | null {
  const parts = key.split('|');
  if (parts.length !== 2) return null;
  const symbol = normalizeSymbol(parts[0]) || 'GLOBAL';
  const source = parts[1].trim();
  if (!source) return null;
  return { symbol, source };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get('key') || '').trim();
  const parsed = parseKey(key);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: 'Invalid key' }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const doc = (await NewsCursor.findOne({ source: parsed.source, symbol: parsed.symbol }).lean()) as any;
    return NextResponse.json({
      ok: true,
      key,
      lastTs: doc?.lastTs ?? 0,
      serverTime: Date.now(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const key = typeof body?.key === 'string' ? body.key.trim() : '';
  const lastTs = Number(body?.lastTs);
  const parsed = parseKey(key);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: 'Invalid key' }, { status: 400 });
  }
  if (!Number.isFinite(lastTs)) {
    return NextResponse.json({ ok: false, error: 'Invalid lastTs' }, { status: 400 });
  }
  try {
    await connectToDatabase();
    await NewsCursor.updateOne(
      { source: parsed.source, symbol: parsed.symbol },
      { $max: { lastTs }, $setOnInsert: { source: parsed.source, symbol: parsed.symbol } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true, key, lastTs, serverTime: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
