'use client';

import React, { useEffect, useRef } from 'react';

type ThemeColors = {
  chartBg: string;
  chartTextMuted: string;
  gridColor: string;
  crosshairColor: string;
  borderColor: string;
};

export default function RSIChart({
  showRSI,
  rsiData,
  themeColors,
  height,
  onChartReady,
}: {
  showRSI: boolean;
  rsiData: Array<{ time: number; value: number }>;
  themeColors: ThemeColors;
  height?: number;
  onChartReady?: (chart: any | null) => void;
}) {
  const { chartBg, chartTextMuted, gridColor, crosshairColor, borderColor } = themeColors;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const linesAddedRef = useRef(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function initRSI() {
      if (!showRSI) {
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch {}
          chartRef.current = null;
          seriesRef.current = null;
          linesAddedRef.current = false;
          onChartReady?.(null);
        }
        return;
      }
      if (!containerRef.current) return;
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {}
        chartRef.current = null;
        seriesRef.current = null;
        linesAddedRef.current = false;
      }

      const { createChart, LineSeries } = await import('lightweight-charts');

      const chart = createChart(containerRef.current, {
        autoSize: true,
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true } },
        layout: {
          background: { color: chartBg },
          textColor: chartTextMuted,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        crosshair: {
          vertLine: { color: crosshairColor, width: 1 },
          horzLine: { color: crosshairColor, width: 1 },
        },
        rightPriceScale: { borderColor },
        timeScale: { visible: false, borderColor },
      });

      const line = chart.addSeries(LineSeries, {
        lineWidth: 2,
        color: 'rgba(59,130,246,0.9)',
        priceLineVisible: false,
        lastValueVisible: true,
      });

      chartRef.current = chart;
      seriesRef.current = line;
      onChartReady?.(chart);

      cleanup = () => {
        // no-op
      };
    }

    initRSI();
    return () => cleanup?.();
  }, [showRSI, chartBg, chartTextMuted, gridColor, crosshairColor, borderColor, onChartReady]);

  useEffect(() => {
    if (!showRSI) return;
    try {
      const s = seriesRef.current;
      if (!s) return;
      s.setData(rsiData);

      if (!linesAddedRef.current) {
        try {
          s.createPriceLine({ price: 70, color: 'rgba(255,255,255,0.18)', lineWidth: 1, lineStyle: 2 });
          s.createPriceLine({ price: 30, color: 'rgba(255,255,255,0.18)', lineWidth: 1, lineStyle: 2 });
        } catch {}
        linesAddedRef.current = true;
      }
    } catch {}
  }, [showRSI, rsiData]);

  if (!showRSI) return null;

  return <div style={height ? { height } : undefined} ref={containerRef} className="w-full mt-2" />;
}
