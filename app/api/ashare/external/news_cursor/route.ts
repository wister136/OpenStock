import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsCursor from '@/database/models/NewsCursor';
import { normalizeSymbol } from '@/lib/ashare/symbol';

function getApiKey(req: Request): string | null {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey && apiKey === process.env.NEWS_INGEST_API_KEY) return apiKey;
  const auth = req.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token && token === process.env.NEWS_INGEST_API_KEY) return token;
  }
  return null;
}

function parseKey(raw: string | null): { source: string; symbol: string } | null {
  const key = (raw || '').trim();
  if (!key) return null;
  const parts = key.split('|');
  if (parts.length !== 2) return null;
  const symbol = normalizeSymbol(parts[0]) || 'GLOBAL';
  const source = parts[1].trim();
  if (!source) return null;
  return { source, symbol };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyParam = searchParams.get('key');
  const sourceParam = (searchParams.get('source') || '').trim();
  const symbolParam = normalizeSymbol(searchParams.get('symbol') ?? 'GLOBAL') || 'GLOBAL';
  const parsed = parseKey(keyParam) ?? (sourceParam ? { source: sourceParam, symbol: symbolParam } : null);
  if (!parsed) return NextResponse.json({ ok: false, error: 'Invalid key' }, { status: 400 });
  const key = `${parsed.symbol}|${parsed.source}`;
  try {
    await connectToDatabase();
    const doc = (await NewsCursor.findOne({ source: parsed.source, symbol: parsed.symbol }).lean()) as any;
    return NextResponse.json({
      ok: true,
      key,
      lastTs: doc?.lastTs ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!getApiKey(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = parseKey(typeof body?.key === 'string' ? body.key : null);
  const lastTs = Number(body?.lastTs);
  if (!parsed) return NextResponse.json({ ok: false, error: 'Invalid key' }, { status: 400 });
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
    return NextResponse.json({ ok: true, key: `${parsed.symbol}|${parsed.source}`, lastTs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
