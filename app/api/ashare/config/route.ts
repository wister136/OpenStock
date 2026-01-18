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

function clampRange(value: number | undefined, min: number, max: number): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

function sanitizeConfigPatch(body: any) {
  const weights = body?.weights ?? {};
  const thresholds = body?.thresholds ?? {};
  const positionCaps = body?.positionCaps ?? {};
  const pick = (obj: Record<string, number | undefined>) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v === 'number')) as Record<string, number>;

  return {
    weights: pick({
      w_trend: clampRange(toNumber(weights.w_trend), 0, 1),
      w_range: clampRange(toNumber(weights.w_range), 0, 1),
      w_panic: clampRange(toNumber(weights.w_panic), 0, 1),
      w_news: clampRange(toNumber(weights.w_news), 0, 1),
      w_realtime: clampRange(toNumber(weights.w_realtime), 0, 1),
    }),
    thresholds: pick({
      trendScoreThreshold: clampRange(toNumber(thresholds.trendScoreThreshold ?? thresholds.trendScore), 0, 1),
      panicVolRatio: clampRange(toNumber(thresholds.panicVolRatio), 0.1, 10),
      panicDrawdown: clampRange(toNumber(thresholds.panicDrawdown), 0, 1),
      volRatioLow: clampRange(toNumber(thresholds.volRatioLow), 0, 5),
      volRatioHigh: clampRange(toNumber(thresholds.volRatioHigh), 0, 10),
      minLiquidityAmountRatio: clampRange(toNumber(thresholds.minLiquidityAmountRatio ?? thresholds.minLiquidityRatio), 0, 5),
      minLiquidityVolumeRatio: clampRange(toNumber(thresholds.minLiquidityVolumeRatio), 0, 5),
      realtimeVolSurprise: clampRange(toNumber(thresholds.realtimeVolSurprise), 0, 10),
      realtimeAmtSurprise: clampRange(toNumber(thresholds.realtimeAmtSurprise), 0, 10),
      newsPanicThreshold: clampRange(toNumber(thresholds.newsPanicThreshold), 0, 1),
      newsTrendThreshold: clampRange(toNumber(thresholds.newsTrendThreshold), 0, 1),
      hysteresisThreshold: clampRange(toNumber(thresholds.hysteresisThreshold), 0, 1),
    }),
    positionCaps: pick({
      trend: clampRange(toNumber(positionCaps.trend), 0, 1),
      range: clampRange(toNumber(positionCaps.range), 0, 1),
      panic: clampRange(toNumber(positionCaps.panic), 0, 1),
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
    const normalized = normalizeConfig(config, userId, symbol);
    if (JSON.stringify(config.thresholds) !== JSON.stringify(normalized.thresholds)) {
      await AshareStrategyConfig.updateOne({ userId, symbol }, { $set: normalized });
    }
    return NextResponse.json({ ok: true, config: normalized });
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
