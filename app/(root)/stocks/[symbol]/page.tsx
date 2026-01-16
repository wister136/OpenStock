import Link from 'next/link';

import AshareKlinePanel from '@/components/AshareKlinePanel';
import TradingViewWidget from '@/components/TradingViewWidget';
import WatchlistButton from '@/components/WatchlistButton';
import {
  SYMBOL_INFO_WIDGET_CONFIG,
  CANDLE_CHART_WIDGET_CONFIG,
  BASELINE_WIDGET_CONFIG,
  TECHNICAL_ANALYSIS_WIDGET_CONFIG,
  COMPANY_PROFILE_WIDGET_CONFIG,
  COMPANY_FINANCIALS_WIDGET_CONFIG,
} from '@/lib/constants';

const scriptBase = 'https://s3.tradingview.com/external-embedding/embed-widget-';

function normalizeSymbol(raw: string): string {
  let s = (raw || '').trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    // ignore
  }
  // allow SSE-603516 -> SSE:603516
  if (/^(SSE|SZSE)-\d{6}$/i.test(s)) s = s.replace('-', ':');
  // allow 603516 -> SSE:603516, 002317 -> SZSE:002317
  if (/^\d{6}$/.test(s)) s = s.startsWith('6') ? `SSE:${s}` : `SZSE:${s}`;
  return s.toUpperCase();
}

function tradingViewSymbolPage(symbol: string): string {
  const s = normalizeSymbol(symbol);
  const parts = s.split(':');
  if (parts.length === 2) {
    const [ex, tk] = parts;
    const slug = `${ex}-${tk}`;
    if (ex === 'SSE' || ex === 'SZSE') return `https://cn.tradingview.com/symbols/${slug}/`;
    return `https://www.tradingview.com/symbols/${slug}/`;
  }
  return 'https://www.tradingview.com/';
}

function isAshareSymbol(symbol: string): boolean {
  const s = normalizeSymbol(symbol);
  return s.startsWith('SSE:') || s.startsWith('SZSE:');
}

