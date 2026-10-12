import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/ui/ConfirmDialog';

/**
 * Unsaved work and leaving it, inside the dashboard (LT-267).
 *
 * The app runs on a plain <BrowserRouter>, not a data router, so
 * react-router's useBlocker is not available. Instead a page holding unsaved
 * work registers here (`useUnsavedChangesGuard(dirty)`), and the ways out of
 * it — the sidebar, the phone tab bar, Lighty's links and button, a tapped
 * notification — go through this guard, which asks the owner first while
 * anything is registered and stays out of the way otherwise. Closing or
 * reloading the tab is the page's own beforeunload; the browser's back
 * button is not covered.
 */
interface LeaveGuard {
  /**
   * Runs `leave` now, or once the owner confirms leaving unsaved work. `to`,
   * the path `leave` goes to, skips the question when it is this same page.
   */
  confirmLeave: (leave: () => void, to?: string) => void;
  /** A link's onClick: holds the click for the question when it is needed, else lets the link go. */
  guardLinkClick: (event: React.MouseEvent<HTMLAnchorElement>, to: string) => void;
  /** Registers unsaved work; the returned function releases it. */
  register: () => () => void;
}

// Without a provider (a page or test mounted on its own) nothing is guarded.
const LeaveGuardContext = createContext<LeaveGuard>({
  confirmLeave: (leave) => leave(),
  guardLinkClick: () => undefined,
  register: () => () => undefined,
});

const pathOf = (to: string): string => to.split(/[?#]/)[0];

export const LeaveGuardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  // Read through refs, so the guard's functions — and the context — stay the
  // same object from one page to the next.
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const holders = useRef(0);
  const [pending, setPending] = useState<{ leave: () => void } | null>(null);

  const register = useCallback(() => {
    holders.current += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holders.current -= 1;
    };
  }, []);

  const mustAsk = useCallback(
    (to?: string) => holders.current > 0 && (to === undefined || pathOf(to) !== pathnameRef.current),
    []
  );

  const confirmLeave = useCallback(
    (leave: () => void, to?: string) => {
      if (mustAsk(to)) setPending({ leave });
      else leave();
    },
    [mustAsk]
  );

  const guardLinkClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, to: string) => {
      // A click for a new tab or window leaves nothing behind.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!mustAsk(to)) return;
      event.preventDefault();
      setPending({ leave: () => navigateRef.current(to) });
    },
    [mustAsk]
  );

  const value = useMemo(() => ({ confirmLeave, guardLinkClick, register }), [confirmLeave, guardLinkClick, register]);

  return (
    <LeaveGuardContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        title={t('common.unsavedLeaveTitle')}
        message={t('common.unsavedLeaveBody')}
        confirmLabel={t('common.leaveWithoutSaving')}
        cancelLabel={t('common.stay')}
        danger
        onConfirm={() => {
          const leave = pending?.leave;
          setPending(null);
          leave?.();
        }}
        onClose={() => setPending(null)}
      />
    </LeaveGuardContext.Provider>
  );
};

export const useLeaveGuard = (): LeaveGuard => useContext(LeaveGuardContext);

/** While `dirty`, leaving the page asks the owner first (LT-267). */
export const useUnsavedChangesGuard = (dirty: boolean): void => {
  const { register } = useLeaveGuard();
  useEffect(() => (dirty ? register() : undefined), [dirty, register]);
};
