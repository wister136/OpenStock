'use client';

import React, { useEffect, useRef, useState } from 'react';

import type { OHLCVBar } from '@/lib/indicators';
import type { Marker, OverlayMarker } from '../types';

type ThemeColors = {
  chartBg: string;
  chartText: string;
  gridColor: string;
  crosshairColor: string;
  borderColor: string;
};

type IndicatorLine = Array<{ time: number; value: number }>;
type IndicatorData = {
  ma5?: IndicatorLine | null;
  ma10?: IndicatorLine | null;
  ma20?: IndicatorLine | null;
  ema20?: IndicatorLine | null;
  bbUpper?: IndicatorLine | null;
  bbMid?: IndicatorLine | null;
  bbLower?: IndicatorLine | null;
};

type MarkerLabels = { buy: string; sell: string };

export default function MainChart({
  bars,
  indicatorData,
  markers,
  overlayMarkers,
  themeColors,
  height,
  freq,
  showMarkers = true,
  markerLabels = { buy: 'BUY', sell: 'SELL' },
  onChartReady,
  onCrosshairMove,
}: {
  bars: OHLCVBar[];
  indicatorData: IndicatorData;
  markers?: Marker[];
  overlayMarkers?: OverlayMarker[];
  themeColors: ThemeColors;
  height?: number;
  freq?: string;
  showMarkers?: boolean;
  markerLabels?: MarkerLabels;
  onChartReady?: (chart: any | null) => void;
  onCrosshairMove?: (param: any) => void;
}) {
  const { chartBg, chartText, gridColor, crosshairColor, borderColor } = themeColors;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  const ma5SeriesRef = useRef<any>(null);
  const ma10SeriesRef = useRef<any>(null);
  const ma20SeriesRef = useRef<any>(null);
  const ema20SeriesRef = useRef<any>(null);

  const bbUpperSeriesRef = useRef<any>(null);
  const bbMidSeriesRef = useRef<any>(null);
  const bbLowerSeriesRef = useRef<any>(null);

  const [chartsEpoch, setChartsEpoch] = useState(0);
  const [computedOverlay, setComputedOverlay] = useState<OverlayMarker[]>([]);

  const bumpChartsEpoch = () => setChartsEpoch((v) => v + 1);

  const overlay = overlayMarkers ?? computedOverlay;

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init() {
      if (!containerRef.current) return;

      const { createChart, CandlestickSeries, HistogramSeries } = await import('lightweight-charts');

      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {}
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }

      const chart = createChart(containerRef.current, {
        autoSize: true,
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: {
            time: true,
            price: true,
          },
          mouseWheel: true,
          pinch: true,
        },
        layout: {
          background: { color: chartBg },
          textColor: chartText,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        crosshair: {
          vertLine: { color: crosshairColor, width: 1 },
          horzLine: { color: crosshairColor, width: 1 },
        },
        rightPriceScale: {
          borderColor,
        },
        timeScale: {
          borderColor,
        },
      });

      const candles = chart.addSeries(CandlestickSeries, {
        upColor: '#ef4444',
        downColor: '#22c55e',
        borderUpColor: '#ef4444',
        borderDownColor: '#22c55e',
        wickUpColor: '#ef4444',
        wickDownColor: '#22c55e',
      });

      const volume = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      volume.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      chartRef.current = chart;
      candleSeriesRef.current = candles;
      volumeSeriesRef.current = volume;
      onChartReady?.(chart);

      const el = containerRef.current;
      const onClickCapture = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const a = target.closest?.('a');
        if (a) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      const onWheelCapture = (e: WheelEvent) => {
        if (e.ctrlKey) return;
        e.preventDefault();
      };
      el.addEventListener('click', onClickCapture, { capture: true } as any);
      el.addEventListener('wheel', onWheelCapture, { capture: true, passive: false } as any);

      cleanup = () => {
        el.removeEventListener('click', onClickCapture, { capture: true } as any);
        el.removeEventListener('wheel', onWheelCapture, { capture: true } as any);
      };

      bumpChartsEpoch();
    }

    init();
    return () => {
      cleanup?.();
      onChartReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartBg, chartText, crosshairColor, gridColor, borderColor]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const isIntraday = freq !== '1d';
    const pad2 = (v: number) => String(v).padStart(2, '0');
    const formatTick = (time: any) => {
      if (typeof time === 'number') {
        const d = new Date(time * 1000);
        if (!Number.isFinite(d.getTime())) return '';
        const date = `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
        const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        return isIntraday
          ? `${date} ${clock}`
          : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      }
      if (time && typeof time === 'object') {
        const y = (time as any).year;
        const m = (time as any).month;
        const day = (time as any).day;
        if (y && m && day) return `${y}-${pad2(m)}-${pad2(day)}`;
      }
      return '';
    };

    chart.applyOptions({
      timeScale: {
        borderColor,
        timeVisible: isIntraday,
        secondsVisible: false,
        tickMarkFormatter: formatTick,
      },
    });
  }, [chartsEpoch, freq, borderColor]);

  useEffect(() => {
    let cancelled = false;

    async function syncOverlay() {
      const chart = chartRef.current;
      if (!chart) return;

      const { LineSeries } = await import('lightweight-charts');
      if (cancelled) return;

      const ensure = (ref: React.MutableRefObject<any>, opts: any) => {
        if (ref.current) return ref.current;
        ref.current = chart.addSeries(LineSeries, {
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          ...opts,
        });
        return ref.current;
      };

      const remove = (ref: React.MutableRefObject<any>) => {
        if (!ref.current) return;
        try {
          chart.removeSeries(ref.current);
        } catch {}
        ref.current = null;
      };

      if (indicatorData.ma5?.length) ensure(ma5SeriesRef, { color: 'rgba(59,130,246,0.9)' }).setData(indicatorData.ma5);
      else remove(ma5SeriesRef);

      if (indicatorData.ma10?.length) ensure(ma10SeriesRef, { color: 'rgba(234,179,8,0.9)' }).setData(indicatorData.ma10);
      else remove(ma10SeriesRef);

      if (indicatorData.ma20?.length) ensure(ma20SeriesRef, { color: 'rgba(168,85,247,0.9)' }).setData(indicatorData.ma20);
      else remove(ma20SeriesRef);

      if (indicatorData.ema20?.length) ensure(ema20SeriesRef, { color: 'rgba(34,197,94,0.9)', lineStyle: 2 }).setData(indicatorData.ema20);
      else remove(ema20SeriesRef);

      if (indicatorData.bbUpper?.length || indicatorData.bbMid?.length || indicatorData.bbLower?.length) {
        if (indicatorData.bbUpper?.length) ensure(bbUpperSeriesRef, { color: 'rgba(148,163,184,0.75)', lineWidth: 1 }).setData(indicatorData.bbUpper);
        if (indicatorData.bbMid?.length) ensure(bbMidSeriesRef, { color: 'rgba(148,163,184,0.55)', lineWidth: 1, lineStyle: 2 }).setData(indicatorData.bbMid);
        if (indicatorData.bbLower?.length) ensure(bbLowerSeriesRef, { color: 'rgba(148,163,184,0.75)', lineWidth: 1 }).setData(indicatorData.bbLower);
      } else {
        remove(bbUpperSeriesRef);
        remove(bbMidSeriesRef);
        remove(bbLowerSeriesRef);
      }
    }

    syncOverlay();
    return () => {
      cancelled = true;
    };
  }, [indicatorData]);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const candles = candleSeriesRef.current;
        const volume = volumeSeriesRef.current;
        if (!candles || !volume) return;

        const candleData = bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
        const volumeData = bars.map((b) => ({
          time: b.t,
          value: b.v,
          color: b.c >= b.o ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)',
        }));

        candles.setData(candleData);
        volume.setData(volumeData);

        if (!cancelled) chartRef.current?.timeScale()?.fitContent?.();
      } catch {}
    }

    void sync();
    return () => {
      cancelled = true;
    };
  }, [bars, markers, chartsEpoch]);

  useEffect(() => {
    if (overlayMarkers) return;
    const chart = chartRef.current;
    const candles = candleSeriesRef.current;
    if (!chart || !candles || !showMarkers) return;

    const timeScale = chart.timeScale();
    const barsByTime = new Map<number, OHLCVBar>();
    for (const b of bars) barsByTime.set(b.t, b);

    let raf = 0;
    const calc = () => {
      raf = 0;

      const rect = containerRef.current?.getBoundingClientRect();
      const maxY = rect?.height ?? 0;

      const next: OverlayMarker[] = [];
      const list = (markers ?? []) as Marker[];

      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        const t = Number((m as any).time);
        if (!Number.isFinite(t)) continue;

        const x = timeScale.timeToCoordinate(t as any);
        if (x == null) continue;

        const bar = barsByTime.get(t);
        const basePrice = bar ? (m.position === 'aboveBar' ? bar.h : bar.l) : null;

        const y0 = basePrice != null ? candles.priceToCoordinate(basePrice) : null;
        if (y0 == null) continue;

        const y = m.position === 'aboveBar' ? y0 - 18 : y0 + 18;

        if (maxY && (y < 0 || y > maxY)) continue;

        next.push({
          ...(m as any),
          x,
          y,
          side: (m.side ??
            ((typeof m.text === 'string' && (m.text.includes('Тє') || m.text.toUpperCase().includes('SELL'))) ? 'SELL' : 'BUY')) as
            | 'BUY'
            | 'SELL',
          key: `${t}-${m.text}-${i}`,
        });
      }

      setComputedOverlay(next);
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(calc);
    };

    schedule();
    timeScale.subscribeVisibleTimeRangeChange(schedule);
    timeScale.subscribeVisibleLogicalRangeChange(schedule);
    window.addEventListener('resize', schedule);

    return () => {
      timeScale.unsubscribeVisibleTimeRangeChange(schedule);
      timeScale.unsubscribeVisibleLogicalRangeChange(schedule);
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [bars, markers, chartsEpoch, showMarkers, overlayMarkers]);

  useEffect(() => {
    if (!onCrosshairMove) return;
    const chart = chartRef.current;
    if (!chart) return;
    const handler = (param: any) => onCrosshairMove(param);
    try {
      chart.subscribeCrosshairMove(handler);
    } catch {}
    return () => {
      try {
        chart.unsubscribeCrosshairMove(handler);
      } catch {}
    };
  }, [onCrosshairMove, chartsEpoch]);

  return (
    <div className="relative" style={height ? { height } : undefined}>
      <div ref={containerRef} className="w-full h-full" />

      {showMarkers && overlay.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20">
          {overlay.map((m) => {
            const isSell =
              (m.side ??
                (typeof m.text === 'string' && (m.text.includes('Тє') || m.text.toUpperCase().includes('SELL')) ? 'SELL' : 'BUY')) ===
              'SELL';
            return (
              <div
                key={m.key ?? `${m.time}-${m.side}-${m.index ?? 0}`}
                className={`absolute z-50 whitespace-nowrap rounded bg-black/70 border border-white/10 px-2 py-1 text-xs ${
                  isSell ? 'text-emerald-300' : 'text-red-300'
                }`}
                style={{ left: m.x, top: m.y, transform: 'translate(-50%, -100%)' }}
              >
                <span className="mr-1">{isSell ? 'Ё‹' : 'Ўш'}</span>
                {isSell ? markerLabels.sell : markerLabels.buy}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
