'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import TradingViewWidget from '@/components/TradingViewWidget';

const scriptBase = 'https://s3.tradingview.com/external-embedding/embed-widget-';

function toTradingViewSymbolPage(symbol: string): string {
  // symbol examples:
  // - NASDAQ:NVDA
  // - NYSE:TSLA (or NASDAQ:TSLA)
  // - SSE:603516
  // - SZSE:002317

  const s = (symbol || '').trim().toUpperCase();
  const parts = s.split(':');
  if (parts.length !== 2) return 'https://www.tradingview.com/';

  const [ex, tk] = parts;
  const slug = `${ex}-${tk}`;

  // CN symbol pages are better localized on cn.tradingview.com
  if (ex === 'SSE' || ex === 'SZSE') return `https://cn.tradingview.com/symbols/${slug}/`;

  return `https://www.tradingview.com/symbols/${slug}/`;
}

function miniSymbolConfig(symbol: string) {
  return {
    symbol,
    width: '100%',
    height: 220,
    locale: 'en', // TradingViewWidget will override based on current language
    dateRange: '12M',
    colorTheme: 'dark',
    isTransparent: true,
    autosize: true,
    largeChartUrl: '',
  };
}

type Props = {
  symbol: string;
  label: string;
};

/**
 * Card behavior:
 * - Click anywhere on the card:
 *   1) Open TradingView symbol page in a NEW TAB
 *   2) Navigate to OpenStock in-site details page in current tab
 */
export default function StockCardDualLink({ symbol, label }: Props) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    // Open TradingView in a new tab (should not be blocked because it's inside a user click)
    try {
      window.open(toTradingViewSymbolPage(symbol), '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
    // Navigate to in-site details
    router.push(`/stocks/${symbol}`);
  }, [router, symbol]);

  return (
    <div
      className="relative cursor-pointer rounded-xl border border-gray-800 bg-[#0F0F0F] p-4"
      onClick={handleClick}
      role="link"
      aria-label={`Open ${label}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
    >
      {/* Widget content */}
      <TradingViewWidget
        title={label}
        scriptUrl={`${scriptBase}mini-symbol-overview.js`}
        config={miniSymbolConfig(symbol)}
        height={220}
      />

      {/* Click overlay to prevent TradingView widget from hijacking click to same-tab redirect */}
      <div className="absolute inset-0 z-10" aria-hidden="true" />
    </div>
  );
}
