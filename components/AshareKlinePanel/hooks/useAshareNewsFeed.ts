import { useCallback, useEffect, useState } from 'react';

import type { NewsFeedItem } from '../types';
import { getEventsFeed } from '../services/ashareApi';
import { getTranslateStats } from '../services/translateApi';

export function useAshareNewsFeed(newsDlgOpen: boolean, symbol: string) {
  const [newsItems, setNewsItems] = useState<NewsFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translateCount, setTranslateCount] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reloadNews = useCallback(() => {
    setReloadToken((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!newsDlgOpen) return;
    let cancelled = false;

    async function loadNews() {
      setLoading(true);
      setError(null);
      try {
        const res = await getEventsFeed(symbol, 30);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json?.ok) throw new Error('Invalid response');
        const items = Array.isArray(json.items)
          ? (json.items as any[])
              .filter((it) => it?.type === 'news')
              .map(
                (it): NewsFeedItem => ({
                  title: String(it.title || ''),
                  title_en: typeof it.title === 'string' ? it.title : undefined,
                  title_zh: typeof it.title_zh === 'string' ? it.title_zh : undefined,
                  source: String(it.source || ''),
                  url: typeof it.url === 'string' ? it.url : undefined,
                  publishedAt: Number(it.ts ?? it.publishedAt ?? 0),
                  sentimentScore: typeof it.sentimentScore === 'number' ? it.sentimentScore : undefined,
                  confidence: typeof it.confidence === 'number' ? it.confidence : undefined,
                })
              )
          : [];
        if (!cancelled) setNewsItems(items);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadStats() {
      try {
        const res = await getTranslateStats();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const total = Number(json?.stats?.total);
        if (!cancelled) setTranslateCount(Number.isFinite(total) ? total : 0);
      } catch {
        if (!cancelled) setTranslateCount(null);
      }
    }

    loadNews();
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [newsDlgOpen, symbol, reloadToken]);

  return { newsItems, loading, error, translateCount, reloadNews };
}
