import React, { useEffect, useId, useMemo, useRef } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

/**
 * A stat card with a sparkline (LT-272) — adapted from a 21st.dev "stats
 * widget": the random demo data, interval and inline shadcn colour variables
 * are gone; it takes real values, sits on the dashboard's glass card, follows
 * dark mode and RTL, and keeps the line-draw animation (skipped under reduced
 * motion).
 *
 * The leads home's numbers use it too (LT-274): a figure there may have no
 * trend to draw, wait on the owner (amber), or open the page behind it.
 */

const W = 150;
const H = 60;

/** A smooth path through `values`, scaled to the series' own maximum. */
export const sparklinePath = (values: number[], width = W, height = H): string => {
  if (values.length < 2) return `M 0 ${height * 0.9} L ${width} ${height * 0.9}`;
  const max = Math.max(...values, 0);
  const xStep = width / (values.length - 1);
  const pts = values.map((v, i) => {
    const pct = max > 0 ? Math.max(0, v) / max : 0;
    // 10% padding top and bottom, so the stroke never touches the edges.
    return [i * xStep, height - pct * height * 0.8 - height * 0.1] as const;
  });
  let path = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const midX = (x1 + x2) / 2;
    path += ` C ${midX},${y1} ${midX},${y2} ${x2},${y2}`;
  }
  return path;
};

export interface StatsWidgetProps {
  label: string;
  /** Already formatted, e.g. "₪1,240". */
  value: string;
  /** Percent change against the previous period; null when there is nothing to compare. */
  change: number | null;
  /** The same figure over recent periods, oldest first, ending with the current one. Omit for no sparkline. */
  series?: number[];
  /** A small line under the value, e.g. "4 appointments". */
  sub?: string;
  /** What the change compares with, e.g. "vs yesterday". */
  changeLabel?: string;
  /** A muted note that may wrap, e.g. why there is no figure yet. */
  hint?: string;
  /** 'warning' tints the card amber: something is waiting on the owner. */
  tone?: 'default' | 'warning';
  /** Two to a row on phones: tighter there, and the sparkline only from sm up. */
  compact?: boolean;
  /** Makes the whole card a button. */
  onClick?: () => void;
}

const StatsWidget: React.FC<StatsWidgetProps> = ({
  label,
  value,
  change,
  series,
  sub,
  changeLabel,
  hint,
  tone = 'default',
  compact = false,
  onClick,
}) => {
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const gradientId = `stats-area-${useId().replace(/:/g, '')}`;

  const rising = change === null || change >= 0;
  const linePath = useMemo(() => (series ? sparklinePath(series) : ''), [series]);
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  // Draw the line in, then fade the area under it, whenever the data changes.
  useEffect(() => {
    const line = lineRef.current;
    const area = areaRef.current;
    if (!line || !area || typeof line.getTotalLength !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let length: number;
    try {
      length = line.getTotalLength();
    } catch {
      return; // a sparkline hidden on phones (compact) may have no geometry to measure
    }
    line.style.transition = 'none';
    line.style.strokeDasharray = `${length} ${length}`;
    line.style.strokeDashoffset = `${length}`;
    area.style.transition = 'none';
    area.style.opacity = '0';
    line.getBoundingClientRect(); // apply the start state before transitioning
    line.style.transition = 'stroke-dashoffset 0.8s ease-in-out';
    line.style.strokeDashoffset = '0';
    area.style.transition = 'opacity 0.8s ease-in-out 0.2s';
    area.style.opacity = '1';
  }, [linePath]);

  // Green up, orange down — the widget's own pair; neutral violet with nothing to compare.
  const stroke = change === null ? '#8b5cf6' : rising ? '#22c55e' : '#f97316';
  const warning = tone === 'warning';

  const body = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center flex-wrap gap-x-2 text-sm font-medium text-gray-500 dark:text-gray-400">
          <span>{label}</span>
          {change !== null && (
            <span
              className={`inline-flex items-center font-semibold ${rising ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}
              dir="ltr"
            >
              {Math.abs(Math.round(change))}%
              {rising ? <ArrowUp size={14} className="ms-0.5" aria-hidden="true" /> : <ArrowDown size={14} className="ms-0.5" aria-hidden="true" />}
            </span>
          )}
        </div>
        {/* The line keeps the page's direction (aligned with the label); the
            figure is isolated with dir="auto": "₪1,240" has no letters and stays
            LTR, so it never reorders in Hebrew, while "2.5 שעות" reads RTL. */}
        <p
          className={`${compact ? 'text-2xl sm:text-3xl' : 'text-3xl'} font-bold mt-1.5 tabular-nums truncate ${
            warning ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-white'
          }`}
        >
          <span dir="auto">{value}</span>
        </p>
        {(sub || changeLabel) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {[sub, changeLabel].filter(Boolean).join(' · ')}
          </p>
        )}
        {hint && <p className="text-xs leading-snug text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
      </div>

      {series && (
        <div className={`w-2/5 max-w-[150px] h-16 shrink-0 ${compact ? 'hidden sm:block' : ''}`} aria-hidden="true">
          {/* SVG coordinates ignore RTL: time runs left to right in every language. */}
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path ref={areaRef} d={areaPath} fill={`url(#${gradientId})`} />
            <path
              ref={lineRef}
              d={linePath}
              fill="none"
              stroke={stroke}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );

  const card = `glass-card ${warning ? 'glass-tint-amber' : ''} rounded-3xl ${compact ? 'p-4 sm:p-5' : 'p-5'} h-full`;

  // As a button: flex-col keeps the content at the top like the other cards
  // (a button centres it vertically), and the lift on hover is the cue — a
  // glass card's own border and shadow win over Tailwind's hover colours.
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${card} w-full flex flex-col text-start transition-transform hover:-translate-y-0.5`}
      data-testid="stats-widget"
    >
      {body}
    </button>
  ) : (
    <div className={card} data-testid="stats-widget">
      {body}
    </div>
  );
};

export default StatsWidget;
