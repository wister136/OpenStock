import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import TranslationStat from '@/database/models/TranslationStat';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateKey = (searchParams.get('date') || '').trim() || new Date().toISOString().slice(0, 10);

  try {
    await connectToDatabase();
    const stat = await TranslationStat.findOne({ dateKey }).lean();
    return NextResponse.json({
      ok: true,
      dateKey,
      stats: stat
        ? {
            total: stat.total ?? 0,
            cached: stat.cached ?? 0,
            durationMs: stat.durationMs ?? 0,
            providers: stat.providers ?? {},
            reasons: stat.reasons ?? {},
          }
        : { total: 0, cached: 0, durationMs: 0, providers: {}, reasons: {} },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
