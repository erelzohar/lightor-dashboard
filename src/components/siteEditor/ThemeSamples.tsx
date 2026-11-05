import React, { useEffect } from 'react';

/**
 * LT-595 (Erel: a sample of every design): the site-wide choices of the
 * design tab (fonts, buttons, corners, cards, light/dark) each show a small
 * sample beside the name in their list. Drawn here, the way the site draws
 * them (lightor-front useTheme.ts: the font stacks, the radius map, the card
 * styles; Hero.tsx: the button styles) - keep them in step.
 */

/** The site's Latin faces, and the Hebrew face each family draws on an RTL site. */
const LATIN: Record<string, string> = {
  inter: "'Inter', sans-serif",
  raleway: "'Raleway', sans-serif",
  playfair: "'Playfair Display', serif",
  montserrat: "'Montserrat', sans-serif",
  poppins: "'Poppins', sans-serif",
  anton: "'Anton', 'Arial Narrow', sans-serif",
  archivo: "'Archivo', 'Helvetica Neue', sans-serif",
  cormorant: "'Cormorant Garamond', Georgia, serif",
  bellefair: "'Bellefair', Georgia, serif",
  secularone: "'Secular One', sans-serif",
  varela: "'Varela Round', sans-serif",
  sora: "'Sora', sans-serif",
  spacemono: "'Space Mono', monospace",
};
const HEBREW_HEADING: Record<string, string> = {
  inter: "'Heebo', 'Rubik', sans-serif",
  raleway: "'Assistant', 'Rubik', sans-serif",
  playfair: "'Frank Ruhl Libre', 'Rubik', serif",
  montserrat: "'Miriam Libre', 'Rubik', sans-serif",
  poppins: "'Rubik', sans-serif",
  anton: "'Karantina', 'Rubik', sans-serif",
  archivo: "'IBM Plex Sans Hebrew', 'Rubik', sans-serif",
  cormorant: "'David Libre', 'Rubik', serif",
  bellefair: "'Bellefair', 'Rubik', serif",
  secularone: "'Secular One', 'Rubik', sans-serif",
  varela: "'Varela Round', 'Rubik', sans-serif",
  sora: "'Alef', 'Rubik', sans-serif",
  spacemono: "'Cousine', 'Rubik', monospace",
};
/** Secular One and Karantina are display faces: a Hebrew body in those families is Heebo. */
const HEBREW_BODY: Record<string, string> = { ...HEBREW_HEADING, anton: "'Heebo', 'Rubik', sans-serif", secularone: "'Heebo', 'Rubik', sans-serif" };

const SAMPLE = { rtl: 'אבגד', ltr: 'Abcd' };
const FAMILIES = [
  'Inter', 'Raleway', 'Playfair Display', 'Montserrat', 'Poppins', 'Anton', 'Archivo', 'Cormorant Garamond', 'Bellefair',
  'Secular One', 'Varela Round', 'Sora', 'Space Mono', 'Heebo', 'Frank Ruhl Libre', 'Miriam Libre', 'Rubik', 'Karantina',
  'IBM Plex Sans Hebrew', 'David Libre', 'Alef', 'Cousine',
];
const FONTS_LINK_ID = 'lt-font-samples';

/** The families, cut down to the sample's few letters (Google's `text=`), loaded once when a sample first shows. */
export const useSampleFonts = (): void => {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(FONTS_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = FONTS_LINK_ID;
    link.rel = 'stylesheet';
    const families = FAMILIES.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`).join('&');
    link.href = `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(SAMPLE.rtl + SAMPLE.ltr)}&display=swap`;
    document.head.appendChild(link);
  }, []);
};

export const FontSample: React.FC<{ font: string; rtl: boolean; body?: boolean }> = ({ font, rtl, body }) => {
  const family = rtl ? (body ? HEBREW_BODY : HEBREW_HEADING)[font] : LATIN[font];
  if (!family) return null;
  return (
    <span aria-hidden="true" dir={rtl ? 'rtl' : 'ltr'} data-sample={`font-${font}`} className="inline-block w-12 shrink-0 text-center text-[17px] leading-none text-gray-900 dark:text-white" style={{ fontFamily: family }}>
      {rtl ? SAMPLE.rtl : SAMPLE.ltr}
    </span>
  );
};

/** A small button in the style, in the site's main colour. */
export const ButtonSample: React.FC<{ style: string; color: string }> = ({ style, color: raw }) => {
  // A colour the owner picked is #rrggbb; anything else draws in the brand's purple.
  const color = /^#[0-9a-f]{6}$/i.test(raw) ? raw : '#7c3aed';
  const css: React.CSSProperties =
    style === 'solid' ? { background: color, color: '#fff' }
    : style === 'gradient' ? { backgroundImage: `linear-gradient(135deg, ${color}, ${color}99)`, color: '#fff' }
    : style === 'outline' ? { border: `1.5px solid ${color}`, color }
    : { background: `${color}1f`, color };
  return <span aria-hidden="true" data-sample={`button-${style}`} className="inline-flex h-5 w-12 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold" style={css}>Aa</span>;
};

/** A box with the corner, as the site's radius map scales it (none 0 to full). */
const CORNER: Record<string, string> = { none: '0px', sm: '2px', md: '4px', lg: '7px', xl: '10px', full: '9999px' };
export const CornerSample: React.FC<{ radius: string }> = ({ radius }) => (
  <span aria-hidden="true" data-sample={`corner-${radius}`} className="inline-block h-5 w-8 shrink-0 border-2 border-gray-500 bg-gray-100 dark:border-slate-300 dark:bg-slate-700" style={{ borderRadius: CORNER[radius] ?? '7px' }} />
);

/** A small card in the style, over a strip of colour so glass reads as glass. */
export const CardSample: React.FC<{ card: string }> = ({ card }) => {
  const face =
    card === 'flat' ? 'bg-gray-100 dark:bg-slate-600'
    : card === 'elevated' ? 'bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] dark:bg-slate-500'
    : card === 'glass' ? 'border border-white/70 bg-white/45'
    : 'border border-gray-400 bg-white dark:border-slate-400 dark:bg-slate-600';
  return (
    <span aria-hidden="true" data-sample={`card-${card}`} className="relative inline-flex h-6 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-200 to-sky-200 dark:from-violet-900 dark:to-sky-900">
      <span className={`block h-4 w-8 rounded ${face}`} />
    </span>
  );
};

/** A page in light or dark. */
export const ThemeSample: React.FC<{ mode: string }> = ({ mode }) => (
  <span aria-hidden="true" data-sample={`theme-${mode}`} className={`inline-flex h-5 w-8 shrink-0 flex-col justify-center gap-0.5 rounded border px-1 ${mode === 'dark' ? 'border-slate-600 bg-slate-900' : 'border-gray-300 bg-white'}`}>
    <span className={`block h-0.5 w-5 rounded-full ${mode === 'dark' ? 'bg-slate-200' : 'bg-gray-700'}`} />
    <span className={`block h-0.5 w-3 rounded-full ${mode === 'dark' ? 'bg-slate-500' : 'bg-gray-400'}`} />
  </span>
);
