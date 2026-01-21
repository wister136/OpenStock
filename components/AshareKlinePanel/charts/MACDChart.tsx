'use client';

import React, { useEffect, useRef } from 'react';

type ThemeColors = {
  chartBg: string;
  chartTextMuted: string;
  gridColor: string;
  crosshairColor: string;
  borderColor: string;
};

export default function MACDChart({
  showMACD,
  macdData,
  themeColors,
  height,
  onChartReady,
}: {
  showMACD: boolean;
  macdData: {
    macdHist: Array<{ time: number; value: number; color: string }>;
    macd: Array<{ time: number; value: number }>;
    macdSignal: Array<{ time: number; value: number }>;
  };
  themeColors: ThemeColors;
  height?: number;
  onChartReady?: (chart: any | null) => void;
}) {
  const { chartBg, chartTextMuted, gridColor, crosshairColor, borderColor } = themeColors;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const histSeriesRef = useRef<any>(null);
  const macdLineSeriesRef = useRef<any>(null);
  const macdSignalSeriesRef = useRef<any>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function initMACD() {
      if (!showMACD) {
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch {}
          chartRef.current = null;
          histSeriesRef.current = null;
          macdLineSeriesRef.current = null;
          macdSignalSeriesRef.current = null;
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
        histSeriesRef.current = null;
        macdLineSeriesRef.current = null;
        macdSignalSeriesRef.current = null;
      }

      const { createChart, HistogramSeries, LineSeries } = await import('lightweight-charts');

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

      const hist = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
        priceScaleId: 'right',
      });

      const macdLine = chart.addSeries(LineSeries, {
        lineWidth: 2,
        color: 'rgba(168,85,247,0.9)',
        priceLineVisible: false,
        lastValueVisible: true,
      });
      const signalLine = chart.addSeries(LineSeries, {
        lineWidth: 2,
        color: 'rgba(234,179,8,0.9)',
        priceLineVisible: false,
        lastValueVisible: true,
      });

      chartRef.current = chart;
      histSeriesRef.current = hist;
      macdLineSeriesRef.current = macdLine;
      macdSignalSeriesRef.current = signalLine;
      onChartReady?.(chart);

      cleanup = () => {
        // no-op
      };
    }

    initMACD();
    return () => cleanup?.();
  }, [showMACD, chartBg, chartTextMuted, gridColor, crosshairColor, borderColor, onChartReady]);

  useEffect(() => {
    if (!showMACD) return;
    try {
      histSeriesRef.current?.setData?.(macdData.macdHist);
      macdLineSeriesRef.current?.setData?.(macdData.macd);
      macdSignalSeriesRef.current?.setData?.(macdData.macdSignal);
    } catch {}
  }, [showMACD, macdData]);

  if (!showMACD) return null;

  return <div style={height ? { height } : undefined} ref={containerRef} className="w-full mt-2" />;
}
