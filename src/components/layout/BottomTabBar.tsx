import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarRange, UsersRound, Calendar, Menu, Sparkles, Inbox, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useVirtualKeyboard } from '../../hooks/useVirtualKeyboard';

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

  const tabs = isRestricted
    ? [
        { path: '/', Icon: LayoutDashboard, label: t('common.dashboard') },
        { path: '/ai', Icon: Sparkles, label: t('common.aiBuilder') },
      ]
    : leadsSite
      ? [
          { path: '/', Icon: LayoutDashboard, label: t('common.dashboard') },
          { path: '/leads', Icon: Inbox, label: t('common.leads'), dot: !!newLeads },
          { path: '/appointment-types', Icon: Tag, label: t('common.serviceTypes') },
          { path: '/schedule-vacations', Icon: Calendar, label: t('common.openingHours') },
        ]
      : [
          { path: '/', Icon: LayoutDashboard, label: t('common.dashboard') },
          { path: '/appointments', Icon: CalendarRange, label: t('common.appointments') },
          { path: '/customers', Icon: UsersRound, label: t('common.customers') },
          { path: '/schedule-vacations', Icon: Calendar, label: t('common.scheduleVacations') },
        ];

  if (keyboardOpen) return null;

  // Colour lives on the active/idle branches, never on the shared classes:
  // an idle `dark:text-gray-400` would outrank `text-primary` in dark mode.
  const itemClasses =
    'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-1 text-[10px] font-medium leading-tight transition-colors';
  const idleClasses = 'text-gray-500 dark:text-gray-400';
  const activeClasses = 'text-primary dark:text-primary font-semibold';

  return (
    <nav
      aria-label={t('sidebar.navigation')}
      data-testid="bottom-tab-bar"
      // The home-indicator inset is split between top and bottom rather than
      // all sitting below the icons, which made the bar look top-heavy. Same
      // total height, balanced gaps.
      // No `/95` on the dark surface: the theme colours are bare CSS variables
      // (no <alpha-value>), so an opacity modifier silently emits nothing and
      // the bar stayed light in dark mode. Solid surfaces on both themes.
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-gray-200 dark:border-gray-800/60 bg-[#f9f9ff] dark:bg-dark-surface py-[calc(env(safe-area-inset-bottom)/2)]"
    >
      {tabs.map(({ path, Icon, label, dot }: { path: string; Icon: typeof Inbox; label: string; dot?: boolean }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) => cn(itemClasses, isActive ? activeClasses : idleClasses)}
        >
          {/* The same dot the collapsed sidebar rail puts on the icon. */}
          <span className="relative flex shrink-0">
            <Icon className="h-6 w-6" aria-hidden="true" />
            {dot && (
              <span
                className="absolute -top-0.5 -end-0.5 w-2 h-2 rounded-full bg-rose-500"
                aria-hidden="true"
                data-testid="tab-dot"
              />
            )}
          </span>
          <span className="truncate max-w-full px-1">{label}</span>
        </NavLink>
      ))}
      <button type="button" onClick={onMore} className={cn(itemClasses, idleClasses)} aria-label={t('sidebar.openSidebar')}>
        <Menu className="h-6 w-6 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-full px-1">{t('sidebar.more')}</span>
      </button>
    </nav>
  );
};

export default BottomTabBar;
