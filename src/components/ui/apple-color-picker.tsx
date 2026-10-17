import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

/**
 * LT-384: the colour picker (21st.dev "apple-color-picker"): a grid of
 * colours, a spectrum, RGB sliders with the hex code, and recent colours.
 * Adapted for the dashboard:
 * - the dashboard's colours and dark mode, labels through i18n;
 * - touch: the spectrum and the sliders follow a finger (pointer events);
 *   the original spectrum listened to the mouse only;
 * - no opacity row: a site's colour has none;
 * - the eyedropper is the browser's EyeDropper where it exists (Chrome),
 *   and is not offered elsewhere (the original's button did nothing);
 * - recent colours are remembered on this device (localStorage);
 * - a hex code is applied only once it is a whole one (#abc / #aabbcc);
 * - portalled to <body> above everything; Escape or a tap outside closes.
 */

type Rgb = { r: number; g: number; b: number };
type Hsv = { h: number; s: number; v: number };

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function hexToRgb(hex: string): Rgb {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
  }
  return { r, g, b };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function rgbToHsv({ r, g, b }: Rgb): Hsv {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  if (max !== min) {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: max * 100 };
}

function hsvToRgb({ h, s, v }: Hsv): Rgb {
  let r = 0, g = 0, b = 0;
  h /= 360; s /= 100; v /= 100;
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

/** The original's grid, row by row (12 columns). */
const GRID = [
  '#FFFFFF', '#EBEBEB', '#D6D6D6', '#C2C2C2', '#ADADAD', '#999999', '#858585', '#707070', '#5C5C5C', '#474747', '#333333', '#000000',
  '#003366', '#336699', '#3366CC', '#003399', '#000099', '#0000CC', '#000066', '#333366', '#663399', '#660099', '#330066', '#330033',
  '#006699', '#0099CC', '#0066CC', '#0033CC', '#0000FF', '#3333FF', '#333399', '#6633CC', '#9933CC', '#9900CC', '#6600CC', '#660066',
  '#0099CC', '#00CCFF', '#0099FF', '#0066FF', '#3366FF', '#6666FF', '#6666CC', '#9966CC', '#CC66FF', '#CC33FF', '#9900FF', '#990099',
  '#33CCCC', '#66FFFF', '#33CCFF', '#3399FF', '#6699FF', '#9999FF', '#9999CC', '#CC99FF', '#FF99FF', '#FF66FF', '#CC00FF', '#CC00CC',
  '#66CCCC', '#99FFFF', '#66CCFF', '#6699FF', '#99CCFF', '#CCCCFF', '#CC99CC', '#FFCCFF', '#FF99FF', '#FF66FF', '#FF33FF', '#FF00FF',
  '#CCFFCC', '#FFFFCC', '#FFFF99', '#FFFF66', '#FFFF33', '#FFFF00', '#FFCC00', '#FF9900', '#FF6600', '#FF3300', '#FF0000', '#CC0000',
  '#99FF99', '#CCFF99', '#CCCC66', '#CCCC33', '#CCCC00', '#CC9900', '#CC6600', '#CC3300', '#CC0000', '#990000', '#660000', '#330000',
  '#66FF66', '#99FF66', '#99CC66', '#99CC33', '#999900', '#996600', '#993300', '#990000', '#660000', '#330000', '#000000', '#000000',
  '#33FF33', '#66FF33', '#66CC33', '#669933', '#666600', '#663300', '#660000', '#330000', '#000000', '#000000', '#000000', '#000000',
  '#00FF00', '#33FF00', '#33CC00', '#339900', '#336600', '#333300', '#330000', '#000000', '#000000', '#000000', '#000000', '#000000',
];

const RECENT_KEY = 'lightor.recentColors';
const DEFAULT_RECENT = ['#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55'];
const readRecent = (): string[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? 'null');
    return Array.isArray(saved) && saved.every((c) => typeof c === 'string' && HEX.test(c)) ? saved.slice(0, 12) : DEFAULT_RECENT;
  } catch {
    return DEFAULT_RECENT;
  }
};
const writeRecent = (colors: string[]) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(colors)); } catch { /* private mode */ }
};

type Tab = 'grid' | 'spectrum' | 'sliders';

