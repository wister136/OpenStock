import Link from 'next/link';

import { connectToDatabase } from '@/database/mongoose';
import NewsItem from '@/database/models/NewsItem';

function timeAgo(ts: number) {
  if (!Number.isFinite(ts)) return '--';
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  return `${day} 天前`;
}

export default async function NewsPage() {
  await connectToDatabase();
  const items = await NewsItem.find({ isMock: { $ne: true } }).sort({ publishedAt: -1 }).limit(200).lean();

  return (
    <div className="flex min-h-screen home-wrapper">
      <section className="grid w-full gap-6 home-section">
        <div className="md:col-span-1 xl:col-span-3">
          <div className="text-3xl font-bold text-gray-100">新闻</div>
        </div>

        <div className="md:col-span-1 xl:col-span-3 rounded-xl border border-white/10 bg-white/5">
          <div className="grid grid-cols-[110px_1fr_160px] gap-4 px-4 py-3 text-xs text-gray-400 border-b border-white/10">
            <div>时间</div>
            <div>标题</div>
            <div>提供商</div>
          </div>
          {items.length === 0 && <div className="px-4 py-6 text-sm text-gray-400">暂无新闻</div>}
          {items.map((item: any) => (
            <div key={String(item._id)} className="grid grid-cols-[110px_1fr_160px] gap-4 px-4 py-3 border-b border-white/5">
              <div className="text-xs text-gray-400">{timeAgo(item.publishedAt)}</div>
              <div className="text-sm text-gray-100">
                {item.url ? (
                  <Link href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {item.title_zh || item.title || '--'}
                  </Link>
                ) : (
                  <span>{item.title_zh || item.title || '--'}</span>
                )}
              </div>
              <div className="text-xs text-gray-400">{item.source || '--'}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
