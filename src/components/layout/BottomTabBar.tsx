import React from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, CalendarRange, Calendar, LayoutGrid, Palette, Inbox, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useVirtualKeyboard } from '../../hooks/useVirtualKeyboard';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import LightyIcon from '../lighty/LightyIcon';
import { navTile, TAB_ITEM, TAB_IDLE, TAB_ACTIVE, TAB_RING } from './navTiles';

interface BottomTabBarProps {
  /** Not-yet-onboarded accounts only get the pages the drawer allows them. */
  isRestricted?: boolean;
  /**
   * A leads site (LT-199, `isLeadsSite`): no calendar, so the daily
   * destinations are the leads, the services and the opening hours.
   */
  leadsSite?: boolean;
  /** New leads (LT-197): a dot on the Leads tab while any wait. */
  newLeads?: number | null;
  /** Opens or closes the rest of the pages (LT-378: the bar grows with them). */
  onMore: () => void;
  /** "More" is open: the bar has grown upwards with the pages it lacks. */
  menuOpen?: boolean;
  /** Those pages (PhoneMenu), drawn inside the bar above its own row. */
  menu?: React.ReactNode;
  /**
   * A page has taken the bar over (LT-380, the site editor): its tabs go in
   * `rowRef`'s element instead of the pages, and its panel in `panelRef`'s,
   * above the row. "More" stays, for the other pages.
   */
  editing?: boolean;
  rowRef?: (el: HTMLElement | null) => void;
  panelRef?: (el: HTMLElement | null) => void;
}

/**
 * Phone navigation (LT-127, mobile plan phase 0).
 *
 * Under the `md` breakpoint the hover-rail sidebar collapses to a hamburger,
 * which makes every page change a two-tap trip through a full-screen drawer.
 * Native apps put the four daily destinations in a thumb-reach bar instead;
 * this is that bar. Everything else is behind "More": since LT-378 the bar
 * itself grows upwards with the pages it does not show (LT-352 opened a
 * second menu over it, with the bar's pages again).
 *
 * Bottom padding follows `env(safe-area-inset-bottom)` so the bar clears the
 * iPhone home indicator inside the Capacitor shell (`viewport-fit=cover` in
 * index.html is what makes that env() non-zero). Hidden while the on-screen
 * keyboard is up, otherwise it floats over the field being typed into.
 * Flex row + logical properties, so RTL just works.
 */
/** The pages the bar itself shows; "More" adds only the others (LT-378). */
export const barPaths = (isRestricted: boolean, leadsSite: boolean): string[] =>
  isRestricted
    ? ['/', '/design']
    : leadsSite
      ? ['/', '/leads', '/lighty', '/schedule-vacations']
      : ['/', '/appointments', '/lighty', '/schedule-vacations'];

