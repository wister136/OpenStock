import Link from 'next/link';

import { getSimpleQuote } from '@/lib/actions/quotes.actions';

type Props = {
  symbol: string; // e.g. NASDAQ:NVDA / SSE:603516
  label: string; // e.g. NVDA / 603516
  name?: string; // optional display name
};

function tradingViewSymbolPage(symbol: string): string {
  const s = symbol.toUpperCase();
  const parts = s.split(':');
  if (parts.length === 2) {
    const [ex, tk] = parts;
    const slug = `${ex}-${tk}`;
    if (ex === 'SSE' || ex === 'SZSE') return `https://cn.tradingview.com/symbols/${slug}/`;
    return `https://www.tradingview.com/symbols/${slug}/`;
  }
  return 'https://www.tradingview.com/';
}

function formatNumber(n: number | null, digits = 2): string {
  if (n == null) return '--';
  return n.toFixed(digits);
}

export default async function InternalStockCard({ symbol, label, name }: Props) {
  const q = await getSimpleQuote(symbol);
  const isUp = (q?.change ?? 0) > 0;
  const isDown = (q?.change ?? 0) < 0;
  // 规则：涨=红，跌=绿（A股常用配色）
  const changeClass = isUp ? 'text-red-500' : isDown ? 'text-green-500' : 'text-gray-300';

  // ✅ 注意：这个组件是 Server Component（async）。
  // 不能在这里写 onClick 等事件处理器，否则会触发：
  // "Event handlers cannot be passed to Client Component props"。
  // 这里用“覆盖层 Link + 置顶外链按钮”的结构，达到：
  // - 点击卡片任意位置 => 站内详情
  // - 点击 TradingView 按钮 => 新标签打开 TradingView（且不会被覆盖层拦截）

  return (
    <div className="group relative rounded-2xl bg-[#111] border border-white/5 shadow-sm overflow-hidden">
      {/* Click-anywhere internal navigation overlay */}
      <Link
        href={`/stocks/${encodeURIComponent(symbol)}`}
        aria-label={`${label} 详情`}
        className="absolute inset-0 z-10"
      >
        <span className="sr-only">{label} 详情</span>
      </Link>

      {/* Content */}
      <div className="relative z-0 p-5 transition-colors group-hover:bg-white/5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xl font-semibold text-white truncate">{label}</div>
            {name ? <div className="text-xs text-gray-400 truncate mt-1">{name}</div> : null}
          </div>

          {/* External open button (higher z-index than overlay) */}
          <a
            href={tradingViewSymbolPage(symbol)}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-20 shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-200"
            title="在 TradingView 打开"
          >
            TradingView
            <span aria-hidden>↗</span>
          </a>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div className="text-3xl font-semibold text-white">
            {formatNumber(q?.price ?? null, 2)}
            <span className="ml-1 text-xs text-gray-400">{q?.currency ?? ''}</span>
          </div>

          <div className={`text-sm font-medium ${changeClass}`}>
            {q?.change == null ? '--' : `${q.change > 0 ? '+' : ''}${formatNumber(q.change, 2)}`}
            <span className="ml-2">
              {q?.changePercent == null
                ? ''
                : `(${q.changePercent > 0 ? '+' : ''}${formatNumber(q.changePercent, 2)}%)`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
