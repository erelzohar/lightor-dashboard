import React, { useState, createContext, useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

/**
 * Collapsible hover-expand sidebar (vendored from 21st.dev, adapted for this
 * app: react-router NavLink instead of next/link, no "use client", RTL-aware
 * mobile drawer). Desktop: a 60px icon rail that expands to 300px on hover.
 * Mobile: a top strip with a menu button opening a full-screen drawer.
 */

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
  /** A count beside the label (on the icon while collapsed), e.g. new leads (LT-197). */
  badge?: number;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as unknown as React.ComponentProps<'div'>)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        'h-full px-4 py-4 hidden md:flex md:flex-col bg-neutral-100 dark:bg-neutral-800 w-[300px] flex-shrink-0',
        className
      )}
      animate={{
        width: animate ? (open ? '300px' : '60px') : '300px',
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) => {
  const { open, setOpen } = useSidebar();
  const { t } = useTranslation();
  // Drawer slides in from the sidebar's own edge — mirrored under RTL.
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const offscreen = rtl ? '100%' : '-100%';
  return (
    <>
      {/* No phone top bar (LT-210): it held only a menu button, and the
          bottom tab bar's "More" opens this same drawer. What is left is the
          drawer itself, which is fixed and takes no room in the page. */}
      <div className="md:hidden" {...props}>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: offscreen, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: offscreen, opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: 'easeInOut',
              }}
              className={cn(
                'fixed h-full w-full inset-0 bg-white dark:bg-neutral-900 p-10 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col justify-between',
                className
              )}
            >
              {/* In flow, not absolute — the header row's round theme toggle
                  lives in the same corner, and an overlaid X sat on top of it. */}
              <div className="flex justify-end shrink-0 -me-6">
                <button
                  type="button"
                  aria-label={t('sidebar.closeSidebar')}
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-neutral-800 dark:text-neutral-200"
                  onClick={() => setOpen(!open)}
                >
                  <X aria-hidden="true" />
                </button>
              </div>
              <div className="flex flex-1 min-h-0 flex-col justify-between gap-10">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  end,
  onClick,
}: {
  link: Links;
  className?: string;
  /** react-router exact matching for the active state. */
  end?: boolean;
  onClick?: () => void;
}) => {
  const { open, animate } = useSidebar();
  return (
    <NavLink
      to={link.href}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center justify-start gap-2 group/sidebar py-2',
          isActive && 'text-primary [&_svg]:text-primary font-semibold',
          className
        )
      }
    >
      <span className="relative inline-flex">
        {link.icon}
        {/* Collapsed, the count sits on the icon's start corner. The end
            corner is the rail's edge: the scroll area is overflow-x-hidden
            (for the collapse) and cut the old dot in half. The link's start
            padding is the room this badge grows into. */}
        {!!link.badge && animate && !open && (
          <span
            className="absolute -top-2 -start-2 min-w-[1rem] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-4 text-center tabular-nums"
            data-testid="nav-badge-collapsed"
            aria-hidden="true"
          >
            {link.badge > 9 ? '9+' : link.badge}
          </span>
        )}
      </span>
      <motion.span
        animate={{
          display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-sm group-hover/sidebar:translate-x-1 rtl:group-hover/sidebar:-translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {link.label}
        {!!link.badge && (
          <span
            className="ms-2 inline-flex min-w-[1.25rem] h-5 px-1.5 items-center justify-center rounded-full bg-rose-500 text-white text-[11px] font-bold tabular-nums"
            data-testid="nav-badge"
          >
            {link.badge > 99 ? '99+' : link.badge}
          </span>
        )}
      </motion.span>
    </NavLink>
  );
};
