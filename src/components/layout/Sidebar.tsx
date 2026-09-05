import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  CalendarRange,
  Settings,
  LogOut,
  Tag,
  Calendar,
  Image as ImageIcon,
  Sparkles,
  Moon,
  Sun,
  ShieldCheck,
  Users,
  CreditCard,
  Coins,
} from 'lucide-react';
import { Sidebar as SidebarRoot, SidebarBody, SidebarLink, useSidebar } from '../ui/sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../hooks/useAppSelector';
import globals from '../../services/globals';

interface SidebarProps {
  isRestricted?: boolean;
}

const ALLOWED_WHEN_RESTRICTED = ['/', '/ai'];

const linkClasses =
  'px-2 rounded-lg text-gray-600 dark:text-dark-gray hover:bg-white dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-dark-text transition-colors';

const iconClasses = 'h-5 w-5 flex-shrink-0';

// Same resolution as Settings: full URLs pass through, bare names are S3
// image ids served by the images API.
const resolveLogoUrl = (imgName?: string): string => {
  if (!imgName) return '';
  if (imgName.startsWith('http') || imgName.startsWith('data:') || imgName.startsWith('blob:')) return imgName;
  return globals.imagesUrl + imgName;
};

/** Business logo + name, with the round theme toggle beside them while expanded. */
const SidebarHeader: React.FC = () => {
  const { open } = useSidebar();
  const { t } = useTranslation();
  const { auth } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const webConfig = useAppSelector((state) => state.webConfig.data);
  const logoUrl = resolveLogoUrl(webConfig?.logoImageName);
  return (
    <div className="flex items-center gap-3 py-1 min-w-0 relative z-20">
      <img
        src={logoUrl || '/lightor.svg'}
        alt={webConfig?.businessName || 'Lightor'}
        className="w-7 h-7 flex-shrink-0 rounded-lg object-cover"
        onError={(e) => {
          // A dead logo URL (or the local no-S3-creds case) falls back to the
          // Lightor mark; the src guard stops a loop if that ever 404s too.
          const img = e.currentTarget;
          if (!img.src.endsWith('/lightor.svg')) img.src = '/lightor.svg';
        }}
      />
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0 flex-1">
          <span className="font-bold text-sm text-gray-900 dark:text-dark-text block truncate leading-tight">
            {webConfig?.businessName || auth?.user.name}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-gray-400">Lightor</span>
        </motion.div>
      )}
      {open && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={toggleDarkMode}
          aria-label={darkMode ? t('settings.lightMode', 'Light mode') : t('settings.darkMode', 'Dark mode')}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 text-gray-500 hover:text-primary hover:border-primary/40 transition-colors shadow-sm"
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </motion.button>
      )}
    </div>
  );
};

/** Section caption while expanded, a thin divider while collapsed. */
const SectionLabel: React.FC<{ label: string; first?: boolean }> = ({ label, first }) => {
  const { open } = useSidebar();
  if (open) {
    return (
      <p
        className={`px-2 mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400 select-none whitespace-pre ${
          first ? 'mt-6' : 'mt-5'
        }`}
      >
        {label}
      </p>
    );
  }
  return first ? (
    <div className="mt-6 mb-1" />
  ) : (
    <div className="mx-1 my-3 h-px bg-gray-200 dark:bg-gray-700/50" />
  );
};

/** Footer: account avatar and logout (the theme toggle lives in the header). */
const SidebarFooter: React.FC = () => {
  const { open, setOpen } = useSidebar();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, auth } = useAuth();
  const closeOnMobile = () => window.innerWidth < 768 && setOpen(false);
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => {
          closeOnMobile();
          navigate('/account');
        }}
        className="flex items-center justify-start gap-2 group/sidebar py-2 px-2 rounded-lg hover:bg-white dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-lg shadow-primary/20">
          {auth.user?.name?.charAt(0).toUpperCase() || 'A'}
        </div>
        <motion.span
          animate={{ display: open ? 'inline-block' : 'none', opacity: open ? 1 : 0 }}
          className="text-sm text-gray-700 dark:text-dark-text whitespace-pre truncate text-start"
        >
          {auth.user?.name}
        </motion.span>
      </button>

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

    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ isRestricted = false }) => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer when the route changes.
  useEffect(() => {
    if (window.innerWidth < 768) setOpen(false);
  }, [location.pathname]);

  const navSections = [
    {
      label: t('sidebar.navigation'),
      items: [
        { path: '/', Icon: LayoutDashboard, name: t('common.dashboard') },
        { path: '/ai', Icon: Sparkles, name: t('common.aiBuilder') },
        { path: '/appointments', Icon: CalendarRange, name: t('common.appointments') },
      ],
    },
    {
      label: t('sidebar.manage'),
      items: [
        { path: '/schedule-vacations', Icon: Calendar, name: t('common.scheduleVacations') },
        { path: '/appointment-types', Icon: Tag, name: t('common.serviceTypes') },
        { path: '/portfolio', Icon: ImageIcon, name: t('common.portfolio') },
        { path: '/settings', Icon: Settings, name: t('common.settings') },
      ],
    },
    // Operator-only section (LT-058). Reading role here is display logic —
    // the API refuses non-admins regardless of what the client renders.
    ...(auth.user?.role === 'admin'
      ? [
          {
            label: t('sidebar.admin'),
            items: [
              { path: '/admin', Icon: ShieldCheck, name: t('admin.nav.overview') },
              { path: '/admin/users', Icon: Users, name: t('admin.nav.users') },
              { path: '/admin/appointments', Icon: CalendarRange, name: t('admin.nav.appointments') },
              { path: '/admin/subscriptions', Icon: CreditCard, name: t('admin.nav.subscriptions') },
              { path: '/admin/costs', Icon: Coins, name: t('admin.nav.costs') },
            ],
          },
        ]
      : []),
  ];

  return (
    <SidebarRoot open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-10 bg-[#f9f9ff] dark:bg-dark-surface border-e border-gray-200 dark:border-gray-800/60">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <SidebarHeader />
          <div className="flex flex-col">
            {navSections.map((section, sIdx) => (
              <React.Fragment key={section.label}>
                <SectionLabel label={section.label} first={sIdx === 0} />
                {section.items.map(({ path, Icon, name }) => {
                  if (isRestricted && !ALLOWED_WHEN_RESTRICTED.includes(path)) return null;
                  return (
                    <SidebarLink
                      key={path}
                      end={path === '/' || path === '/admin'}
                      link={{
                        label: name,
                        href: path,
                        icon: <Icon className={iconClasses} />,
                      }}
                      className={linkClasses}
                      onClick={() => window.innerWidth < 768 && setOpen(false)}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <SidebarFooter />
      </SidebarBody>
    </SidebarRoot>
  );
};

export default Sidebar;