export default async function StockDetails({
  params,
}: {
  // ✅ Next.js 15: params should be awaited
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  const tvUrl = tradingViewSymbolPage(symbol);

  // Route A: A股详情页用站内渲染（分钟K：5/15/30/60），1分先灰掉
  if (isAshareSymbol(symbol)) {
    return (
      <div className="w-full px-4 py-6">
        <div className="mx-auto w-full max-w-7xl">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-400">
                <Link href="/" className="hover:underline">
                  首页
                </Link>
                <span className="mx-2 text-gray-600">/</span>
                <span className="text-gray-300">{symbol}</span>
              </div>
              <h1 className="text-2xl font-semibold text-white">{symbol}</h1>
            </div>

            <div className="flex items-center gap-3">
              <WatchlistButton symbol={symbol} company={symbol} isInWatchlist={false} />
              <a
                href={tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                title="在 TradingView 打开"
              >
                在 TradingView 打开 ↗
              </a>
            </div>
          </div>

          <div className="mt-6">
            <AshareKlinePanel symbol={symbol} title="K线与成交量（站内渲染）" />
          </div>

          {/* Extra sections (reserved) */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 rounded-2xl border border-white/5 bg-black/20 p-6">
              <h2 className="text-lg font-semibold text-white">日报（预留）</h2>
              <p className="mt-2 text-sm text-gray-400">
                目标：每天收盘后生成 3 只A股的“指标+信号+简报”并邮件发送。当前先跑通数据入库与页面展示。
              </p>
              <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-4">
                <div className="text-sm text-gray-300">下一步会把以下信息写入日报：</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-gray-400 space-y-1">
                  <li>收盘价/涨跌幅（红涨绿跌）</li>
                  <li>MA5/MA10/MA20、RSI、量能</li>
                  <li>简单信号：MA 金叉/死叉、放量/缩量</li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                <div className="px-2 pb-3 pt-1 text-sm text-gray-300">技术分析（TradingView）</div>
                <TradingViewWidget
                  scriptUrl={`${scriptBase}technical-analysis.js`}
                  config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbol)}
                  height={450}
                />
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                <div className="px-2 pb-3 pt-1 text-sm text-gray-300">公司概况（TradingView）</div>
                <TradingViewWidget
                  scriptUrl={`${scriptBase}company-profile.js`}
                  config={COMPANY_PROFILE_WIDGET_CONFIG(symbol)}
                  height={420}
                />
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                <div className="px-2 pb-3 pt-1 text-sm text-gray-300">财务指标（TradingView）</div>
                <TradingViewWidget
                  scriptUrl={`${scriptBase}financials.js`}
                  config={COMPANY_FINANCIALS_WIDGET_CONFIG(symbol)}
                  height={760}
                />
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-6">
                <h2 className="text-lg font-semibold text-white">新闻与资讯（预留）</h2>
                <p className="mt-2 text-sm text-gray-400">
                  后续接入：新闻抓取 / 关键词过滤 / 摘要 / 情绪分析。
                </p>
                <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-4">
                  <div className="text-sm text-gray-300">推荐 MongoDB 结构</div>
                  <pre className="mt-2 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-gray-300">
{`news: {
  symbol: "SSE:603516",
  title: "...",
  source: "...",
  publishedAt: "...",
  url: "...",
  summary: "...",
  sentiment: -1|0|1,
  tags: ["公告","业绩","回购"]
}`}
                  </pre>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // US stocks (keep TradingView widgets)
  return (
    <div className="w-full px-4 py-6">
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-sm text-gray-400">
              <Link href="/" className="hover:underline">
                首页
              </Link>
              <span className="mx-2 text-gray-600">/</span>
              <span className="text-gray-300">{symbol}</span>
            </div>
            <h1 className="text-2xl font-semibold text-white">{symbol}</h1>
          </div>

          <div className="flex items-center gap-3">
            <WatchlistButton symbol={symbol} company={symbol} isInWatchlist={false} />

            <a
              href={tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
              title="在 TradingView 打开"
            >
              在 TradingView 打开 ↗
            </a>
          </div>
        </div>

        {/* Top: Symbol info */}
        <div className="mt-6">
          <TradingViewWidget
            scriptUrl={`${scriptBase}symbol-info.js`}
            config={SYMBOL_INFO_WIDGET_CONFIG(symbol)}
            height={170}
          />
        </div>

        {/* Main layout: Left charts / Right panels */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Left: big charts */}
          <div className="xl:col-span-8 flex flex-col gap-6">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="px-2 pb-3 pt-1 text-sm text-gray-300">K线与成交量</div>
              <TradingViewWidget
                scriptUrl={`${scriptBase}advanced-chart.js`}
                config={CANDLE_CHART_WIDGET_CONFIG(symbol)}
                height={720}
              />
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="px-2 pb-3 pt-1 text-sm text-gray-300">辅助图表（Baseline）</div>
              <TradingViewWidget
                scriptUrl={`${scriptBase}advanced-chart.js`}
                config={BASELINE_WIDGET_CONFIG(symbol)}
                height={520}
              />
            </div>
          </div>

          {/* Right: analysis/financials/profile */}
          <div className="xl:col-span-4 flex flex-col gap-6">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="px-2 pb-3 pt-1 text-sm text-gray-300">技术分析</div>
              <TradingViewWidget
                scriptUrl={`${scriptBase}technical-analysis.js`}
                config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbol)}
                height={450}
              />
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="px-2 pb-3 pt-1 text-sm text-gray-300">公司概况</div>
              <TradingViewWidget
                scriptUrl={`${scriptBase}company-profile.js`}
                config={COMPANY_PROFILE_WIDGET_CONFIG(symbol)}
                height={420}
              />
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="px-2 pb-3 pt-1 text-sm text-gray-300">财务指标</div>
              <TradingViewWidget
                scriptUrl={`${scriptBase}financials.js`}
                config={COMPANY_FINANCIALS_WIDGET_CONFIG(symbol)}
                height={760}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
