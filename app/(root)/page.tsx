import TradingViewWidget from '@/components/TradingViewWidget';
import SectionTitle from '@/components/SectionTitle';
import InternalStockCard from '@/components/InternalStockCard';
import InternalQuotesTable from '@/components/InternalQuotesTable';
import { HOME_WATCHLIST, MARKET_OVERVIEW_WIDGET_CONFIG } from '@/lib/constants';

const scriptBase = 'https://s3.tradingview.com/external-embedding/embed-widget-';

export default function Home() {
  return (
    <div className="flex min-h-screen home-wrapper">
      {/* Market Overview (only NVDA + TSLA + 3 A-shares) */}
      <section className="grid w-full gap-8 home-section">
        <div className="md:col-span-1 xl:col-span-3">
          <TradingViewWidget
            titleKey="home.marketOverview"
            scriptUrl={`${scriptBase}market-overview.js`}
            config={MARKET_OVERVIEW_WIDGET_CONFIG}
            className="custom-chart"
            height={560}
          />
        </div>
      </section>

      {/* My Stocks: 2 US (NVDA/TSLA) + 3 A-shares (002317/600226/603516) */}
      <section className="grid w-full gap-6 home-section">
        <div className="md:col-span-1 xl:col-span-3">
          <SectionTitle titleKey="home.myStocks" fallback="My Stocks" />
        </div>

        {/* Route A: Render our own cards (price/change colors fully controllable) */}
        <div className="md:col-span-1 xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
          {HOME_WATCHLIST.map((item) => (
            <InternalStockCard
              key={item.symbol}
              symbol={item.symbol}
              label={item.label}
              name={item.name}
            />
          ))}
        </div>
      </section>

      {/* Market Data table (only those 5 tickers) */}
      <section className="grid w-full gap-8 home-section">
        <div className="md:col-span-1 xl:col-span-3">
          <SectionTitle titleKey="home.marketData" fallback="Market Data" />
          <div className="mt-4">
            <InternalQuotesTable rows={HOME_WATCHLIST} />
          </div>
        </div>
      </section>
    </div>
  );
}
