import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarRange, UsersRound, Calendar, Menu, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useVirtualKeyboard } from '../../hooks/useVirtualKeyboard';

interface BottomTabBarProps {
  /** Not-yet-onboarded accounts only get the pages the drawer allows them. */
  isRestricted?: boolean;
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
const BottomTabBar: React.FC<BottomTabBarProps> = ({ isRestricted = false, onMore }) => {
  const { t } = useTranslation();
  const keyboardOpen = useVirtualKeyboard();

  const tabs = isRestricted
    ? [
        { path: '/', Icon: LayoutDashboard, label: t('common.dashboard') },
        { path: '/ai', Icon: Sparkles, label: t('common.aiBuilder') },
      ]
    : [
        { path: '/', Icon: LayoutDashboard, label: t('common.dashboard') },
        { path: '/appointments', Icon: CalendarRange, label: t('common.appointments') },
        { path: '/customers', Icon: UsersRound, label: t('common.customers') },
        { path: '/schedule-vacations', Icon: Calendar, label: t('common.scheduleVacations') },
      ];

  if (keyboardOpen) return null;

  const itemClasses =
    'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-1.5 text-[10px] font-medium leading-tight text-gray-500 dark:text-gray-400 transition-colors';

  return (
    <nav
      aria-label={t('sidebar.navigation')}
      data-testid="bottom-tab-bar"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-gray-200 dark:border-gray-800/60 bg-[#f9f9ff]/95 dark:bg-dark-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map(({ path, Icon, label }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) => cn(itemClasses, isActive && 'text-primary font-semibold')}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="truncate max-w-full px-1">{label}</span>
        </NavLink>
      ))}
      <button type="button" onClick={onMore} className={itemClasses} aria-label={t('sidebar.openSidebar')}>
        <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-full px-1">{t('sidebar.more')}</span>
      </button>
    </nav>
  );
};

export default BottomTabBar;
