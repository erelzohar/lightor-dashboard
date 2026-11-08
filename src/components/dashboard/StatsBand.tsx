import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useFirstTime } from '../../hooks/useFirstTime';

/**
 * LT-624: a band of headline numbers in one card, each with a small picture
 * that proves it - adapted from Erel's 21st.dev "stats band" (the divided
 * layout): the numbers count up from zero, one after another, and the
 * pictures draw in, the first time a session shows the band (LT-438); later
 * it shows already drawn. Each number reserves its final width underneath, so
 * nothing moves while the digits change, and a screen reader hears only the
 * final value. Hovering or focusing a number that has more to say swaps its
 * line for that. Lightor's own surface (glass card), colours (the brand
 * purple, amber for what waits on the owner), RTL, dark mode and reduced
 * motion; no world map, no CSS module.
 */

export type BandVisual =
  /** A line over the days, the last one dotted. */
  | { kind: 'trend'; values: number[] }
  /** One thin column a day, the last one in full colour. */
  | { kind: 'bars'; values: number[] }
  /** A hundred dots, `lit` of them coloured: "so many in every hundred". */
  | { kind: 'hundred'; lit: number }
  /** One thin bar split in two: the part that waits (amber) and the rest. */
  | { kind: 'split'; part: number; whole: number };

