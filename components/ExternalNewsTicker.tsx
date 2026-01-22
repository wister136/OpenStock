'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

type EventItem = {
  id: string;
  type: 'news' | 'market' | 'system';
  ts: number;
  source: string;
  isMock?: boolean;
  title: string;
  title_zh?: string;
  subtitle?: string;
  sentimentScore?: number;
  confidence?: number;
  l2Reason?: string;
  url?: string;
  trigger?: string;
  timeframe?: string;
  changePct?: number;
  volRatio?: number;
  level?: 'info' | 'warn' | 'error';
};

type ApiResponse = {
  ok: boolean;
  symbol: string;
  serverTime: number;
  items: EventItem[];
};

export default function ExternalNewsTicker({
  symbol,
  className,
  listClassName,
  fill,
}: {
  symbol: string;
  className?: string;
  listClassName?: string;
  fill?: boolean;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<EventItem[]>([]);
  const [serverTime, setServerTime] = useState<number>(Date.now());
  const [error, setError] = useState(false);
  const lastMaxTsRef = useRef<number>(0);
  const [newSet, setNewSet] = useState<Set<string>>(new Set());

  const hasChinese = (text: string) => /[\u4e00-\u9fff]/.test(text || '');

  useEffect(() => {
    let cancelled = false;
    const pollMsRaw = Number(process.env.NEXT_PUBLIC_NEWS_POLL_INTERVAL_MS ?? 10000);
    const pollMs = Number.isFinite(pollMsRaw) && pollMsRaw > 0 ? pollMsRaw : 10000;

    async function load() {
      try {
        const primaryRes = await fetch(`/api/ashare/events/feed?symbol=${encodeURIComponent(symbol)}&limit=20`, { cache: 'no-store' });
        if (!primaryRes.ok) throw new Error(String(primaryRes.status));
        let json = (await primaryRes.json()) as ApiResponse;
        if (!json?.ok) throw new Error('Invalid response');

        if (json.items.length === 0 && symbol !== 'GLOBAL') {
          const fallbackRes = await fetch(`/api/ashare/events/feed?symbol=GLOBAL&limit=20`, { cache: 'no-store' });
          if (fallbackRes.ok) {
            const fallbackJson = (await fallbackRes.json()) as ApiResponse;
            if (fallbackJson?.ok) json = fallbackJson;
          }
        }
        if (!json?.ok || cancelled) return;

        const maxTs = json.items.reduce((m, it) => Math.max(m, it.ts || 0), 0);
        const prevMax = lastMaxTsRef.current;
        const newItems = json.items.filter((it) => it.ts > prevMax);
        lastMaxTsRef.current = Math.max(prevMax, maxTs);
        setNewSet(new Set(newItems.map((it) => it.id)));
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
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatAge = (ts: number) => {
    const ageMs = Math.max(0, serverTime - ts);
    const min = Math.floor(ageMs / 60000);
    return `${min}m`;
  };

  const freshnessLabel = (ts: number) => {
    const ageMs = Math.max(0, serverTime - ts);
    if (ageMs < 10 * 60 * 1000) return { label: t('ashare.news.fresh'), className: 'text-emerald-700 dark:text-emerald-300' };
    if (ageMs < 60 * 60 * 1000) return { label: t('ashare.news.warm'), className: 'text-yellow-700 dark:text-yellow-300' };
    return { label: t('ashare.news.stale'), className: 'text-orange-700 dark:text-orange-300' };
  };

  const formatL2Reason = (reason?: string) => {
    if (!reason) return null;
    const map: Record<string, string> = {
      below_threshold: 'ashare.events.l2.reason.below_threshold',
      budget_exceeded: 'ashare.events.l2.reason.budget_exceeded',
      input_tokens_exceeded: 'ashare.events.l2.reason.input_tokens_exceeded',
      output_tokens_exceeded: 'ashare.events.l2.reason.output_tokens_exceeded',
      budget_blocked: 'ashare.events.l2.reason.budget_exceeded',
      llm_error: 'ashare.events.l2.reason.llm_error',
    };
    const key = map[reason] ?? 'ashare.events.l2.reason.llm_error';
    return `${t('ashare.events.l2.label')}: ${t(key)}`;
  };

  const sorted = useMemo(() => [...items].sort((a, b) => b.ts - a.ts), [items]);
  const latestTs = sorted[0]?.ts ?? 0;
  const now = new Date(serverTime);
  const day = now.getDay();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const isTradingDay = day !== 0 && day !== 6;
  const isTradingSession =
    isTradingDay &&
    ((minuteOfDay >= 9 * 60 + 30 && minuteOfDay <= 11 * 60 + 30) || (minuteOfDay >= 13 * 60 && minuteOfDay <= 15 * 60));
  const staleMs = isTradingSession ? 45 * 60 * 1000 : 8 * 60 * 60 * 1000;
  const isDelayed = latestTs > 0 && serverTime - latestTs > staleMs;
  const pollSec = Math.round((Number(process.env.NEXT_PUBLIC_NEWS_POLL_INTERVAL_MS ?? 10000) || 10000) / 1000);

  const listCls = cn(
    'mt-3 overflow-auto space-y-3 pr-1',
    fill ? 'flex-1 min-h-0 max-h-none' : 'max-h-56',
    listClassName
  );

  return (
    <div className={cn('rounded-xl bg-white/5 border border-white/5 p-4 flex flex-col', fill && 'h-full min-h-0', className)}>
      <div className="flex items-center justify-between">
        <div className="text-base text-slate-900 dark:text-slate-100">{t('ashare.news.title')}</div>
        <div className="text-sm text-slate-700 dark:text-slate-300">{t('ashare.news.refreshEvery', { sec: pollSec })}</div>
      </div>

      {error && <div className="mt-3 text-sm text-yellow-400">{t('ashare.news.unavailable')}</div>}
      {!error && !isDelayed && <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{t('ashare.events.live')}</div>}
      {!error && isDelayed && <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">{t('ashare.events.delayed')}</div>}

      {!error && (
        <div className={listCls}>
          {sorted.length === 0 && <div className="text-sm text-slate-600 dark:text-slate-300">{t('ashare.news.empty')}</div>}
          {sorted.map((it) => {
            const freshness = freshnessLabel(it.ts);
            const isNew = newSet.has(it.id);
            const rawTitle = (it.title || '').trim();
            const zhTitle = (it.title_zh || '').trim();
            const showTitle = hasChinese(rawTitle) ? rawTitle : hasChinese(zhTitle) ? zhTitle : rawTitle || '--';
            const typeBadge =
              it.type === 'news'
                ? { label: t('ashare.events.type.news'), cls: 'text-sky-700 dark:text-sky-300 border-sky-400/40 bg-sky-500/10' }
                : it.type === 'market'
                  ? { label: t('ashare.events.type.market'), cls: 'text-amber-700 dark:text-amber-300 border-amber-400/40 bg-amber-500/10' }
                  : { label: t('ashare.events.type.system'), cls: 'text-slate-700 dark:text-slate-300 border-white/10 bg-white/5' };
            const sentimentTone =
              Number.isFinite(it.sentimentScore) && it.sentimentScore != null
                ? it.sentimentScore > 0.15
                  ? 'text-emerald-700 dark:text-emerald-200'
                  : it.sentimentScore < -0.15
                    ? 'text-rose-700 dark:text-rose-200'
                    : 'text-slate-800 dark:text-gray-100'
                : 'text-slate-800 dark:text-gray-100';
            const l2Note = it.type === 'news' ? formatL2Reason(it.l2Reason) : null;
            return (
              <div key={it.id} className="text-base text-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{formatTime(it.ts)}</span>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded border', typeBadge.cls)}>{typeBadge.label}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{it.source}</span>
                  {it.isMock && (
                    <span className="text-xs text-amber-700 dark:text-amber-300 border border-amber-400/40 rounded px-1">[MOCK]</span>
                  )}
                  {isNew && <span className="text-xs text-red-700 dark:text-red-300 border border-red-400/40 rounded px-1">{t('ashare.news.new')}</span>}
                  <span className={cn('text-xs', freshness.className)}>
                    {freshness.label} · {formatAge(it.ts)}
                  </span>
                </div>
                <div className={cn('mt-1 text-base', sentimentTone)}>
                  {it.url ? (
                    <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-slate-900 dark:text-slate-100 hover:underline">
                      {showTitle}
                    </a>
                  ) : (
                    <span>{showTitle}</span>
                  )}
                </div>
                {it.subtitle && <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">{it.subtitle}</div>}
                {it.type === 'news' && (
                  <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {t('ashare.news.sentiment')}: {Number.isFinite(it.sentimentScore) ? it.sentimentScore?.toFixed(2) : '--'} ·{' '}
                    {t('ashare.events.confidence')}: {Number.isFinite(it.confidence) ? it.confidence?.toFixed(2) : '--'}
                    {l2Note && <> · {l2Note}</>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
