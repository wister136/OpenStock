import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import SystemSetting from '@/database/models/SystemSetting';

const KEY = 'news_ingest_enabled';

export async function GET() {
  try {
    await connectToDatabase();
    const setting = await SystemSetting.findOne({ key: KEY }).lean();
    const enabled = setting?.value ?? true;
    return NextResponse.json({
      ok: true,
      enabled,
      updated_at: setting?.updatedAt ? new Date(setting.updatedAt).toISOString() : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
