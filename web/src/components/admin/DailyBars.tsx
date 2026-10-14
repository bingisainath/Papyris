// src/components/admin/DailyBars.tsx
// One daily count as columns (sign-ups, messages...): one hue, the title names it, hover for the
// exact day, and a table view for screen readers and anyone who wants the numbers.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DayCount } from '../../services/admin.service';

const BAR = '#7b64aa'; // primary-500: validated on the white card (lightness, chroma, 3:1 contrast)
const HEIGHT = 150;
const TOP = 10; // room for the top tick label
const LEFT = 34; // y-axis labels
const BOTTOM = 20; // x-axis labels

const niceMax = (n: number) => {
  if (n <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(n));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((v) => v >= n) ?? n;
  return nice;
};

const fmt = (n: number) => n.toLocaleString();
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });

const DailyBars: React.FC<{ title: string; series: DayCount[] }> = ({ title, series }) => {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real width so labels stay 11px on a phone instead of shrinking with the SVG
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const total = series.reduce((sum, d) => sum + d.count, 0);
  const max = useMemo(() => niceMax(Math.max(0, ...series.map((d) => d.count))), [series]);
  const plot = width - LEFT;
  const slot = plot / Math.max(1, series.length);
  const bar = Math.max(2, Math.min(24, slot - 2)); // capped thickness, 2px air between columns
  const y = (v: number) => TOP + (HEIGHT - BOTTOM - TOP) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(series.length / Math.max(2, Math.floor(plot / 70)));
  const hovered = hover !== null ? series[hover] : null;

  return (
    <figure className="card p-4 sm:p-5 m-0">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-muted-900">{title}</span>
        <span className="text-sm text-muted-500">{fmt(total)} in {series.length} days</span>
      </figcaption>

      <div ref={box} className="relative mt-3">
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="w-full h-auto block" role="img"
          aria-label={`${title}: ${fmt(total)} over ${series.length} days`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={width} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={LEFT - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#64748b">{fmt(Math.round(t))}</text>
            </g>
          ))}
          {series.map((d, i) => {
            const x = LEFT + i * slot + (slot - bar) / 2;
            const top = y(d.count);
            const h = HEIGHT - BOTTOM - top;
            const r = Math.min(4, bar / 2, h);
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                {/* Hit target: the whole slot, taller than the bar */}
                <rect x={LEFT + i * slot} y={0} width={slot} height={HEIGHT - BOTTOM} fill="transparent" />
                {h > 0 && (
                  <path fill={BAR} opacity={hover === null || hover === i ? 1 : 0.55}
                    d={`M${x},${HEIGHT - BOTTOM} V${top + r} Q${x},${top} ${x + r},${top} H${x + bar - r} Q${x + bar},${top} ${x + bar},${top + r} V${HEIGHT - BOTTOM} Z`} />
                )}
                {i % labelEvery === 0 && (
                  <text x={x + bar / 2} y={HEIGHT - 5} textAnchor="middle" fontSize={11} fill="#64748b">{dayLabel(d.day)}</text>
                )}
              </g>
            );
          })}
        </svg>
        {hovered && hover !== null && (
          <div className="pointer-events-none absolute top-0 px-2.5 py-1.5 rounded-lg bg-muted-900 text-white text-xs shadow-lg whitespace-nowrap"
            style={{ left: `${((LEFT + (hover + 0.5) * slot) / width) * 100}%`, transform: 'translateX(-50%)' }}>
            {dayLabel(hovered.day)}: <b>{fmt(hovered.count)}</b>
          </div>
        )}
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-muted-500">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead><tr className="text-muted-500"><th className="font-semibold py-1">Day</th><th className="font-semibold py-1 text-right">{title}</th></tr></thead>
          <tbody>
            {series.map((d) => (
              <tr key={d.day} className="border-t border-muted-100"><td className="py-1">{dayLabel(d.day)}</td><td className="py-1 text-right tabular-nums">{fmt(d.count)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
};

export default DailyBars;
