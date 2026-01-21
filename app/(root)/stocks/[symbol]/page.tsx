import Link from 'next/link';

import AshareKlinePanel from '@/components/AshareKlinePanel';
import ResonanceRecommendationCard from '@/components/ResonanceRecommendationCard';
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
import { tServer } from '@/lib/i18n/server';

const scriptBase = 'https://s3.tradingview.com/external-embedding/embed-widget-';

const ASHARE_NAME_MAP: Record<string, string> = {
  'SSE:600226': '亨通股份',
  'SSE:603516': '淳中科技',
};

function normalizeSymbol(raw: string): string {
  let s = (raw || '').trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    // ignore
  }
  if (/^(SSE|SZSE)-\d{6}$/i.test(s)) s = s.replace('-', ':');
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
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  const tvUrl = tradingViewSymbolPage(symbol);
  const companyName = ASHARE_NAME_MAP[symbol];
  const labels = {
    home: await tServer('stock.home'),
    openTradingView: await tServer('stock.openTradingView'),
    klineTitle: await tServer('stock.klineTitle'),
    reportTitle: await tServer('stock.reportTitle'),
    reportDesc: await tServer('stock.reportDesc'),
    reportNext: await tServer('stock.reportNext'),
    reportItem1: await tServer('stock.reportItem1'),
    reportItem2: await tServer('stock.reportItem2'),
    reportItem3: await tServer('stock.reportItem3'),
    taPanel: await tServer('stock.taPanel'),
    profilePanel: await tServer('stock.profilePanel'),
    financialPanel: await tServer('stock.financialPanel'),
    newsTitle: await tServer('stock.newsTitle'),
    newsDesc: await tServer('stock.newsDesc'),
    mongoHint: await tServer('stock.mongoHint'),
    klinePanel: await tServer('stock.klinePanel'),
    baselinePanel: await tServer('stock.baselinePanel'),
  };

  if (isAshareSymbol(symbol)) {
    return (
      <div className="w-full px-0 py-6">
        <div className="w-full">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-gray-400">
                <Link href="/" className="hover:underline">
                  {labels.home}
                </Link>
                <span className="mx-2 text-gray-600">/</span>
                <span className="text-gray-300">
                  {symbol}
                  {companyName ? ` ${companyName}` : ''}
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-white">{companyName ? `${symbol} ${companyName}` : symbol}</h1>
            </div>

            <div className="flex items-center gap-3">
              <WatchlistButton symbol={symbol} company={companyName ?? symbol} isInWatchlist={false} />
              <a
                href={tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                title={labels.openTradingView}
              >
                {labels.openTradingView} ↗
              </a>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <ResonanceRecommendationCard symbol={symbol} />
            <AshareKlinePanel symbol={symbol} title={labels.klineTitle} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 rounded-2xl border border-white/5 bg-black/20 p-6">
              <h2 className="text-lg font-semibold text-white">{labels.reportTitle}</h2>
              <p className="mt-2 text-sm text-gray-400">{labels.reportDesc}</p>
              <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-4">
                <div className="text-sm text-gray-300">{labels.reportNext}</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-gray-400 space-y-1">
                  <li>{labels.reportItem1}</li>
                  <li>{labels.reportItem2}</li>
                  <li>{labels.reportItem3}</li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                <div className="px-2 pb-3 pt-1 text-sm text-gray-300">{labels.taPanel}</div>
                <TradingViewWidget
                  scriptUrl={`${scriptBase}technical-analysis.js`}
                  config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbol)}
                  height={450}
                />
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                <div className="px-2 pb-3 pt-1 text-sm text-gray-300">{labels.profilePanel}</div>
                <TradingViewWidget
                  scriptUrl={`${scriptBase}company-profile.js`}
                  config={COMPANY_PROFILE_WIDGET_CONFIG(symbol)}
                  height={420}
                />
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                <div className="px-2 pb-3 pt-1 text-sm text-gray-300">{labels.financialPanel}</div>
                <TradingViewWidget
                  scriptUrl={`${scriptBase}financials.js`}
                  config={COMPANY_FINANCIALS_WIDGET_CONFIG(symbol)}
                  height={760}
                />
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/20 p-6">
                <h2 className="text-lg font-semibold text-white">{labels.newsTitle}</h2>
                <p className="mt-2 text-sm text-gray-400">{labels.newsDesc}</p>
                <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-4">
                  <div className="text-sm text-gray-300">{labels.mongoHint}</div>
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

  return (
    <div className="w-full px-0 py-6">
      <div className="w-full">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-sm text-gray-400">
              <Link href="/" className="hover:underline">
                {labels.home}
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
              title={labels.openTradingView}
            >
              {labels.openTradingView} ↗
            </a>
          </div>
        </div>

        <div className="mt-6">
          <TradingViewWidget
            scriptUrl={`${scriptBase}symbol-info.js`}
            config={SYMBOL_INFO_WIDGET_CONFIG(symbol)}
            height={170}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8 flex flex-col gap-6">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="px-2 pb-3 pt-1 text-sm text-gray-300">{labels.klinePanel}</div>
              <TradingViewWidget
                scriptUrl={`${scriptBase}advanced-chart.js`}
                config={CANDLE_CHART_WIDGET_CONFIG(symbol)}
                height={720}
              />
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="px-2 pb-3 pt-1 text-sm text-gray-300">{labels.baselinePanel}</div>
              <TradingViewWidget
                scriptUrl={`${scriptBase}advanced-chart.js`}
                config={BASELINE_WIDGET_CONFIG(symbol)}
                height={520}
              />
            </div>
          </div>

          <div className="xl:col-span-4 flex flex-col gap-6">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="px-2 pb-3 pt-1 text-sm text-gray-300">{labels.taPanel}</div>
              <TradingViewWidget
                scriptUrl={`${scriptBase}technical-analysis.js`}
                config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbol)}
                height={450}
              />
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="px-2 pb-3 pt-1 text-sm text-gray-300">{labels.profilePanel}</div>
              <TradingViewWidget
                scriptUrl={`${scriptBase}company-profile.js`}
                config={COMPANY_PROFILE_WIDGET_CONFIG(symbol)}
                height={420}
              />
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="px-2 pb-3 pt-1 text-sm text-gray-300">{labels.financialPanel}</div>
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
