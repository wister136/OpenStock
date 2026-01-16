'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { StrategyKey } from '../types';

const STRATEGY_TARGET: Record<StrategyKey, string> = {
  none: '整体交易理念',
  ma5: '均线',
  ma10: '均线',
  ma20: '均线',
  ema20: 'EMA',
  bbands: '布林',
  rsi14: 'RSI',
  macd: 'MACD',
  supertrend: 'SuperTrend',
  atrBreakout: 'ATR',
  turtle: '海龟',
  ichimoku: 'Ichimoku',
  kdj: 'KDJ',
};

export default function StrategyRulesDialog({
  open,
  onOpenChange,
  strategyKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  strategyKey: StrategyKey;
}) {
  const [md, setMd] = useState<string>('');
  const target = STRATEGY_TARGET[strategyKey] || '策略';

  useEffect(() => {
    if (!open) return;
    let aborted = false;
    fetch('/docs/strategy_rules.md')
      .then((r) => r.text())
      .then((t) => {
        if (aborted) return;
        setMd(t);
      })
      .catch(() => {
        if (aborted) return;
        setMd('# 规则文档加载失败\n\n请确认 `public/docs/strategy_rules.md` 是否存在。');
      });
    return () => {
      aborted = true;
    };
  }, [open]);

  // auto scroll to target heading after render
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const root = document.getElementById('strategy-rules-content');
      if (!root) return;

      const headings = root.querySelectorAll('h2, h3');
      const el = Array.from(headings).find((h) => (h.textContent || '').toLowerCase().includes(target.toLowerCase()));
      if (el) {
        el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else {
        root.scrollTop = 0;
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [open, target, md]);

  const components = useMemo(
    () => ({
      h1: ({ children }: any) => <h1 className="text-xl font-semibold text-white mb-3">{children}</h1>,
      h2: ({ children }: any) => <h2 className="text-lg font-semibold text-white mt-5 mb-2">{children}</h2>,
      h3: ({ children }: any) => <h3 className="text-base font-semibold text-white mt-4 mb-2">{children}</h3>,
      p: ({ children }: any) => <p className="text-sm text-gray-200 leading-6 mb-2">{children}</p>,
      li: ({ children }: any) => <li className="text-sm text-gray-200 leading-6">{children}</li>,
      code: ({ children }: any) => <code className="text-[12px] text-gray-100 bg-white/10 px-1 py-0.5 rounded">{children}</code>,
      blockquote: ({ children }: any) => <blockquote className="border-l-2 border-white/20 pl-3 text-gray-300">{children}</blockquote>,
      hr: () => <hr className="border-white/10 my-4" />,
      a: ({ children, href }: any) => (
        <a href={href} className="text-sky-300 hover:text-sky-200 underline" target="_blank" rel="noreferrer">
          {children}
        </a>
      ),
    }),
    []
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[92vw] h-[85vh] p-0 overflow-hidden bg-[#0b1220] border border-white/10">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-white text-sm">策略规则：{strategyKey}</DialogTitle>
          <div className="text-[11px] text-gray-400">自动定位到：{target}</div>
        </DialogHeader>

        <div id="strategy-rules-content" className="px-4 pb-4 overflow-auto h-[calc(85vh-64px)]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {md || '加载中...'}
          </ReactMarkdown>
        </div>
      </DialogContent>
    </Dialog>
  );
}