/** Drags over an element in fractions of its box, finger or mouse. */
const usePointerDrag = (onPoint: (x: number, y: number) => void) => {
  const ref = useRef<HTMLDivElement>(null);
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      point(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) point(e);
    },
  };
  function point(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    onPoint(
      Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    );
  }
  return { ref, handlers };
};

const Spectrum: React.FC<{ hsv: Hsv; onChange: (hsv: Hsv) => void; label: string }> = ({ hsv, onChange, label }) => {
  const { ref, handlers } = usePointerDrag((x, y) => onChange({ h: x * 360, s: 100 - y * 100, v: 100 }));
  return (
    <div
      ref={ref}
      {...handlers}
      role="img"
      aria-label={label}
      data-testid="color-spectrum"
      dir="ltr"
      className="relative w-full h-full rounded-xl overflow-hidden cursor-crosshair touch-none shadow-inner"
      style={{
        background:
          'linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #FFF, transparent), linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)',
      }}
    >
      <div
        className="absolute w-4 h-4 -ml-2 -mt-2 border-2 border-white rounded-full shadow-md pointer-events-none"
        style={{ left: `${(hsv.h / 360) * 100}%`, top: `${100 - hsv.s}%`, backgroundColor: rgbToHex(hsvToRgb(hsv)) }}
      />
    </div>
  );
};

const SliderRow: React.FC<{ label: string; value: number; gradient: string; onChange: (v: number) => void }> = ({ label, value, gradient, onChange }) => (
  <div className="flex items-center gap-3">
    <div className="w-10 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">{label}</div>
    <div className="flex-1 relative h-6 rounded-full shadow-inner" style={{ background: gradient }}>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div
        className="absolute top-1/2 -mt-2.5 w-5 h-5 bg-white rounded-full shadow-md border border-gray-200 pointer-events-none"
        style={{ left: `calc(${(value / 255) * 100}% - 10px)` }}
      />
    </div>
    <input
      type="number"
      min={0}
      max={255}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Math.max(0, Math.min(255, parseInt(e.target.value, 10) || 0)))}
      className="w-12 h-7 px-1 text-xs text-center rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 focus:outline-none"
    />
  </div>
);

export interface AppleColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** The colour it opens on. */
  initialColor?: string;
  /** Every change, live (a hex code). */
  onChange?: (hex: string) => void;
}

