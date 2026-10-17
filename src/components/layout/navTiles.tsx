import type { Inbox } from 'lucide-react';

/**
 * Each page's icon sits on a small tile of its own colour (LT-278) — the menu
 * was all grey with only Lighty in colour. The tile owns the colour, so the
 * active page is marked by a ring around it (and the bold label), never by
 * recolouring the icon. Lighty keeps his own face. Shared by the sidebar and
 * the phone's tab bar (LT-304), which stayed grey.
 */
export const TILE: Record<string, string> = {
  '/': 'from-violet-400 to-violet-600',
  '/design': 'from-pink-400 to-fuchsia-500',
  '/appointments': 'from-sky-400 to-blue-500',
  '/customers': 'from-emerald-400 to-green-500',
  '/leads': 'from-amber-300 to-orange-400',
  '/schedule-vacations': 'from-cyan-400 to-sky-500',
  '/appointment-types': 'from-orange-400 to-rose-400',
  '/portfolio': 'from-rose-400 to-pink-500',
  '/settings': 'from-teal-400 to-emerald-500',
  '/admin': 'from-indigo-400 to-violet-500',
  '/admin/users': 'from-emerald-400 to-teal-500',
  '/admin/appointments': 'from-sky-400 to-indigo-500',
  '/admin/subscriptions': 'from-amber-300 to-orange-400',
  '/admin/costs': 'from-lime-400 to-green-500',
  '/admin/logs': 'from-slate-400 to-slate-600',
  '/admin/reports': 'from-amber-400 to-red-500',
};

/** The tile's frame. `ring` marks the active page — the caller's group selector. */
export const tileFrame = (ring: string) =>
  `w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ring-offset-2 ring-offset-[#f9f9ff] dark:ring-offset-dark-surface ${ring}`;

/** A page's icon on its tile; Lighty's face as it is. */
export const navTile = (path: string, Icon: typeof Inbox, ring: string, tile = TILE[path] ?? 'from-violet-400 to-violet-600') =>
  path === '/lighty' ? (
    <span className={`${tileFrame(ring)} shadow-none`}>
      <Icon className="w-7 h-7" />
    </span>
  ) : (
    <span className={`${tileFrame(ring)} bg-gradient-to-br ${tile}`}>
      <Icon className="h-4 w-4 !text-white" strokeWidth={2.25} />
    </span>
  );

/**
 * The phone bar's items (LT-304), shared with the pages "More" adds to the
 * bar (LT-378), so the grown bar reads as one bar. Colour lives on the
 * active/idle branches, never on the shared classes: an idle
 * `dark:text-gray-400` would outrank `text-primary` in dark mode.
 */
export const TAB_ITEM =
  'group/tab flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-1 rounded-[1.25rem] text-[10px] font-medium leading-tight transition-colors';
export const TAB_IDLE = 'text-gray-500 dark:text-gray-400';
export const TAB_ACTIVE = 'text-primary dark:text-primary font-semibold bg-violet-500/10 dark:bg-white/10';
/** The active page: a ring around its tile, as in the sidebar (LT-278). */
export const TAB_RING = 'group-aria-[current=page]/tab:ring-2 group-aria-[current=page]/tab:ring-violet-400/80';