export interface BandStat {
  key: string;
  label: string;
  /** A number counts up; null shows "-" (nothing measured yet). */
  value: number | null;
  /** Digits after the point. */
  decimals?: number;
  /** Written after the number, e.g. "%". */
  suffix?: string;
  /** Percent against the period before; null or absent for none. */
  change?: number | null;
  /** The line under the number. */
  detail?: string;
  /** What hovering or focusing the number says instead of `detail`. */
  context?: string;
  visual?: BandVisual;
  /** Amber: something waits on the owner. */
  tone?: 'default' | 'warning';
  /** Makes the number a button. */
  onClick?: () => void;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
// LT-625: iOS sends no click while content keeps changing, so the whole band settles in about a
// second: the four numbers within 0.9 s plus 0.18 s of stagger, every picture within 1 s.
const STAGGER = 0.06;
const DURATION = 0.9;

/** Western digits in every language, as the rest of the home writes them. */
const numberLocale = (language: string): string => (language.split('-')[0] === 'ar' ? 'ar-u-nu-latn' : language);

/** One number, counting from zero once `run` turns true. */
const CountUp: React.FC<{ stat: BandStat; run: boolean; animated: boolean; delay: number; language: string }> = ({ stat, run, animated, delay, language }) => {
  const live = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  const decimals = stat.decimals ?? 0;
  const format = useMemo(() => {
    const digits = new Intl.NumberFormat(numberLocale(language), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return (n: number) => digits.format(n);
  }, [decimals, language]);
  const final = stat.value === null ? '-' : format(stat.value);

  // Zero before the first paint, so the count never flashes the final value first.
  useLayoutEffect(() => {
    if (!animated || done.current || stat.value === null || !live.current) return;
    live.current.textContent = format(0);
  }, [animated, format, stat.value]);

  useEffect(() => {
    const node = live.current;
    if (!node) return;
    if (!animated || stat.value === null) {
      node.textContent = final;
      done.current = true;
      return;
    }
    if (!run || done.current) return;
    const to = stat.value;
    const controls = animate(0, to, {
      duration: DURATION,
      delay,
      ease: EASE,
      onUpdate: (n) => { node.textContent = format(n); },
      onComplete: () => { node.textContent = final; done.current = true; },
    });
    return () => controls.stop();
  }, [animated, run, delay, format, final, stat.value]);

  return (
    <>
      <span className="sr-only">{final}{stat.value !== null ? stat.suffix ?? '' : ''}</span>
      <span aria-hidden="true" dir="ltr" className="inline-flex items-baseline">
        <span className="relative inline-block tabular-nums">
          <span className="invisible">{final}</span>
          <span ref={live} className="absolute inset-0 text-start" data-testid="band-live">{final}</span>
        </span>
        {stat.value !== null && stat.suffix && <span className="ms-0.5 text-[0.6em] font-semibold">{stat.suffix}</span>}
      </span>
    </>
  );
};

/* The pictures. Each is drawn at rest; until the band is in view (the first time) it waits hidden. */

/** Uncovered from the left (the prefixed name too, for older iPhones). */
const reveal = (clip: string, timing: string | null): React.CSSProperties => ({
  clipPath: clip,
  WebkitClipPath: clip,
  transition: timing ? `clip-path ${timing}, -webkit-clip-path ${timing}` : 'none',
});

const Trend: React.FC<{ values: number[]; shown: boolean; animated: boolean }> = ({ values, shown, animated }) => {
  const max = Math.max(...values, 0);
  const points = values.map((v, i) => [
    values.length > 1 ? (i / (values.length - 1)) * 100 : 100,
    // 4 units of air above and below, so the 2px line never touches the edges.
    36 - (max > 0 ? Math.max(0, v) / max : 0) * 32,
  ] as const);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const [endX, endY] = points[points.length - 1] ?? [100, 36];
  // Drawn in from the left by uncovering it: a dash drawn to a normalised path length came out
  // dotted in WebKit with a stroke that keeps its width.
  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        style={reveal(shown ? 'inset(-4px -4px -4px -4px)' : 'inset(-4px 100% -4px -4px)', animated ? '0.7s cubic-bezier(.16,1,.3,1) 0.1s' : null)}
      >
        <path d={`${line} L100 40 L0 40 Z`} className="fill-primary/10" />
        <path
          d={line}
          fill="none"
          vectorEffect="non-scaling-stroke"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-white dark:ring-slate-800 transition-opacity"
        style={{ left: `${endX}%`, top: `${(endY / 40) * 100}%`, opacity: shown ? 1 : 0, transitionDelay: animated ? '0.7s' : '0s' }}
      />
    </div>
  );
};

const Bars: React.FC<{ values: number[]; shown: boolean; animated: boolean }> = ({ values, shown, animated }) => {
  const max = Math.max(1, ...values);
  const last = values.length - 1;
  return (
    <div className="flex h-full w-full items-end gap-[2px]">
      {values.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-t-[2px] ${i === last ? 'bg-primary' : 'bg-primary/30'}`}
          style={{
            // An empty day keeps a stub, so every day stays in its place.
            height: v > 0 ? `${Math.max(8, (v / max) * 100)}%` : '2px',
            transform: shown ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'bottom',
            transition: animated ? `transform 0.45s cubic-bezier(.16,1,.3,1) ${(0.1 + (i / values.length) * 0.35).toFixed(3)}s` : 'none',
          }}
        />
      ))}
    </div>
  );
};

// 20 by 5: 118px wide on a phone's half-width cell, 157px from sm.
const Hundred: React.FC<{ lit: number; shown: boolean; animated: boolean }> = ({ lit, shown, animated }) => (
  <div className="grid h-full w-fit grid-cols-[repeat(20,minmax(0,1fr))] content-end gap-[2px] sm:gap-[3px]">
    {Array.from({ length: 100 }, (_, i) => (
      <span
        key={i}
        className={`h-1 w-1 rounded-full sm:h-[5px] sm:w-[5px] ${i < lit ? 'bg-primary' : 'bg-gray-300/70 dark:bg-slate-600/70'}`}
        style={{
          opacity: shown ? 1 : 0,
          // The lit ones last, together within a quarter second, however many.
          transition: animated ? `opacity 0.3s ease ${(i < lit ? 0.45 + (i / Math.max(1, lit)) * 0.25 : 0.05 + (i / 100) * 0.5).toFixed(3)}s` : 'none',
        }}
      />
    ))}
  </div>
);

const Split: React.FC<{ part: number; whole: number; shown: boolean; animated: boolean }> = ({ part, whole, shown, animated }) => {
  const share = whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;
  return (
    <div className="flex h-full w-full items-end">
      <div
        className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full"
        style={reveal(shown ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)', animated ? '0.6s cubic-bezier(.16,1,.3,1) 0.1s' : null)}
      >
        {whole === 0 ? (
          <span className="h-full w-full rounded-full bg-gray-200 dark:bg-slate-700" />
        ) : (
          <>
            {share > 0 && <span className="h-full rounded-full bg-amber-500" style={{ width: `${share * 100}%` }} />}
            {share < 1 && <span className="h-full flex-1 rounded-full bg-primary/40" />}
          </>
        )}
      </div>
    </div>
  );
};

const Visual: React.FC<{ visual: BandVisual; shown: boolean; animated: boolean }> = ({ visual, ...draw }) => {
  switch (visual.kind) {
    case 'trend': return <Trend values={visual.values} {...draw} />;
    case 'bars': return <Bars values={visual.values} {...draw} />;
    case 'hundred': return <Hundred lit={visual.lit} {...draw} />;
    case 'split': return <Split part={visual.part} whole={visual.whole} {...draw} />;
  }
};

/** The hairlines between the cells: two to a row on phones, all in one row from lg. */
const ruleOf = (i: number, count: number): string => {
  const rules: string[] = [];
  if (i % 2 === 1) rules.push('border-s');
  if (i >= 2) rules.push('border-t lg:border-t-0');
  if (i > 0 && i % 2 === 0) rules.push('lg:border-s');
  if (count % 2 === 1 && i === count - 1) rules.push('col-span-2 lg:col-span-1');
  return rules.join(' ');
};

const StatsBand: React.FC<{ stats: BandStat[]; label: string; language: string }> = ({ stats, label, language }) => {
  const ref = useRef<HTMLDListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();
  // LT-438: drawn in the first time a session, already drawn after that.
  const first = useFirstTime('stats-band');
  const animated = first && !reduced;
  const shown = !animated || inView;
  const cols = stats.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';

  return (
    <section className="glass-card overflow-hidden rounded-3xl" aria-label={label} data-testid="stats-band">
      <dl ref={ref} className={`grid grid-cols-2 ${cols}`}>
        {stats.map((stat, i) => {
          const rising = stat.change === null || stat.change === undefined || stat.change >= 0;
          const warning = stat.tone === 'warning';
          const body = (
            <>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</dt>
              <dd className={`mt-1 flex flex-wrap items-baseline gap-x-2 text-3xl font-bold leading-tight sm:text-4xl ${warning ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-white'}`}>
                <CountUp stat={stat} run={inView} animated={animated} delay={i * STAGGER} language={language} />
                {typeof stat.change === 'number' && (
                  <span
                    className={`inline-flex items-center text-sm font-semibold ${rising ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}
                    dir="ltr"
                    data-testid="band-change"
                  >
                    {Math.abs(Math.round(stat.change))}%
                    {rising ? <ArrowUp size={14} className="ms-0.5" aria-hidden="true" /> : <ArrowDown size={14} className="ms-0.5" aria-hidden="true" />}
                  </span>
                )}
              </dd>
              {(stat.detail || stat.context) && (
                <dd className="mt-1 min-h-[1rem] text-xs leading-4 text-gray-500 dark:text-gray-400">
                  {stat.detail && <span className={stat.context ? 'group-hover:hidden group-focus-within:hidden' : ''}>{stat.detail}</span>}
                  {stat.context && (
                    <span className={stat.detail ? 'hidden group-hover:inline group-focus-within:inline' : ''} data-testid="band-context">{stat.context}</span>
                  )}
                </dd>
              )}
              {stat.visual && (
                <dd className="mt-3 h-10 sm:h-12" aria-hidden="true" dir="ltr" data-testid={`band-visual-${stat.visual.kind}`}>
                  <Visual visual={stat.visual} shown={shown} animated={animated} />
                </dd>
              )}
            </>
          );
          // A number that opens a page is a button over its whole cell (a <dl> holds no buttons of its own).
          const cell = `group relative min-w-0 border-gray-200/70 dark:border-white/10 p-4 sm:p-5 ${ruleOf(i, stats.length)} ${warning ? 'bg-amber-50/60 dark:bg-amber-900/15' : ''} ${stat.onClick ? 'transition-colors hover:bg-white/40 dark:hover:bg-white/5' : ''}`;
          return (
            <div key={stat.key} className={cell} tabIndex={stat.context && !stat.onClick ? 0 : undefined} data-testid={`band-stat-${stat.key}`}>
              {body}
              {stat.onClick && (
                <button
                  type="button"
                  onClick={stat.onClick}
                  aria-label={stat.label}
                  className="absolute inset-0 rounded-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  data-testid={`band-open-${stat.key}`}
                />
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
};

export default StatsBand;
