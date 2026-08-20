import React from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  CalendarRange,
  CreditCard,
  Coins,
  LogOut,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface AdminSidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

/**
 * Sidebar for the operator admin panel (LT-058). A structural copy of the
 * owner Sidebar's shell (same aside classes, NavLink styling, dark-mode
 * toggle, logout) with the admin nav and none of the tenant concerns —
 * no business name, no webConfig, no upgrade card.
 */
const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, toggleSidebar }) => {
  const { t } = useTranslation();
  const { logout, auth } = useAuth();
  const { direction, darkMode, toggleDarkMode } = useTheme();

  const navItems = [
    { path: '/admin', Icon: LayoutDashboard, name: t('admin.nav.overview') },
    { path: '/admin/users', Icon: Users, name: t('admin.nav.users') },
    { path: '/admin/appointments', Icon: CalendarRange, name: t('admin.nav.appointments') },
    { path: '/admin/subscriptions', Icon: CreditCard, name: t('admin.nav.subscriptions') },
    { path: '/admin/costs', Icon: Coins, name: t('admin.nav.costs') },
  ];

  const CollapseIcon = direction === 'rtl'
    ? (isOpen ? ChevronRight : ChevronLeft)
    : (isOpen ? ChevronLeft : ChevronRight);
  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={[
          'fixed md:sticky top-0 h-[100dvh] z-50',
          direction === 'rtl' ? 'right-0 border-l' : 'left-0 border-r',
          'border-gray-200 dark:border-gray-800/60',
          'bg-[#f9f9ff] dark:bg-dark-surface',
          'flex flex-col flex-shrink-0',
          'transition-all duration-300 ease-in-out overflow-hidden',
          isOpen ? 'w-[260px]' : 'w-0 md:w-20',
          'shadow-[4px_0_20px_rgba(0,0,0,0.04)] dark:shadow-none',
        ].join(' ')}
      >
        {/* ── Header ── */}
        <div
          className={[
            'flex items-center px-3 py-4 flex-shrink-0',
            isOpen ? 'justify-between' : 'flex-col gap-2 justify-center',
          ].join(' ')}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={18} className="text-primary" />
            </div>
            {isOpen && (
              <div className="min-w-0">
                <span className="font-bold text-sm text-gray-900 dark:text-dark-text block truncate leading-tight">
                  {t('admin.nav.title')}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-gray-400">Lightor</span>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 hover:bg-gray-200/70 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-500 flex-shrink-0"
            aria-label={isOpen ? t('sidebar.closeSidebar') : t('sidebar.openSidebar')}
          >
            <CollapseIcon size={16} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 px-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <ul className="space-y-0.5">
            {navItems.map(({ path, Icon, name }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === '/admin'}
                  onClick={() => window.innerWidth < 768 && toggleSidebar()}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 active:scale-95',
                      !isOpen && 'justify-center',
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-gray-600 dark:text-dark-gray hover:bg-white dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-dark-text',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {isOpen && <span className="text-sm truncate">{name}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Footer ── */}
        <div
          className={[
            'px-2 pt-3 pb-3 mt-3 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0 space-y-1',
            !isOpen && 'flex flex-col items-center gap-1 space-y-0',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <NavLink
            to="/dashboard"
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full',
              'text-gray-600 dark:text-dark-gray hover:bg-white dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-dark-text transition-colors',
              !isOpen && 'justify-center',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <BackIcon size={18} />
            {isOpen && <span className="text-sm font-medium">{t('admin.nav.backToDashboard')}</span>}
          </NavLink>

          <button
            onClick={logout}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full',
              'text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors',
              !isOpen && 'justify-center',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <LogOut size={18} />
            {isOpen && <span className="text-sm font-medium">{t('common.logout')}</span>}
          </button>

          {/* Dark mode toggle */}
          {isOpen ? (
            <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-2">
                {darkMode ? (
                  <Moon size={14} className="text-gray-400" />
                ) : (
                  <Sun size={14} className="text-gray-400" />
                )}
                <span className="text-xs text-gray-500 dark:text-dark-gray">
                  {darkMode ? 'Dark' : 'Light'}
                </span>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`w-10 h-5 rounded-full relative transition-all duration-300 flex-shrink-0 ${
                  darkMode ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${
                    darkMode ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          ) : (
            <button
              onClick={toggleDarkMode}
              className="p-2.5 text-gray-500 hover:bg-gray-200/70 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          )}

          {isOpen && auth.user && (
            <p className="px-3 pt-1 text-[11px] text-gray-400 truncate" dir="ltr">
              {auth.user.email}
            </p>
          )}
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
