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
  Palette,
  Moon,
  Sun,
  ShieldCheck,
  Users,
  UsersRound,
  CreditCard,
  Coins,
  ScrollText,
  Inbox,
  Flag,
} from 'lucide-react';
import { Sidebar as SidebarRoot, SidebarBody, SidebarLink, useSidebar } from '../ui/sidebar';
import BottomTabBar, { barPaths } from './BottomTabBar';
import { PhoneMenu, type PhoneMenuSection } from './PhoneMenu';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../hooks/useAppSelector';
import globals from '../../services/globals';
import { useNewLeadsCount, refreshNewLeadsCount } from '../../hooks/useNewLeadsCount';
import { isLeadsSite } from '../../utils/siteMode';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import LightyIcon from '../lighty/LightyIcon';
import { navTile } from './navTiles';

interface SidebarProps {
  isRestricted?: boolean;
}

const ALLOWED_WHEN_RESTRICTED = ['/', '/design'];

const linkClasses =
  'px-1 rounded-xl text-gray-600 dark:text-dark-gray hover:bg-white dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-dark-text transition-colors';

// The active page's ring, by the link's aria-current (LT-278).
const navIcon = (path: string, Icon: typeof Inbox) =>
  navTile(path, Icon, 'group-aria-[current=page]/sidebar:ring-2 group-aria-[current=page]/sidebar:ring-violet-400/80');

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
    <div className="flex items-center gap-3 py-1 px-1 min-w-0 relative z-20">
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
          {/* Explicit colours — the button's muted gray was invisible on the
              dark surface. fill gives the sun a solid bright core. */}
          {darkMode ? (
            <Sun size={15} className="text-amber-400" fill="currentColor" />
          ) : (
            <Moon size={15} className="text-indigo-500" fill="currentColor" />
          )}
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
  const { open } = useSidebar();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, auth } = useAuth();
  // Unsaved work asks before either button leaves it (LT-267).
  const { confirmLeave } = useLeaveGuard();
  return (
    <div className="flex flex-col gap-1">
      {/* LT-362: named, since the folded rail hides the text. */}
      <button
        onClick={() => confirmLeave(() => navigate('/account'), '/account')}
        aria-label={[auth.user?.name, auth.user?.email].filter(Boolean).join(' ') || undefined}
        className="flex items-center justify-start gap-2 group/sidebar py-2 px-1 rounded-xl hover:bg-white dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-lg shadow-primary/20">
          {auth.user?.name?.charAt(0).toUpperCase() || 'A'}
        </div>
        {/* The name, and under it the email the owner signs in with (LT-364).
            <bdi> keeps the address in its own order inside Hebrew without
            turning the line's alignment. */}
        <motion.span
          animate={{ display: open ? 'flex' : 'none', opacity: open ? 1 : 0 }}
          className="min-w-0 flex-col text-start"
        >
          <span className="text-sm text-gray-700 dark:text-dark-text whitespace-pre truncate">{auth.user?.name}</span>
          {auth.user?.email && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              <bdi>{auth.user.email}</bdi>
            </span>
          )}
        </motion.span>
      </button>

      <button
        onClick={() => confirmLeave(logout)}
        aria-label={t('common.logout')}
        className="flex items-center justify-start gap-2 group/sidebar py-2 px-1 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
      >
        <span className="w-7 h-7 flex items-center justify-center flex-shrink-0">
          <LogOut className={iconClasses} />
        </span>
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
  // The phone's menu (LT-352), apart from the desktop rail's hover state.
  const [menuOpen, setMenuOpen] = useState(false);
  // A page with unsaved work (the site editor) is asked about first (LT-267).
  const { guardLinkClick } = useLeaveGuard();
  // New leads (LT-197), re-read on every navigation so the badge follows.
  const newLeads = useNewLeadsCount(false);
  // A leads site (LT-199) has no calendar: no Appointments and no Customers
  // (customers are booking-only), the leads are the daily destination, and
  // the weekly hours are just the hours the site shows. The routes stay
  // reachable by URL — a push tap for a lead opens /leads either way.
  const webConfig = useAppSelector((state) => state.webConfig.data);
  const leadsSite = isLeadsSite(webConfig);
  const leadsLink = { path: '/leads', Icon: Inbox, name: t('common.leads'), badge: newLeads ?? undefined };
  // LT-253: Lighty, the business chat — his face for an icon.
  const lightyLink = { path: '/lighty', Icon: LightyIcon as unknown as typeof Inbox, name: 'Lighty' };

  // The phone menu closes when the route changes.
  useEffect(() => {
    setMenuOpen(false);
    if (!isRestricted) void refreshNewLeadsCount();
  }, [location.pathname, isRestricted]);

  const navSections = [
    {
      id: 'navigation',
      label: t('sidebar.navigation'),
      items: leadsSite
        ? [
            { path: '/', Icon: LayoutDashboard, name: t('common.dashboard') },
            lightyLink,
            { path: '/design', Icon: Palette, name: t('common.siteDesign') },
            leadsLink,
          ]
        : [
            { path: '/', Icon: LayoutDashboard, name: t('common.dashboard') },
            lightyLink,
            { path: '/design', Icon: Palette, name: t('common.siteDesign') },
            { path: '/appointments', Icon: CalendarRange, name: t('common.appointments') },
          ],
    },
    {
      id: 'manage',
      label: t('sidebar.manage'),
      items: [
        ...(leadsSite
          ? [{ path: '/schedule-vacations', Icon: Calendar, name: t('common.openingHours') }]
          : [
              { path: '/customers', Icon: UsersRound, name: t('common.customers') },
              leadsLink,
              { path: '/schedule-vacations', Icon: Calendar, name: t('common.scheduleVacations') },
            ]),
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
            id: 'admin',
            label: t('sidebar.admin'),
            items: [
              { path: '/admin', Icon: ShieldCheck, name: t('admin.nav.overview') },
              { path: '/admin/users', Icon: Users, name: t('admin.nav.users') },
              { path: '/admin/appointments', Icon: CalendarRange, name: t('admin.nav.appointments') },
              { path: '/admin/subscriptions', Icon: CreditCard, name: t('admin.nav.subscriptions') },
              { path: '/admin/costs', Icon: Coins, name: t('admin.nav.costs') },
              { path: '/admin/logs', Icon: ScrollText, name: t('admin.nav.logs') },
              { path: '/admin/reports', Icon: Flag, name: t('admin.nav.reports') },
            ],
          },
        ]
      : []),
  ];

  // What "More" adds to the phone bar (LT-378): the same pages under the same
  // restriction, minus those the bar already shows. The owner's pages run on
  // as one row of the bar's tiles (no captions for a handful); the
  // operator's admin pages keep their own caption.
  const inBar = new Set(barPaths(isRestricted, leadsSite));
  const allowed = ({ path }: { path: string }) =>
    !inBar.has(path) && (!isRestricted || ALLOWED_WHEN_RESTRICTED.includes(path));
  const phoneSections: PhoneMenuSection[] = [
    { id: 'pages', label: '', items: navSections.filter((s) => s.id !== 'admin').flatMap((s) => s.items).filter(allowed) },
    ...navSections.filter((s) => s.id === 'admin').map((s) => ({ id: s.id, label: s.label, items: s.items.filter(allowed) })),
  ].filter((section) => section.items.length > 0);

  return (
    <SidebarRoot open={open} setOpen={setOpen}>
      <SidebarBody aria-label={t('sidebar.navigation')} className="justify-between gap-10 bg-[#f9f9ff] dark:bg-dark-surface border-e border-gray-200 dark:border-gray-800/60">
        {/* -mx-1 px-1: the clip box (overflow-x-hidden, for the collapse) reaches
            4 px past the content, so the active tile's ring is not cut at the
            rail's edge (LT-285). */}
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide -mx-1 px-1">
          <SidebarHeader />
          <div className="flex flex-col">
            {navSections.map((section, sIdx) => (
              // One group per section, named by its caption, so the grouping
              // is announced and not only drawn. Keyed by a fixed id, never the
              // caption (LT-291): two captions can read the same in one
              // language (Arabic's "manage" and "admin"), and a duplicate key
              // left a stale group of nameless icons behind after a switch.
              <div key={section.id} role="group" aria-label={section.label} className="flex flex-col">
                <SectionLabel label={section.label} first={sIdx === 0} />
                {section.items.map(({ path, Icon, name, badge }: { path: string; Icon: typeof Inbox; name: string; badge?: number }) => {
                  if (isRestricted && !ALLOWED_WHEN_RESTRICTED.includes(path)) return null;
                  return (
                    <SidebarLink
                      key={path}
                      end={path === '/' || path === '/admin'}
                      link={{
                        label: name,
                        href: path,
                        icon: navIcon(path, Icon),
                        badge,
                      }}
                      className={linkClasses}
                      onClick={(event) => guardLinkClick(event, path)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <SidebarFooter />
      </SidebarBody>
      {/* Phone-only thumb bar (LT-127); "More" grows it with the other pages (LT-378). */}
      <BottomTabBar
        isRestricted={isRestricted}
        leadsSite={leadsSite}
        newLeads={newLeads}
        menuOpen={menuOpen}
        onMore={() => setMenuOpen((wasOpen) => !wasOpen)}
        menu={<PhoneMenu key="phone-menu" sections={phoneSections} onClose={() => setMenuOpen(false)} />}
      />
    </SidebarRoot>
  );
};

export default Sidebar;
