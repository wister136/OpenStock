import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import NewsCursor from '@/database/models/NewsCursor';
import { normalizeSymbol } from '@/lib/ashare/symbol';

function requireApiKey(req: Request): string | null {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.NEWS_INGEST_API_KEY) return null;
  return apiKey;
}

export async function GET(req: Request) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const source = (searchParams.get('source') || '').trim();
  const symbol = normalizeSymbol(searchParams.get('symbol') ?? 'GLOBAL') || 'GLOBAL';
  if (!source) {
    return NextResponse.json({ ok: false, error: 'Missing source' }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const doc = (await NewsCursor.findOne({ source, symbol }).lean()) as any;
    return NextResponse.json({
      ok: true,
      source,
      symbol,
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
  const source = typeof body?.source === 'string' ? body.source.trim() : '';
  const symbol = normalizeSymbol(body?.symbol ?? 'GLOBAL') || 'GLOBAL';
  const lastTs = Number(body?.lastTs);
  if (!source) {
    return NextResponse.json({ ok: false, error: 'Missing source' }, { status: 400 });
  }
  if (!Number.isFinite(lastTs)) {
    return NextResponse.json({ ok: false, error: 'Invalid lastTs' }, { status: 400 });
  }
  try {
    await connectToDatabase();
    await NewsCursor.updateOne(
      { source, symbol },
      { $max: { lastTs }, $setOnInsert: { source, symbol } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true, source, symbol, lastTs, serverTime: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
