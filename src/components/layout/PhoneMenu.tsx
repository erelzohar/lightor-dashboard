import React, { useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LifeBuoy, LogOut, Moon, Sun, type Inbox } from 'lucide-react';
import { openReportProblem } from '../support/ReportProblem';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import { navTile, TAB_ITEM, TAB_IDLE, TAB_ACTIVE, TAB_RING } from './navTiles';

export interface PhoneMenuItem {
  path: string;
  Icon: typeof Inbox;
  name: string;
  badge?: number;
}

export interface PhoneMenuSection {
  id: string;
  label: string;
  items: PhoneMenuItem[];
}

/**
 * What "More" adds to the phone's tab bar (LT-378). Erel: the bar itself
 * should grow with the other pages, not open another menu that repeats the
 * bar's own (LT-352 did). So this is drawn inside the bar, above its row:
 * the pages the bar does not show, as the bar's own tiles in its five
 * columns, then the account, the theme and logging out. The caller leaves
 * the bar's pages out. Escape, "More" again, a tap outside or a page closes
 * it. A section without a label (the owner's pages) has no caption; the
 * operator's admin pages keep theirs.
 */
export const PhoneMenu: React.FC<{ sections: PhoneMenuSection[]; onClose: () => void }> = ({ sections, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { auth, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  // Unsaved work asks before a page, the account or logging out leaves it (LT-267).
  const { guardLinkClick, confirmLeave } = useLeaveGuard();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    // LT-441: a sheet that slides up from behind the bar's row, moved by
    // transform alone. It grew the bar by animating its height (LT-378):
    // a layout and a repaint of the whole bar and its shadow on every frame,
    // which stutters on phones. The bar keeps its size now; the box above it
    // clips the sheet at the bar's top band, where the row is drawn over it.
    <div className="absolute -inset-x-3 bottom-[calc(100%-1.75rem)] px-3 pt-8 overflow-hidden pointer-events-none" data-testid="phone-menu-clip">
    <motion.div
      id="phone-menu"
      role="region"
      aria-label={t('sidebar.menu')}
      data-testid="phone-menu"
      // A whole transform string, not \`y\`: framer hands it to the browser's
      // own animation (WAAPI), so it runs off the main thread even while a
      // page is being built under it.
      initial={{ transform: 'translateY(100%)' }}
      animate={{ transform: 'translateY(0%)' }}
      exit={{ transform: 'translateY(100%)' }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      className="pointer-events-auto -mx-px px-1 pt-1 rounded-t-[1.75rem] border border-b-0 border-white/70 dark:border-white/10 bg-white dark:bg-slate-900 shadow-[0_-10px_30px_-14px_rgba(76,29,149,0.3)] will-change-transform"
    >
      {/* Capped under the status bar: an operator's admin pages scroll here. */}
      <div
        style={{ maxHeight: 'calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom) / 2 - 9rem)' }}
        className="overflow-y-auto overscroll-contain"
      >
        <div className="flex items-center gap-2 px-2 pt-2 pb-1.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              confirmLeave(() => navigate('/account'), '/account');
            }}
            className="flex-1 min-w-0 flex items-center gap-2 rounded-xl px-1.5 py-1 text-start hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-lg shadow-primary/20">
              {auth.user?.name?.charAt(0).toUpperCase() || 'A'}
            </span>
            {/* The name, and under it the sign-in email (LT-364). */}
            <span className="min-w-0 flex flex-col">
              <span className="text-sm text-gray-700 dark:text-dark-text truncate">{auth.user?.name}</span>
              {auth.user?.email && (
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  <bdi>{auth.user.email}</bdi>
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={darkMode ? t('settings.lightMode', 'Light mode') : t('settings.darkMode', 'Dark mode')}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
          >
            {darkMode ? (
              <Sun size={16} className="text-amber-400" fill="currentColor" />
            ) : (
              <Moon size={16} className="text-indigo-500" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              confirmLeave(logout);
            }}
            aria-label={t('common.logout')}
            title={t('common.logout')}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {sections.map((section) => (
          <section key={section.id} aria-label={section.label || undefined} className="pt-1">
            {section.label && (
              <h3 className="px-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{section.label}</h3>
            )}
            {/* The bar's five columns, so the new pages line up with its own. */}
            <div className="grid grid-cols-5 gap-0.5">
              {section.items.map(({ path, Icon, name, badge }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/' || path === '/admin'}
                  onClick={(event) => {
                    guardLinkClick(event, path);
                    onClose();
                  }}
                  className={({ isActive }) => cn(TAB_ITEM, 'min-h-[52px]', isActive ? TAB_ACTIVE : TAB_IDLE)}
                >
                  <span className="relative flex shrink-0">
                    {navTile(path, Icon, TAB_RING)}
                    {!!badge && (
                      <span
                        className="absolute -top-1.5 -end-2 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-[1.125rem] text-center tabular-nums ring-2 ring-white dark:ring-slate-900"
                        data-testid="menu-badge"
                      >
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 break-words text-center max-w-full px-0.5">{name}</span>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </div>
      {/* LT-448: tell Lightor about a problem. */}
      <button
        type="button"
        onClick={() => {
          onClose();
          openReportProblem();
        }}
        className="mx-1 mt-1 flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <LifeBuoy className="h-4 w-4 text-violet-500" aria-hidden="true" />
        {t('support.report.open')}
      </button>
      {/* Where the bar's own row starts. */}
      <div className="mx-2 mt-1 mb-1 border-t border-gray-100 dark:border-white/10" aria-hidden="true" />
      {/* The part behind the bar's top band (its corner radius). */}
      <div className="h-7" aria-hidden="true" />
    </motion.div>
    </div>
  );
};
