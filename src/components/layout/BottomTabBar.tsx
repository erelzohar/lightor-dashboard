import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarRange, Calendar, Menu, Palette, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useVirtualKeyboard } from '../../hooks/useVirtualKeyboard';
import { useHideOnScroll } from '../../hooks/useHideOnScroll';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import LightyIcon from '../lighty/LightyIcon';
import { navTile } from './navTiles';

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
  /** Opens the full drawer (the long tail of pages lives there). */
  onMore: () => void;
}

/**
 * Phone navigation (LT-127, mobile plan phase 0).
 *
 * Under the `md` breakpoint the hover-rail sidebar collapses to a hamburger,
 * which makes every page change a two-tap trip through a full-screen drawer.
 * Native apps put the four daily destinations in a thumb-reach bar instead;
 * this is that bar. The drawer stays for everything else, behind "More".
 *
 * Bottom padding follows `env(safe-area-inset-bottom)` so the bar clears the
 * iPhone home indicator inside the Capacitor shell (`viewport-fit=cover` in
 * index.html is what makes that env() non-zero). Hidden while the on-screen
 * keyboard is up, otherwise it floats over the field being typed into.
 * Flex row + logical properties, so RTL just works.
 */
const BottomTabBar: React.FC<BottomTabBarProps> = ({ isRestricted = false, leadsSite = false, newLeads, onMore }) => {
  const { t } = useTranslation();
  const keyboardOpen = useVirtualKeyboard();
  // Scrolling down, it slides away; up, or on another page, it is back (LT-342).
  const { pathname } = useLocation();
  const scrolledAway = useHideOnScroll(pathname);
  // A page with unsaved work (the site editor) is asked about first (LT-267).
  const { guardLinkClick } = useLeaveGuard();
  // LT-256/257: Lighty in the thumb bar on every site, in the same place —
  // Customers (booking sites) and Services (leads sites) are under "More".
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

  if (keyboardOpen) return null;

  // Colour lives on the active/idle branches, never on the shared classes:
  // an idle `dark:text-gray-400` would outrank `text-primary` in dark mode.
  const itemClasses =
    'group/tab flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-1 rounded-[1.25rem] text-[10px] font-medium leading-tight transition-colors';
  const idleClasses = 'text-gray-500 dark:text-gray-400';
  const activeClasses = 'text-primary dark:text-primary font-semibold bg-violet-500/10 dark:bg-white/10';
  // The active page: a ring around its tile, as in the sidebar (LT-278).
  const ring = 'group-aria-[current=page]/tab:ring-2 group-aria-[current=page]/tab:ring-violet-400/80';

  return (
    <nav
      aria-label={t('sidebar.navigation')}
      data-testid="bottom-tab-bar"
      // LT-304: a floating bar — off the edges, rounded, frosted glass, the
      // sidebar's coloured tiles. It floats half the home-indicator inset
      // above the bottom (the other half is the bar's own margin), so pages
      // clearing 4.5rem + the inset still clear it. Stock colours with alpha
      // (white, slate): the theme's own are bare CSS variables, and an
      // opacity modifier on them emits nothing.
      data-hidden={scrolledAway || undefined}
      className={cn(
        'md:hidden fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom)/2)] z-40 flex items-stretch gap-0.5 p-1 rounded-[1.75rem] border border-white/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-[0_10px_30px_-8px_rgba(76,29,149,0.35)]',
        'transition-transform duration-300 ease-out',
        scrolledAway && 'translate-y-[calc(100%+1.5rem+env(safe-area-inset-bottom))] pointer-events-none'
      )}
    >
      {tabs.map(({ path, Icon, label, dot }: { path: string; Icon: typeof Inbox; label: string; dot?: boolean }) => (
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
      <button type="button" onClick={onMore} className={cn(itemClasses, idleClasses)} aria-label={t('sidebar.openSidebar')}>
        {navTile('more', Menu, '', 'from-slate-400 to-slate-500')}
        <span className="truncate max-w-full px-1">{t('sidebar.more')}</span>
      </button>
    </nav>
  );
};

export default BottomTabBar;
