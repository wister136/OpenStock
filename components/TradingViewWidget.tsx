'use client';

import React, { memo, useMemo } from 'react';
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

  const finalConfig = useMemo(() => {
    // Always force TradingView widget locale to follow our i18n toggle.
    // (Most configs ship with `locale: 'en'` by default, so we must override.)
    return { ...config, locale: tvLocale };
  }, [config, tvLocale]);

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
