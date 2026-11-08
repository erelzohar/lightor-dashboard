import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isNativeApp } from '../../lib/platform';
import {
  AWAY_LOCK_MS,
  LOCK_CHANGED,
  authenticate,
  loadLockEnabled,
  lockEnabledNow,
  lockSupport,
  type LockMethod,
} from '../../lib/appLock';

/**
 * LT-617: the apps' lock (lib/appLock.ts). Mounted once in App. With the lock
 * on and a session kept, the app opens behind this screen and asks the phone
 * for Face ID / fingerprint at once; coming back after 5 minutes or more asks
 * again. While the app is in the background a plain cover hides the pages, so
 * the phone's app switcher does not show them. Signed out, nothing is locked:
 * the password was just typed.
 */
const AppLockGate: React.FC = () => {
  const { t } = useTranslation();
  const { auth, logout } = useAuth();
  const native = isNativeApp();
  const [enabled, setEnabled] = useState(lockEnabledNow);
  const [locked, setLocked] = useState(lockEnabledNow);
  const [covered, setCovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<LockMethod>('biometrics');
  // The phone's prompt sends the app to the background and back on iOS:
  // those moves are not the owner leaving.
  const prompting = useRef(false);
  const awaySince = useRef(0);
  const opened = useRef(false);

  useEffect(() => {
    if (!native) return undefined;
    // Preferences is the source: with its quick copy lost (the WebView's
    // storage cleared), the launch still locks, unless already opened.
    void loadLockEnabled().then((on) => {
      setEnabled(on);
      setLocked(on && !opened.current);
    });
    void lockSupport().then((support) => setMethod(support.method));
    const changed = (event: Event) => {
      const on = (event as CustomEvent<boolean>).detail === true;
      setEnabled(on);
      // Switching it on just proved the owner's face: not locked now.
      if (!on) setLocked(false);
    };
    window.addEventListener(LOCK_CHANGED, changed);
    return () => window.removeEventListener(LOCK_CHANGED, changed);
  }, [native]);

  useEffect(() => {
    if (!native) return undefined;
    let removed = false;
    let remove: (() => void) | null = null;
    void import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('appStateChange', ({ isActive }) => {
          if (prompting.current || !lockEnabledNow()) return;
          if (!isActive) {
            awaySince.current = Date.now();
            setCovered(true);
            return;
          }
          const away = awaySince.current ? Date.now() - awaySince.current : 0;
          awaySince.current = 0;
          if (away >= AWAY_LOCK_MS) setLocked(true);
          setCovered(false);
        })
      )
      .then((handle) => {
        if (removed) void handle.remove();
        else remove = () => void handle.remove();
      })
      .catch(() => undefined);
    return () => {
      removed = true;
      remove?.();
    };
  }, [native]);

  // The sign-in screen came up: a password will open the app, not the lock.
  const signedOut = !auth.isLoading && !auth.isAuthenticated && !auth.offline;
  useEffect(() => {
    if (signedOut) setLocked(false);
  }, [signedOut]);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    setBusy(true);
    try {
      const result = await authenticate({
        reason: t('appLock.reason'),
        cancel: t('appLock.cancel'),
        title: t('appLock.lockedTitle'),
      });
      if (result === 'ok') {
        opened.current = true;
        setLocked(false);
      }
    } finally {
      prompting.current = false;
      setBusy(false);
    }
  }, [t]);

  const showLock = native && enabled && locked && !signedOut;
  // Ask the phone at once each time the app locks (only then, whatever
  // re-renders meanwhile); after a cancel the button asks again.
  const unlockRef = useRef(unlock);
  unlockRef.current = unlock;
  useEffect(() => {
    if (showLock) void unlockRef.current();
  }, [showLock]);

  if (showLock) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-lock-title"
        className="lt-ui fixed inset-0 z-[10300] flex items-center justify-center bg-white p-6 dark:bg-slate-900"
        data-testid="app-lock"
      >
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 id="app-lock-title" className="text-xl font-semibold text-gray-900 dark:text-white">{t('appLock.lockedTitle')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">{t(`appLock.lockedBody.${method}`)}</p>
          <button
            type="button"
            onClick={() => void unlock()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {busy && <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t('appLock.unlock')}
          </button>
          <button
            type="button"
            onClick={logout}
            disabled={busy}
            className="text-sm font-medium text-gray-500 underline-offset-4 hover:underline disabled:opacity-60 dark:text-gray-400"
          >
            {t('appLock.signOut')}
          </button>
        </div>
      </div>
    );
  }

  // In the background: the pages stay out of the app switcher's picture.
  if (native && enabled && covered && !signedOut) {
    return <div aria-hidden="true" className="fixed inset-0 z-[10300] bg-white dark:bg-slate-900" data-testid="app-lock-cover" />;
  }
  return null;
};

export default AppLockGate;
