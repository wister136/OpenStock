'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

type NewsItem = {
  id: string;
  title: string;
  title_zh?: string;
  source_name: string;
  url_host?: string;
  provider?: string;
  url?: string;
  published_at: number;
};

const POLL_MS = 10_000;

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text || '');
}

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

function sourceLabel(item: NewsItem) {
  const name = (item.source_name || '').trim();
  if (name && name !== 'RSS') return name;
  const host = (item.url_host || '').trim();
  if (host) return host.replace(/^www\./, '');
  const provider = (item.provider || '').trim();
  if (provider) {
    try {
      const parsed = new URL(provider);
      return parsed.host.replace(/^www\./, '');
    } catch {
      return provider;
    }
  }
  return '--';
}

export default function HomeNewsSection() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    const res = await fetch('/api/system/news-ingest/status', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.ok) throw new Error('Invalid status');
    setEnabled(Boolean(json.enabled));
  };

  const fetchNews = async () => {
    const res = await fetch('/api/news/latest?limit=6', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.ok) throw new Error('Invalid news response');
    setItems(Array.isArray(json.items) ? json.items : []);
  };

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        await fetchStatus();
        await fetchNews();
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        await fetchNews();
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);

  const onToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      const res = await fetch('/api/system/news-ingest/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.ok) throw new Error('Toggle failed');
      setEnabled(Boolean(json.enabled));
    } catch (e: any) {
      setEnabled(!next);
      setError(String(e?.message ?? e));
    }
  };

  const cards = useMemo(() => {
    if (!items.length) return [];
    return items.map((item) => {
      const rawTitle = (item.title || '').trim();
      const zhTitle = (item.title_zh || '').trim();
      const showTitle = hasChinese(rawTitle) ? rawTitle : hasChinese(zhTitle) ? zhTitle : rawTitle || '--';
      return { ...item, showTitle };
    });
  }, [items]);

  return (
    <section className="grid w-full gap-6 home-section">
      <div className="md:col-span-1 xl:col-span-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xl font-semibold text-gray-100">
          <span>{t('home.news')}</span>
          <Link href="/news" className="text-gray-400 hover:text-gray-200" aria-label={t('home.news')}>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>{enabled ? t('common.enabled') : t('common.disabled')}</span>
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              enabled ? 'bg-emerald-500' : 'bg-gray-600'
            )}
            aria-pressed={enabled}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                enabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>

      <div className="md:col-span-1 xl:col-span-3">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-28 rounded-xl bg-white/5 border border-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && <div className="text-sm text-yellow-400">{error}</div>}

        {!loading && !error && cards.length === 0 && (
          <div className="text-sm text-gray-400">{t('home.newsEmpty')}</div>
        )}

        {!loading && !error && cards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map((item) => (
              <a
                key={item.id}
                href={item.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{timeAgo(item.published_at)}</span>
                  <span className="truncate max-w-[50%]">{sourceLabel(item)}</span>
                </div>
                <div className="mt-2 text-sm text-gray-100 line-clamp-2">{item.showTitle}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
