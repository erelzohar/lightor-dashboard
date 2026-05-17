import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  CalendarRange,
  Settings,
  LogOut,
  Tag,
  Calendar,
  Image as ImageIcon,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Search,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../hooks/useAppSelector';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  isRestricted?: boolean;
}

const ALLOWED_WHEN_RESTRICTED = ['/dashboard', '/dashboard/ai'];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, isRestricted = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, auth } = useAuth();
  const { direction, darkMode, toggleDarkMode } = useTheme();
  const businessName = useAppSelector(state => state.webConfig.data?.businessName);

  const navSections = [
    {
      label: t('sidebar.navigation'),
      items: [
        { path: '/dashboard', Icon: LayoutDashboard, name: t('common.dashboard') },
        { path: '/dashboard/ai', Icon: Sparkles, name: t('common.aiBuilder') },
        { path: '/dashboard/appointments', Icon: CalendarRange, name: t('common.appointments') },
      ],
    },
    {
      label: t('sidebar.manage'),
      items: [
        { path: '/dashboard/schedule-vacations', Icon: Calendar, name: t('common.scheduleVacations') },
        { path: '/dashboard/appointment-types', Icon: Tag, name: t('common.serviceTypes') },
        { path: '/dashboard/portfolio', Icon: ImageIcon, name: t('common.portfolio') },
        { path: '/dashboard/settings', Icon: Settings, name: t('common.settings') },
      ],
    },
  ];

  // Collapse icon respects RTL direction
  const CollapseIcon = direction === 'rtl'
    ? (isOpen ? ChevronRight : ChevronLeft)
    : (isOpen ? ChevronLeft : ChevronRight);

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

      {/* Sidebar */}
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
            <img src="/lightor.svg" alt="Lightor" className="w-8 h-8 flex-shrink-0" />
            {isOpen && (
              <div className="min-w-0">
                <span className="font-bold text-sm text-gray-900 dark:text-dark-text block truncate leading-tight">
                  {businessName || auth?.user.name}
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

        {/* ── Search ── */}
        {/* {isOpen && (
          <div className="px-3 mb-3 flex-shrink-0">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-9 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none placeholder:text-gray-400 transition-all text-gray-700 dark:text-dark-text"
                placeholder={t('common.search')}
                type="text"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 leading-none select-none">
                /
              </span>
            </div>
          </div>
        )} */}

        {/* ── Navigation ── */}
        <nav className="flex-1 px-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {navSections.map((section, sIdx) => (
            <div key={section.label} className={sIdx > 0 ? 'mt-5' : ''}>
              {isOpen ? (
                <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 select-none">
                  {section.label}
                </p>
              ) : (
                sIdx > 0 && <div className="mx-3 mb-3 h-px bg-gray-200 dark:bg-gray-700/50" />
              )}
              <ul className="space-y-0.5">
                {section.items.map(({ path, Icon, name }) => {
                  if (isRestricted && !ALLOWED_WHEN_RESTRICTED.includes(path)) return null;
                  return (
                    <li key={path}>
                      <NavLink
                        to={path}
                        end
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
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── User Profile Card ── */}
        {isOpen ? (
          <div
            className="mx-2 mt-4 p-4 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 cursor-pointer hover:border-primary/20 transition-all flex-shrink-0"
            onClick={() => navigate('/dashboard/account')}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg shadow-primary/20">
                {auth.user?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-dark-text truncate">
                  {auth.user?.name}
                </p>
                <p className="text-[11px] text-gray-400">{t('common.accountSettings')}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] px-2 py-1 rounded-md font-medium ${
                  auth.user?.subscription?.status === 'active'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                }`}
              >
                {auth.user?.subscription?.status === 'active'
                  ? t('common.premiumAccount')
                  : t('common.basicAccount')}
              </span>
              {auth.user?.subscription?.status !== 'active' && (
                <span className="text-[11px] text-primary font-medium cursor-pointer hover:underline">
                  {t('common.upgrade')} →
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-3 flex-shrink-0">
            <div
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center text-sm font-bold cursor-pointer shadow-lg shadow-primary/20"
              onClick={() => navigate('/dashboard/account')}
              title={auth.user?.name}
            >
              {auth.user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div
          className={[
            'px-2 pt-3 pb-3 mt-3 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0 space-y-1',
            !isOpen && 'flex flex-col items-center gap-1 space-y-0',
          ]
            .filter(Boolean)
            .join(' ')}
        >
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
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
