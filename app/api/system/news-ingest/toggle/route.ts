import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import SystemSetting from '@/database/models/SystemSetting';

const KEY = 'news_ingest_enabled';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const enabled = Boolean(body?.enabled);
    await connectToDatabase();
    await SystemSetting.updateOne(
      { key: KEY },
      { $set: { key: KEY, value: enabled, updatedAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true, enabled });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
