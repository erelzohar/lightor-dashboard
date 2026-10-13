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