export const AppleColorPicker: React.FC<AppleColorPickerProps> = ({ isOpen, onClose, initialColor = '#007AFF', onChange }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('grid');
  const start = HEX.test(initialColor) ? initialColor : '#007AFF';
  const [hex, setHex] = useState(start);
  const [hexDraft, setHexDraft] = useState(start.slice(1));
  const [rgb, setRgb] = useState<Rgb>(hexToRgb(start));
  const [hsv, setHsv] = useState<Hsv>(rgbToHsv(hexToRgb(start)));
  const [recent, setRecent] = useState<string[]>(readRecent);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Opens on the colour it is given.
  useEffect(() => {
    if (!isOpen) return;
    const c = HEX.test(initialColor) ? initialColor : '#007AFF';
    setHex(c);
    setHexDraft(c.slice(1));
    setRgb(hexToRgb(c));
    setHsv(rgbToHsv(hexToRgb(c)));
    // Only on opening: while open, the picker drives the colour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [isOpen]);

  const apply = (next: string, from?: { rgb?: Rgb; hsv?: Hsv }) => {
    const value = next.length === 4 ? rgbToHex(hexToRgb(next)) : next.toLowerCase();
    setHex(value);
    setHexDraft(value.slice(1));
    setRgb(from?.rgb ?? hexToRgb(value));
    setHsv(from?.hsv ?? rgbToHsv(hexToRgb(value)));
    onChange?.(value);
  };
  const fromRgb = (next: Rgb) => apply(rgbToHex(next), { rgb: next });
  const fromHsv = (next: Hsv) => apply(rgbToHex(hsvToRgb(next)), { hsv: next });
  const addRecent = () => {
    if (recent.some((c) => c.toLowerCase() === hex)) return;
    const next = [hex, ...recent].slice(0, 12);
    setRecent(next);
    writeRecent(next);
  };

  const eyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  const pickFromScreen = async () => {
    try {
      const Dropper = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const { sRGBHex } = await new Dropper().open();
      if (HEX.test(sRGBHex)) apply(sRGBHex);
    } catch { /* cancelled */ }
  };

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'grid', label: t('colorPicker.grid', 'Grid') },
    { id: 'spectrum', label: t('colorPicker.spectrum', 'Spectrum') },
    { id: 'sliders', label: t('colorPicker.sliders', 'Sliders') },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[10100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/20 dark:bg-black/40" onClick={onClose} data-testid="color-picker-backdrop" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('colorPicker.title', 'Colors')}
        tabIndex={-1}
        className="relative w-[300px] max-w-full rounded-[24px] border border-white/60 dark:border-white/10 bg-[#F5F5F7] dark:bg-slate-900 shadow-2xl p-4 select-none outline-none"
      >
        <div className="flex items-center justify-between mb-3">
          {eyeDropper ? (
            <button
              type="button"
              onClick={() => void pickFromScreen()}
              aria-label={t('colorPicker.eyedropper', 'Pick from the screen')}
              className="p-1.5 rounded-full text-primary hover:bg-black/5 dark:hover:bg-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
            </button>
          ) : (
            <span className="w-[30px]" aria-hidden="true" />
          )}
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{t('colorPicker.title', 'Colors')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('colorPicker.close', 'Close')}
            className="p-1.5 rounded-full text-gray-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        <div className="relative flex items-center rounded-[9px] p-[2px] mb-3 bg-[#E3E3E8] dark:bg-slate-800" role="tablist">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'relative flex-1 py-1 rounded-[7px] text-[13px] font-medium transition-colors',
                tab === id ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="h-[200px]">
          {tab === 'grid' && (
            <div dir="ltr" className="grid grid-cols-12 gap-px bg-gray-200 dark:bg-slate-700 p-px rounded-lg overflow-hidden h-full">
              {GRID.map((color, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={color}
                  data-color={color}
                  onClick={() => apply(color)}
                  className="relative w-full h-full focus:outline-none"
                  style={{ backgroundColor: color }}
                >
                  {hex === color.toLowerCase() && <span className="absolute inset-0 border-2 border-white mix-blend-difference pointer-events-none" />}
                </button>
              ))}
            </div>
          )}
          {tab === 'spectrum' && <Spectrum hsv={hsv} onChange={fromHsv} label={t('colorPicker.spectrum', 'Spectrum')} />}
          {tab === 'sliders' && (
            <div className="h-full flex flex-col justify-between py-1">
              <SliderRow label={t('colorPicker.red', 'Red')} value={rgb.r} gradient="linear-gradient(to right, #000000, #FF0000)" onChange={(r) => fromRgb({ ...rgb, r })} />
              <SliderRow label={t('colorPicker.green', 'Green')} value={rgb.g} gradient="linear-gradient(to right, #000000, #00FF00)" onChange={(g) => fromRgb({ ...rgb, g })} />
              <SliderRow label={t('colorPicker.blue', 'Blue')} value={rgb.b} gradient="linear-gradient(to right, #000000, #0000FF)" onChange={(b) => fromRgb({ ...rgb, b })} />
              <label className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-slate-400">
                {t('colorPicker.hex', 'Hex code')}
                <span dir="ltr" className="flex items-center rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1">
                  <span className="text-gray-400">#</span>
                  <input
                    type="text"
                    value={hexDraft}
                    maxLength={6}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9a-f]/gi, '');
                      setHexDraft(v);
                      if (HEX.test(`#${v}`)) apply(`#${v}`);
                    }}
                    className="w-16 bg-transparent text-sm font-medium uppercase text-gray-800 dark:text-gray-100 focus:outline-none"
                    aria-label={t('colorPicker.hex', 'Hex code')}
                  />
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-4 flex gap-4">
          <div className="w-12 h-12 rounded-full shadow-inner border border-gray-200 dark:border-slate-600 shrink-0" style={{ backgroundColor: hex }} data-testid="color-current" />
          <div className="flex-1 grid grid-cols-6 gap-2 place-content-start" aria-label={t('colorPicker.recent', 'Recent colours')} role="group">
            {recent.map((color, i) => (
              <button
                key={`${color}-${i}`}
                type="button"
                aria-label={color}
                onClick={() => apply(color)}
                className="w-6 h-6 rounded-full shadow-sm border border-gray-200 dark:border-slate-600 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
              />
            ))}
            {recent.length < 12 && (
              <button
                type="button"
                onClick={addRecent}
                aria-label={t('colorPicker.add', 'Keep this colour')}
                className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-500"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AppleColorPicker;
