import React, { useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, useDragControls, type PanInfo } from 'framer-motion';
import { LogOut, Moon, Sun, type Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import { useAppSelector } from '../../hooks/useAppSelector';
import { resolveImage } from '../../utils/images';
import { bigNavTile } from './navTiles';

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
 * The phone's full menu (LT-352). Erel: the side drawer "looks unrelated on
 * the phone". Every page is a tile now, on a sheet that rises out of the tab
 * bar and stays attached to it ("More" becomes its close button). A tap
 * outside, Escape, a pull down on the grip or a page closes it. Opaque, with
 * no backdrop blur: a large blurred layer stutters in WebKit (LT-328).
 */
export const PhoneMenu: React.FC<{ sections: PhoneMenuSection[]; onClose: () => void }> = ({ sections, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { auth, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  // Unsaved work asks before a page, the account or logging out leaves it (LT-267).
  const { guardLinkClick, confirmLeave } = useLeaveGuard();
  const webConfig = useAppSelector((state) => state.webConfig.data);
  const logo = webConfig?.logoImageName ? resolveImage(webConfig.logoImageName) : '/lightor.svg';
  const drag = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Focus moves in on open and goes back on close, unless something else
  // took it meanwhile (the leave question a guarded page opens). Escape
  // closes, and Tab goes round the sheet.
  useEffect(() => {
    const sheet = sheetRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheet?.focus();
    const focusables = () =>
      Array.from(sheet?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const now = document.activeElement;
      if (!now || now === document.body || sheet?.contains(now)) opener?.focus();
    };
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 70 || info.velocity.y > 500) onClose();
  };

  return (
    <motion.div
      ref={sheetRef}
      id="phone-menu"
      role="dialog"
      aria-modal="true"
      aria-label={t('sidebar.menu')}
      tabIndex={-1}
      data-testid="phone-menu"
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      drag="y"
      dragControls={drag}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={onDragEnd}
      // Above the bar, as wide as it, never under the status bar.
      style={{ maxHeight: 'calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom) / 2 - 6rem)' }}
      className="absolute bottom-full mb-2 inset-x-0 origin-bottom flex flex-col rounded-[1.75rem] border border-white/70 dark:border-white/10 bg-white dark:bg-slate-900 shadow-[0_-12px_40px_-12px_rgba(76,29,149,0.35)] outline-none overflow-hidden"
    >
      {/* The grip: pull down to close. */}
      <div
        className="flex justify-center pt-2 pb-1 cursor-grab touch-none shrink-0"
        onPointerDown={(e) => drag.start(e)}
        aria-hidden="true"
      >
        <span className="block w-10 h-1.5 rounded-full bg-gray-200 dark:bg-white/20" />
      </div>

      <div className="flex items-center gap-3 px-4 pb-2 shrink-0">
        <img
          src={logo}
          alt=""
          className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.endsWith('/lightor.svg')) img.src = '/lightor.svg';
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-gray-900 dark:text-dark-text truncate leading-tight">
            {webConfig?.businessName || auth?.user?.name}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-gray-400">Lightor</p>
        </div>
        <button
          type="button"
          onClick={toggleDarkMode}
          aria-label={darkMode ? t('settings.lightMode', 'Light mode') : t('settings.darkMode', 'Dark mode')}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm"
        >
          {darkMode ? (
            <Sun size={16} className="text-amber-400" fill="currentColor" />
          ) : (
            <Moon size={16} className="text-indigo-500" fill="currentColor" />
          )}
        </button>
      </div>

      {/* Four to a row (three on the narrowest phones), so the menu takes about
          half the screen: a sheet, not a second page. */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 space-y-2.5">
        {sections.map((section) => (
          <section key={section.id} aria-label={section.label}>
            <h3 className="px-1 mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">{section.label}</h3>
            <div className="grid grid-cols-3 min-[350px]:grid-cols-4 gap-2">
              {section.items.map(({ path, Icon, name, badge }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/' || path === '/admin'}
                  onClick={(event) => {
                    guardLinkClick(event, path);
                    onClose();
                  }}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1.5 rounded-2xl px-1 pt-2.5 pb-2 min-h-[76px] text-center text-[11.5px] leading-tight border transition-transform active:scale-95',
                      isActive
                        ? 'bg-violet-50 dark:bg-violet-500/15 border-violet-200 dark:border-violet-400/40 text-primary dark:text-primary font-semibold'
                        : 'bg-gray-50 dark:bg-white/[0.04] border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-200 font-medium'
                    )
                  }
                >
                  <span className="relative flex">
                    {bigNavTile(path, Icon)}
                    {!!badge && (
                      <span
                        className="absolute -top-1.5 -end-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold leading-5 text-center tabular-nums ring-2 ring-white dark:ring-slate-900"
                        data-testid="menu-badge"
                      >
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 break-words">{name}</span>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-gray-100 dark:border-white/10 px-3 py-2.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            onClose();
            confirmLeave(() => navigate('/account'), '/account');
          }}
          className="flex-1 min-w-0 flex items-center gap-2 rounded-xl px-2 py-1.5 text-start hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-lg shadow-primary/20">
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
          onClick={() => {
            onClose();
            confirmLeave(logout);
          }}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t('common.logout')}
        </button>
      </div>
    </motion.div>
  );
};
