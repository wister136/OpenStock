'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

type NewsItem = {
  publishedAt: number;
  title: string;
  source: string;
  url?: string;
  content?: string;
  sentimentScore?: number;
  confidence?: number;
  isMock?: boolean;
};

type ApiResponse = {
  ok: boolean;
  symbol: string;
  serverTime: number;
  items: NewsItem[];
};

export default function ExternalNewsTicker({ symbol }: { symbol: string }) {
  const { t } = useI18n();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [serverTime, setServerTime] = useState<number>(Date.now());
  const [error, setError] = useState(false);
  const lastMaxTsRef = useRef<number>(0);
  const [newSet, setNewSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const pollMsRaw = Number(process.env.NEXT_PUBLIC_NEWS_POLL_INTERVAL_MS ?? 10000);
    const pollMs = Number.isFinite(pollMsRaw) && pollMsRaw > 0 ? pollMsRaw : 10000;

    async function load() {
      try {
        const res = await fetch(`/api/ashare/news/feed?symbol=${encodeURIComponent(symbol)}&limit=20`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as ApiResponse;
        if (!json?.ok || cancelled) return;

        const maxTs = json.items.reduce((m, it) => Math.max(m, it.publishedAt || 0), 0);
        const prevMax = lastMaxTsRef.current;
        const newItems = json.items.filter((it) => it.publishedAt > prevMax);
        lastMaxTsRef.current = Math.max(prevMax, maxTs);
        setNewSet(new Set(newItems.map((it) => it.publishedAt)));
        setItems(json.items);
        setServerTime(json.serverTime || Date.now());
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const id = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  const formatTime = (ts: number) => {
    if (!Number.isFinite(ts)) return '--';
    return new Date(ts).toLocaleTimeString();
  };

  const formatAge = (ts: number) => {
    const ageMs = Math.max(0, serverTime - ts);
    const min = Math.floor(ageMs / 60000);
    return `${min}m`;
  };

  const freshnessLabel = (ts: number) => {
    const ageMs = Math.max(0, serverTime - ts);
    if (ageMs < 10 * 60 * 1000) return { label: t('ashare.news.fresh'), className: 'text-emerald-300' };
    if (ageMs < 60 * 60 * 1000) return { label: t('ashare.news.warm'), className: 'text-yellow-300' };
    return { label: t('ashare.news.stale'), className: 'text-orange-300' };
  };

  const sorted = useMemo(() => [...items].sort((a, b) => b.publishedAt - a.publishedAt), [items]);
  const latestTs = sorted[0]?.publishedAt ?? 0;
  const isDelayed = latestTs > 0 && serverTime - latestTs > 30 * 60 * 1000;
  const pollSec = Math.round((Number(process.env.NEXT_PUBLIC_NEWS_POLL_INTERVAL_MS ?? 10000) || 10000) / 1000);

  return (
    <div className="rounded-xl bg-white/5 border border-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">{t('ashare.news.title')}</div>
        <div className="text-[10px] text-gray-500">{t('ashare.news.refreshEvery', { sec: pollSec })}</div>
      </div>

      {error && <div className="mt-3 text-xs text-yellow-400">News feed unavailable</div>}
      {!error && isDelayed && <div className="mt-2 text-[10px] text-orange-300">数据延迟（最新新闻超过 30 分钟）</div>}

      {!error && (
        <div className="mt-3 max-h-56 overflow-auto space-y-3 pr-1">
          {sorted.length === 0 && <div className="text-xs text-gray-500">暂无新闻</div>}
          {sorted.map((it) => {
            const freshness = freshnessLabel(it.publishedAt);
            const isNew = newSet.has(it.publishedAt);
            return (
              <div key={`${it.publishedAt}-${it.title}`} className="text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{formatTime(it.publishedAt)}</span>
                  <span className="text-gray-400">{it.source}</span>
                  {it.isMock && (
                    <span className="text-[10px] text-amber-300 border border-amber-400/40 rounded px-1">[MOCK]</span>
                  )}
                  {isNew && <span className="text-[10px] text-red-300 border border-red-400/40 rounded px-1">{t('ashare.news.new')}</span>}
                  <span className={cn('text-[10px]', freshness.className)}>
                    {freshness.label} · {formatAge(it.publishedAt)}
                  </span>
                </div>
                <div className="mt-1">
                  {it.url ? (
                    <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-gray-100 hover:underline">
                      {it.title}
                    </a>
                  ) : (
                    <span className="text-gray-100">{it.title}</span>
                  )}
                </div>
                <div className="mt-1 text-[10px] text-gray-500">
                  {t('ashare.news.sentiment')}: {Number.isFinite(it.sentimentScore) ? it.sentimentScore?.toFixed(2) : '--'} ·{' '}
                  confidence: {Number.isFinite(it.confidence) ? it.confidence?.toFixed(2) : '--'}
                </div>
                {it.content && <div className="mt-1 text-[11px] text-gray-500">{it.content}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
