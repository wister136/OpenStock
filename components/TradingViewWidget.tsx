'use client';

import React, { memo, useMemo } from 'react';
import { useTheme } from 'next-themes';
import useTradingViewWidget from '@/hooks/useTradingViewWidget';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface TradingViewWidgetProps {
  title?: string;
  titleKey?: string;
  scriptUrl: string;
  config: Record<string, unknown>;
  height?: number;
  className?: string;
}

const TradingViewWidget = ({
  title,
  titleKey,
  scriptUrl,
  config,
  height = 600,
  className,
}: TradingViewWidgetProps) => {
  const { t, tvLocale } = useI18n();
  const { theme } = useTheme();

  const finalConfig = useMemo(() => {
    // Always force TradingView widget locale to follow our i18n toggle.
    // (Most configs ship with `locale: 'en'` by default, so we must override.)
    const base = { ...config, locale: tvLocale } as Record<string, unknown>;
    const transparentValue = base.isTransparent;
    const isTransparent =
      transparentValue === true || transparentValue === 'true' || transparentValue === '1';
    if (theme === 'light') {
      if ('colorTheme' in base) base.colorTheme = 'light';
      if ('theme' in base) base.theme = 'light';
      if ('backgroundColor' in base) base.backgroundColor = '#f8fafc';
      if ('gridColor' in base) base.gridColor = '#e2e8f0';
      if ('scaleFontColor' in base) base.scaleFontColor = '#334155';
      if ('symbolActiveColor' in base) base.symbolActiveColor = 'rgba(14, 116, 144, 0.08)';
      if (isTransparent) base.isTransparent = false;
    } else if (theme === 'dark') {
      if ('colorTheme' in base) base.colorTheme = 'dark';
      if ('theme' in base) base.theme = 'dark';
      if ('backgroundColor' in base) base.backgroundColor = '#141414';
      if ('gridColor' in base) base.gridColor = 'rgba(255,255,255,0.06)';
      if ('scaleFontColor' in base) base.scaleFontColor = '#cbd5e1';
      if ('symbolActiveColor' in base) base.symbolActiveColor = 'rgba(15, 237, 190, 0.08)';
      if (isTransparent) base.isTransparent = false;
    }
    return base;
  }, [config, tvLocale, theme]);

  const containerRef = useTradingViewWidget(scriptUrl, finalConfig, height);

  const displayTitle = titleKey ? t(titleKey) : title;

  return (
    <div className="w-full">
      {displayTitle && (
        <h3 className="font-semibold text-2xl text-gray-100 mb-5">{displayTitle}</h3>
      )}
      <div className={cn('tradingview-widget-container', className)} ref={containerRef}>
        {/* The hook will inject the widget container + script */}
      </div>
    </div>
  );
};

export default memo(TradingViewWidget);
