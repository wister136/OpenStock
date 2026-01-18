import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import AshareStrategyConfig from '@/database/models/AshareStrategyConfig';
import { buildDefaultConfig, normalizeConfig } from '@/lib/ashare/config';

function normalizeSymbol(input: string | null): string {
  const s = (input || '').trim().toUpperCase();
  if (!s.includes(':')) return s;
  const [ex, tk] = s.split(':');
  return `${ex}:${tk}`;
}

function toNumber(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function sanitizeConfigPatch(body: any) {
  const weights = body?.weights ?? {};
  const thresholds = body?.thresholds ?? {};
  const positionCaps = body?.positionCaps ?? {};
  const pick = (obj: Record<string, number | undefined>) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v === 'number')) as Record<string, number>;

  return {
    weights: pick({
      w_trend: toNumber(weights.w_trend),
      w_range: toNumber(weights.w_range),
      w_panic: toNumber(weights.w_panic),
      w_news: toNumber(weights.w_news),
      w_realtime: toNumber(weights.w_realtime),
    }),
    thresholds: pick({
      trendScore: toNumber(thresholds.trendScore),
      panicVolRatio: toNumber(thresholds.panicVolRatio),
      panicDrawdown: toNumber(thresholds.panicDrawdown),
      volRatioLow: toNumber(thresholds.volRatioLow),
      volRatioHigh: toNumber(thresholds.volRatioHigh),
      minLiquidityRatio: toNumber(thresholds.minLiquidityRatio),
      realtimeVolSurprise: toNumber(thresholds.realtimeVolSurprise),
      realtimeAmtSurprise: toNumber(thresholds.realtimeAmtSurprise),
      newsPanicThreshold: toNumber(thresholds.newsPanicThreshold),
      newsTrendThreshold: toNumber(thresholds.newsTrendThreshold),
    }),
    positionCaps: pick({
      trend: toNumber(positionCaps.trend),
      range: toNumber(positionCaps.range),
      panic: toNumber(positionCaps.panic),
    }),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get('symbol'));
  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Missing symbol' }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const userId = String(session.user.id);
    let config = await AshareStrategyConfig.findOne({ userId, symbol }).lean();
    if (!config) {
      const defaults = buildDefaultConfig(userId, symbol);
      config = (await AshareStrategyConfig.create(defaults)).toObject();
    }
    return NextResponse.json({ ok: true, config });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const symbol = normalizeSymbol(body?.symbol ?? '');
  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Missing symbol' }, { status: 400 });
  }

  const patch = sanitizeConfigPatch(body);

  try {
    await connectToDatabase();
    const userId = String(session.user.id);
    const existing = await AshareStrategyConfig.findOne({ userId, symbol }).lean();
    const merged = normalizeConfig(
      {
        ...(existing || {}),
        weights: { ...(existing?.weights || {}), ...patch.weights },
        thresholds: { ...(existing?.thresholds || {}), ...patch.thresholds },
        positionCaps: { ...(existing?.positionCaps || {}), ...patch.positionCaps },
      },
      userId,
      symbol
    );

    const config = await AshareStrategyConfig.findOneAndUpdate(
      { userId, symbol },
      { $set: merged },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({ ok: true, config });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
