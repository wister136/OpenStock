'use client';

import React from 'react';

import { fmt } from '../utils/format';

export default function EquitySparkline({
  points,
  height = 80,
  hoverHint = 'Hover to see value',
}: {
  points: Array<{ time: number; value: number }>;
  height?: number;
  hoverHint?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<any>(null);
  const seriesRef = React.useRef<any>(null);

  const [hover, setHover] = React.useState<null | { time: any; value: number }>(null);

  const data = React.useMemo(
    () =>
      (points ?? [])
        .filter((p) => p && Number.isFinite(p.time) && Number.isFinite(p.value))
        .map((p) => ({ time: p.time, value: p.value })),
    [points]
  );

  React.useEffect(() => {
    let disposed = false;

    async function init() {
      if (!containerRef.current) return;

      const { createChart, LineSeries } = await import('lightweight-charts');
      if (disposed) return;

      try {
        chartRef.current?.remove?.();
      } catch {}
      chartRef.current = null;
      seriesRef.current = null;

      const chart = createChart(containerRef.current, {
        autoSize: true,
        height,
        handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
        handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: { time: false, price: false } },
        layout: { background: { color: 'transparent' }, textColor: 'rgba(255,255,255,0.65)' },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
        rightPriceScale: { visible: false },
        leftPriceScale: { visible: false },
        timeScale: { visible: false, borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      });

      const line = chart.addSeries(LineSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      try {
        chart.subscribeCrosshairMove((param: any) => {
          if (!param || !param.time) {
            setHover(null);
            return;
          }
          const d = param.seriesData?.get?.(line);
          const v = (d as any)?.value ?? (d as any)?.close;
          if (v == null || !Number.isFinite(v)) {
            setHover(null);
            return;
          }
          setHover({ time: param.time, value: Number(v) });
        });
      } catch {}

      chartRef.current = chart;
      seriesRef.current = line;

      try {
        line.setData(data as any);
        chart.timeScale().fitContent();
      } catch {}
    }

    void init();

    return () => {
      disposed = true;
      try {
        chartRef.current?.remove?.();
      } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  React.useEffect(() => {
    try {
      if (!seriesRef.current) return;
      seriesRef.current.setData(data as any);
      chartRef.current?.timeScale?.()?.fitContent?.();
    } catch {}
  }, [data]);

  const formatTime = (t: any) => {
    if (!t) return '';
    if (typeof t === 'number') {
      const d = new Date(t * 1000);
      if (!Number.isFinite(d.getTime())) return '';
      return d.toLocaleDateString();
    }
    const y = (t as any).year;
    const m = (t as any).month;
    const day = (t as any).day;
    if (y && m && day) return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return '';
  };

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />

      <div className="pointer-events-none absolute left-2 top-1 text-[11px] text-gray-300 bg-black/40 border border-white/10 rounded px-2 py-0.5">
        {hover ? (
          <span>
            {formatTime(hover.time)} · {fmt(hover.value, 0)}
          </span>
        ) : (
          <span className="text-gray-500">{hoverHint}</span>
        )}
      </div>
    </div>
  );
}
