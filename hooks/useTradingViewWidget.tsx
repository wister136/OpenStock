'use client';

import { useEffect, useMemo, useRef } from 'react';

function stableStringify(obj: unknown) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

/**
 * Injects TradingView widget script into a container. Re-injects when scriptUrl/height/config changes.
 * We use a stable hash to prevent duplicate injections, and we clear the container when config changes
 * (e.g. locale switch).
 */
export default function useTradingViewWidget(
  scriptUrl: string,
  config: Record<string, unknown>,
  height = 600
) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const configStr = useMemo(() => stableStringify(config), [config]);
  const hash = useMemo(() => `${scriptUrl}::${height}::${configStr}`, [scriptUrl, height, configStr]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Already injected with the same inputs
    if (container.dataset.tvHash === hash) return;

    // Clear previous widget
    container.innerHTML = '';
    delete container.dataset.loaded;
    delete container.dataset.tvHash;

    // TradingView requires this fixed class name
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.width = '100%';
    widgetDiv.style.height = `${height}px`;
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = scriptUrl;
    script.async = true;
    script.innerHTML = configStr;
    container.appendChild(script);

    container.dataset.tvHash = hash;
    container.dataset.loaded = 'true';

    return () => {
      container.innerHTML = '';
      delete container.dataset.loaded;
      delete container.dataset.tvHash;
    };
  }, [hash, scriptUrl, height, configStr]);

  return containerRef;
}
