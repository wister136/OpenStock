const { connectToDatabase } = require('../database/mongoose');
const NewsItem = require('../database/models/NewsItem').default ?? require('../database/models/NewsItem');
const { translateTitle } = require('../lib/translateTitle');

type Args = { days: number; limit: number };

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const res: Args = { days: 10, limit: 500 };
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const val = args[i + 1];
    if (key === '--days' && val) res.days = Math.max(1, Number(val));
    if (key === '--limit' && val) res.limit = Math.max(1, Number(val));
  }
  return res;
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

async function main() {
  const { days, limit } = parseArgs();
  const now = Date.now();
  const since = now - days * 24 * 60 * 60 * 1000;

  await connectToDatabase();

  const cursor = NewsItem.find(
    { publishedAt: { $gte: since }, isMock: { $ne: true } },
    { title: 1, title_en: 1, publishedAt: 1 }
  )
    .sort({ publishedAt: -1 })
    .limit(limit)
    .cursor();

  let scanned = 0;
  let updated = 0;
  const bulkOps: any[] = [];

  for await (const doc of cursor) {
    scanned += 1;
    const title = typeof doc.title === 'string' ? doc.title.trim() : '';
    const titleEn = typeof doc.title_en === 'string' ? doc.title_en.trim() : '';
    if (!title) continue;
    if (hasChinese(title)) continue; // only backfill English titles
    if (titleEn && titleEn !== title) continue; // already translated

    const translated = await translateTitle(title);
    if (!translated || translated === title) continue;

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { title_en: translated } },
      },
    });

    if (bulkOps.length >= 50) {
      const res = await NewsItem.bulkWrite(bulkOps, { ordered: false });
      updated += res.modifiedCount ?? 0;
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length) {
    const res = await NewsItem.bulkWrite(bulkOps, { ordered: false });
    updated += res.modifiedCount ?? 0;
  }

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
