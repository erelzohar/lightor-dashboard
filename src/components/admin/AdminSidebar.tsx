import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  CalendarRange,
  CreditCard,
  Coins,
  LogOut,
  ArrowLeft,
  ArrowRight,
  Moon,
  Sun,
  ShieldCheck,
} from 'lucide-react';
import { Sidebar as SidebarRoot, SidebarBody, SidebarLink, useSidebar } from '../ui/sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

/**
 * Sidebar for the operator admin panel (LT-058), built on the same
 * hover-expand primitives as the owner Sidebar — the admin nav and none of
 * the tenant concerns: no business name, no webConfig, no upgrade card.
 */

const linkClasses =
  'px-2 rounded-lg text-gray-600 dark:text-dark-gray hover:bg-white dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-dark-text transition-colors';

const iconClasses = 'h-5 w-5 flex-shrink-0';

const AdminHeader: React.FC = () => {
  const { open } = useSidebar();
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 py-1 min-w-0 relative z-20">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <ShieldCheck size={16} className="text-primary" />
      </div>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
          <span className="font-bold text-sm text-gray-900 dark:text-dark-text block truncate leading-tight">
            {t('admin.nav.title')}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-gray-400">Lightor</span>
        </motion.div>
      )}
    </div>
  );
};

const AdminFooter: React.FC = () => {
  const { open, setOpen } = useSidebar();
  const { t } = useTranslation();
  const { logout, auth } = useAuth();
  const { direction, darkMode, toggleDarkMode } = useTheme();
  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;
  return (
    <div className="flex flex-col gap-1">
      <SidebarLink
        link={{
          label: t('admin.nav.backToDashboard'),
          href: '/',
          icon: <BackIcon className={iconClasses} />,
        }}
        end
        className={linkClasses}
        onClick={() => window.innerWidth < 768 && setOpen(false)}
      />

      <button
        onClick={logout}
        className="flex items-center justify-start gap-2 group/sidebar py-2 px-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
      >
        <LogOut className={iconClasses} />
        <motion.span
          animate={{ display: open ? 'inline-block' : 'none', opacity: open ? 1 : 0 }}
          className="text-sm whitespace-pre"
        >
          {t('common.logout')}
        </motion.span>
      </button>

      <button
        onClick={toggleDarkMode}
        className="flex items-center justify-start gap-2 group/sidebar py-2 px-2 rounded-lg text-gray-500 hover:bg-white dark:hover:bg-gray-700/50 transition-colors"
      >
        {darkMode ? <Sun className={iconClasses} /> : <Moon className={iconClasses} />}
        <motion.span
          animate={{ display: open ? 'inline-block' : 'none', opacity: open ? 1 : 0 }}
          className="text-sm whitespace-pre"
        >
          {darkMode ? t('settings.lightMode', 'Light') : t('settings.darkMode', 'Dark')}
        </motion.span>
      </button>

      {open && auth.user && (
        <p className="px-2 pt-1 text-[11px] text-gray-400 truncate" dir="ltr">
          {auth.user.email}
        </p>
      )}
    </div>
  );
};

const AdminSidebar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer when the route changes.
  useEffect(() => {
    if (window.innerWidth < 768) setOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/admin', Icon: LayoutDashboard, name: t('admin.nav.overview') },
    { path: '/admin/users', Icon: Users, name: t('admin.nav.users') },
    { path: '/admin/appointments', Icon: CalendarRange, name: t('admin.nav.appointments') },
    { path: '/admin/subscriptions', Icon: CreditCard, name: t('admin.nav.subscriptions') },
    { path: '/admin/costs', Icon: Coins, name: t('admin.nav.costs') },
  ];

  return (
    <SidebarRoot open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-10 bg-[#f9f9ff] dark:bg-dark-surface border-e border-gray-200 dark:border-gray-800/60">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <AdminHeader />
          <div className="mt-6 flex flex-col">
            {navItems.map(({ path, Icon, name }) => (
              <SidebarLink
                key={path}
                end={path === '/admin'}
                link={{
                  label: name,
                  href: path,
                  icon: <Icon className={iconClasses} />,
                }}
                className={linkClasses}
                onClick={() => window.innerWidth < 768 && setOpen(false)}
              />
            ))}
          </div>
        </div>
        <AdminFooter />
      </SidebarBody>
    </SidebarRoot>
  );
};

export default AdminSidebar;