const BottomTabBar: React.FC<BottomTabBarProps> = ({ isRestricted = false, leadsSite = false, newLeads, onMore, menuOpen = false, menu, editing = false, rowRef, panelRef }) => {
  const { t } = useTranslation();
  const keyboardOpen = useVirtualKeyboard();
  // LT-414: it no longer slides away on a scroll down (LT-342). Any
  // scroller counted, a page scrolling itself on load included, so the bar
  // went untappable while it still showed.
  // A page with unsaved work (the site editor) is asked about first (LT-267).
  const { guardLinkClick } = useLeaveGuard();
  // LT-256/257: Lighty in the thumb bar on every site, in the same place —
  // Customers, and on a leads site Services, are under "More".
  const lighty = { path: '/lighty', Icon: LightyIcon as unknown as typeof Inbox, label: 'Lighty' };

  const tabs = isRestricted
    ? [
        { path: '/', Icon: LayoutDashboard, label: t('common.dashboard') },
        { path: '/design', Icon: Palette, label: t('common.siteDesign') },
      ]
    : leadsSite
      ? [
          { path: '/', Icon: LayoutDashboard, label: t('common.dashboard') },
          { path: '/leads', Icon: Inbox, label: t('common.leads'), dot: !!newLeads },
          lighty,
          { path: '/schedule-vacations', Icon: Calendar, label: t('common.openingHours') },
        ]
      : [
          { path: '/', Icon: LayoutDashboard, label: t('common.dashboard') },
          { path: '/appointments', Icon: CalendarRange, label: t('common.appointments') },
          lighty,
          { path: '/schedule-vacations', Icon: Calendar, label: t('common.scheduleVacations') },
        ];

  // While typing the bar gets out of the way; an editing page keeps its
  // panel (the field being typed in is in it) and only loses the row.
  if (keyboardOpen && !editing) return null;

  const itemClasses = TAB_ITEM;
  const idleClasses = TAB_IDLE;
  const activeClasses = TAB_ACTIVE;
  const ring = TAB_RING;

  // LT-414: a tap on the bar between items, on a rounded item's corner or on
  // the bar's own edge lands on no item; it goes to the item under that x.
  const tapNearestItem = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as Element;
    if (target.closest('a,button,input,select,textarea,label,[role=dialog]')) return;
    const row = event.currentTarget.querySelector<HTMLElement>('[data-tab-row]');
    if (!row) return;
    const box = row.getBoundingClientRect();
    if (event.clientY < box.top - 8 || event.clientY > box.bottom + 8) return;
    const items = Array.from(row.querySelectorAll<HTMLElement>('a,button'));
    let best: HTMLElement | undefined;
    let bestDistance = Infinity;
    for (const item of items) {
      const r = item.getBoundingClientRect();
      const distance = event.clientX < r.left ? r.left - event.clientX : event.clientX > r.right ? event.clientX - r.right : 0;
      if (distance < bestDistance) { best = item; bestDistance = distance; }
    }
    best?.click();
  };

  return (
    <>
    {/* LT-352: the page dims under the open menu, the floating Lighty (z 50)
        included, and a tap on it closes the menu. The bar and the menu stay
        above it. */}
    <AnimatePresence>
      {menuOpen && (
        <motion.div
          key="phone-menu-backdrop"
          className="md:hidden fixed inset-0 z-[55] bg-slate-900/30 dark:bg-black/50 touch-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onMore}
          aria-hidden="true"
          data-testid="phone-menu-backdrop"
        />
      )}
    </AnimatePresence>
    <nav
      aria-label={t('sidebar.navigation')}
      data-testid="bottom-tab-bar"
      // LT-304: a floating bar — off the edges, rounded, frosted glass, the
      // sidebar's coloured tiles. It floats half the home-indicator inset
      // above the bottom (the other half is the bar's own margin), so pages
      // clearing 4.5rem + the inset still clear it. Stock colours with alpha
      // (white, slate): the theme's own are bare CSS variables, and an
      // opacity modifier on them emits nothing.
      // LT-378: "More" grows this same bar upwards with the pages it lacks,
      // so open it is opaque, with no backdrop blur on the large layer it
      // becomes (WebKit stutters, LT-328).
      onClick={tapNearestItem}
      className={cn(
        'md:hidden fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom)/2)] flex flex-col p-1 rounded-[1.75rem] border border-white/70 dark:border-white/10 shadow-[0_10px_30px_-8px_rgba(76,29,149,0.35)]',
        menuOpen ? 'z-[56] bg-white dark:bg-slate-900' : editing ? 'z-40 bg-white dark:bg-slate-900' : 'z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl',
      )}
    >
      <AnimatePresence initial={false}>{menuOpen && menu}</AnimatePresence>
      {/* The editing page's panel (LT-380); out of sight, not out of the
          tree, while "More" is open, so what is typed in it stays. */}
      {editing && <div ref={panelRef} hidden={menuOpen} data-testid="phone-bar-panel" />}
      {/* No gaps between the items: a tap between two lands on nothing (LT-414). */}
      <div data-tab-row className={cn('flex items-stretch', editing && keyboardOpen && 'hidden')}>
      {editing && <div ref={rowRef} className="contents" data-testid="phone-bar-row" />}
      {!editing && tabs.map(({ path, Icon, label, dot }: { path: string; Icon: typeof Inbox; label: string; dot?: boolean }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          onClick={(event) => guardLinkClick(event, path)}
          className={({ isActive }) => cn(itemClasses, isActive ? activeClasses : idleClasses)}
        >
          {/* The same dot the collapsed sidebar rail puts on the icon. */}
          <span className="relative flex shrink-0">
            {navTile(path, Icon, ring)}
            {dot && (
              <span
                className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900"
                aria-hidden="true"
                data-testid="tab-dot"
              />
            )}
          </span>
          <span className="truncate max-w-full px-1">{label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onMore}
        className={cn(itemClasses, menuOpen ? activeClasses : idleClasses)}
        aria-label={menuOpen ? t('sidebar.closeMenu') : t('sidebar.openMenu')}
        aria-expanded={menuOpen}
        aria-controls="phone-menu"
      >
        {navTile('more', menuOpen ? X : LayoutGrid, '', 'from-slate-400 to-slate-500')}
        <span className="truncate max-w-full px-1">{t('sidebar.more')}</span>
      </button>
      </div>
    </nav>
    </>
  );
};

export default BottomTabBar;
