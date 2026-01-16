// lib/actions/quotes.actions.ts
// Server-side quote helpers (no TradingView mini/quotes widgets needed).

import { cache } from 'react';

export type SimpleQuote = {
  symbol: string; // e.g. "NASDAQ:NVDA" / "SSE:603516"
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: 'USD' | 'CNY' | string;
  ts: number; // ms
};

function safeNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

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

function toTencentCode(symbol: string): string | null {
  // Tencent quote API expects: sh600000 / sz000001
  const s = normalizeSymbol(symbol);
  const parts = s.split(':');
  if (parts.length !== 2) return null;
  const [ex, code] = parts;
  if (!/^\d{6}$/.test(code)) return null;

  if (ex === 'SSE') return `sh${code}`;
  if (ex === 'SZSE') return `sz${code}`;
  return null;
}

async function fetchTencentQuote(symbol: string): Promise<SimpleQuote | null> {
  const code = toTencentCode(symbol);
  if (!code) return null;

  // Example response (approx): v_sh603516="51~淳中科技~603516~23.13~22.35~23.02~...";
  // We only rely on numeric fields; Chinese name may be GBK and can be ignored.
  const url = `https://qt.gtimg.cn/q=${code}`;

  const res = await fetch(url, {
    // keep it reasonably fresh but avoid hammering
    next: { revalidate: 10 },
    headers: {
      // Some environments are stricter without UA.
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!res.ok) return null;

  const text = await res.text();
  const match = text.match(/="([\s\S]*?)"/);
  if (!match) return null;

  const payload = match[1];
  const parts = payload.split('~');
  // Defensive: the format may vary slightly.
  // Commonly: [3]=current, [4]=prevClose
  const price = safeNumber(parts[3]);
  const prevClose = safeNumber(parts[4]);
  const change = price != null && prevClose != null ? price - prevClose : null;
  const changePercent =
    change != null && prevClose != null && prevClose !== 0 ? (change / prevClose) * 100 : null;

  return {
    symbol: normalizeSymbol(symbol),
    price,
    prevClose,
    change,
    changePercent,
    currency: 'CNY',
    ts: Date.now(),
  };
}

async function fetchStooqQuote(symbol: string): Promise<SimpleQuote | null> {
  // Stooq supports free end-of-day data in CSV.
  // We use it as a "no key" fallback for US tickers.
  // Example: https://stooq.com/q/l/?s=nvda.us&f=sd2t2ohlcv&h&e=csv
  const s = normalizeSymbol(symbol);
  const parts = s.split(':');
  const ticker = (parts.length === 2 ? parts[1] : s).toLowerCase();
  if (!ticker) return null;

  const stooqSymbol = `${ticker}.us`;
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&f=sd2t2ohlcv&h&e=csv`;

  const res = await fetch(url, {
    next: { revalidate: 60 },
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) return null;
  const csv = await res.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  // header: Symbol,Date,Time,Open,High,Low,Close,Volume
  // data : NVDA.US,2026-01-10,22:00:00,....
  const row = lines[lines.length - 1].split(',');
  if (row.length < 8) return null;

  const close = safeNumber(row[6]);
  const open = safeNumber(row[3]);
  const change = close != null && open != null ? close - open : null;
  const changePercent =
    change != null && open != null && open !== 0 ? (change / open) * 100 : null;

  return {
    symbol: s,
    price: close,
    prevClose: open,
    change,
    changePercent,
    currency: 'USD',
    ts: Date.now(),
  };
}

export const getSimpleQuote = cache(async (symbol: string): Promise<SimpleQuote | null> => {
  // CN A-share first (SSE/SZSE), then US fallback (stooq)
  const s = normalizeSymbol(symbol);
  if (s.startsWith('SSE:') || s.startsWith('SZSE:')) {
    try {
      return await fetchTencentQuote(s);
    } catch {
      return null;
    }
  }

  // For US, try Stooq first (no API key).
  try {
    return await fetchStooqQuote(s);
  } catch {
    return null;
  }
});
