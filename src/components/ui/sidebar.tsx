import React, { useState, createContext, useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
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
      <div
        className={cn(
          // pt-[env()]: status-bar clearance inside the Capacitor shell
          // (LT-127); zero in a browser, whose chrome sits above the page.
          'min-h-14 px-2 pt-[env(safe-area-inset-top)] flex flex-row md:hidden items-center justify-between bg-neutral-100 dark:bg-neutral-800 w-full flex-shrink-0'
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <button
            type="button"
            aria-label={open ? t('sidebar.closeSidebar') : t('sidebar.openSidebar')}
            aria-expanded={open}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-neutral-800 dark:text-neutral-200"
            onClick={() => setOpen(!open)}
          >
            <Menu aria-hidden="true" />
          </button>
        </div>
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
                'fixed h-full w-full inset-0 bg-white dark:bg-neutral-900 p-10 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col justify-between',
                className
              )}
            >
              <button
                type="button"
                aria-label={t('sidebar.closeSidebar')}
                className="absolute end-6 top-[calc(1.5rem+env(safe-area-inset-top))] z-50 w-11 h-11 flex items-center justify-center rounded-xl text-neutral-800 dark:text-neutral-200"
                onClick={() => setOpen(!open)}
              >
                <X aria-hidden="true" />
              </button>
              {children}
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
      {link.icon}
      <motion.span
        animate={{
          display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-sm group-hover/sidebar:translate-x-1 rtl:group-hover/sidebar:-translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {link.label}
      </motion.span>
    </NavLink>
  );
};
