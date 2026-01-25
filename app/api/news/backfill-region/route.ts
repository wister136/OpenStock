import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/database/mongoose';
import EventStream from '@/database/models/EventStream';
import NewsItem from '@/database/models/NewsItem';
import { normalizeNewsSource, classifyNewsRegion } from '@/lib/newsRegion';
import { sha1 } from '@/lib/hash';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '2000', 10) || 2000, 1), 10000);
  const force = searchParams.get('force') === '1';
  const updateEvents = searchParams.get('updateEvents') === '1';
  const dryRun = searchParams.get('dryRun') === '1';

  try {
    await connectToDatabase();
    const query: Record<string, any> = force ? {} : { region: { $exists: false } };
    const items = await NewsItem.find(query).sort({ publishedAt: -1 }).limit(limit).lean();
    if (!items.length) {
      return NextResponse.json({ ok: true, updated: 0, eventsUpdated: 0, samples: [] });
    }

    const newsOps: any[] = [];
    const eventOps: any[] = [];
    const samples: any[] = [];

    for (const item of items) {
      const normalized = normalizeNewsSource({
        source_name: item.source,
        provider: item.provider,
        url: item.url,
        title: item.title,
      });
      const regionResult = classifyNewsRegion(normalized);
      const updateDoc = {
        provider: normalized.provider || item.provider,
        url_host: normalized.url_host || item.url_host,
        region: regionResult.region,
        region_reason: regionResult.reason,
        region_confidence: regionResult.confidence,
        region_updated_at: Date.now(),
      };

      newsOps.push({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: updateDoc },
        },
      });

      if (updateEvents && item.fingerprint) {
        const eventFingerprint = sha1(`news|${item.fingerprint}`);
        eventOps.push({
          updateOne: {
            filter: { fingerprint: eventFingerprint },
            update: { $set: updateDoc },
          },
        });
      }

      if (samples.length < 5) {
        samples.push({
          title: item.title,
          source: item.source,
          url_host: updateDoc.url_host,
          region: updateDoc.region,
          reason: updateDoc.region_reason,
          confidence: updateDoc.region_confidence,
        });
      }
    }

    if (!dryRun) {
      if (newsOps.length) await NewsItem.bulkWrite(newsOps, { ordered: false });
      if (updateEvents && eventOps.length) await EventStream.bulkWrite(eventOps, { ordered: false });
    }

    return NextResponse.json({
      ok: true,
      updated: newsOps.length,
      eventsUpdated: updateEvents ? eventOps.length : 0,
      dryRun,
      samples,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
