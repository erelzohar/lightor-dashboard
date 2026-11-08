import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Loader, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isNativeApp } from '../../lib/platform';
import { authenticate, lockEnabledNow, lockSupport, markOffered, setLockEnabled, wasOffered, type LockMethod } from '../../lib/appLock';

/** A beat after the app opens signed in, so the page is up first. */
const OFFER_AFTER_MS = 2500;
/** While another dialog or a page tour is open, look again this often. */
const RETRY_MS = 1500;

/**
 * LT-617: once per phone, after sign-in, the app offers to lock itself with
 * Face ID / fingerprint (Erel 2026-11-08: off by default, offered once). It
 * waits for any open dialog or page tour (both marked aria-modal) to close,
 * and the page tours wait for it the same way. "Not now" leaves the switch on
 * the Account page.
 */
const AppLockOffer: React.FC = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const [method, setMethod] = useState<LockMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = isNativeApp() && auth.isAuthenticated && auth.user?.isVerified === true;

  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    let timer = 0;
    void (async () => {
      if (lockEnabledNow() || (await wasOffered())) return;
      const support = await lockSupport();
      if (cancelled || !support.available) return;
      const open = () => {
        if (cancelled) return;
        if (document.querySelector('[aria-modal="true"]')) {
          timer = window.setTimeout(open, RETRY_MS);
          return;
        }
        void markOffered();
        setMethod(support.method);
      };
      timer = window.setTimeout(open, OFFER_AFTER_MS);
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready]);

  if (!method) return null;

  const turnOn = async () => {
    setBusy(true);
    const result = await authenticate({ reason: t('appLock.reason'), cancel: t('appLock.cancel'), title: t(`appLock.card.title.${method}`) });
    setBusy(false);
    if (result === 'ok') {
      await setLockEnabled(true);
      toast.success(t('appLock.enabled'));
      setMethod(null);
    } else if (result === 'failed') {
      toast.error(t('appLock.failed'));
    }
  };

  return (
    <div className="fixed inset-0 z-[10040] flex items-end justify-center bg-black/40 p-4 sm:items-center" data-testid="app-lock-offer">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-lock-offer-title"
        className="lt-ui w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-slate-800"
      >
        <div className="mx-auto grid h-12 w-12 place-content-center rounded-2xl bg-primary/10 text-primary">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 id="app-lock-offer-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t(`appLock.offer.title.${method}`)}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('appLock.offer.body')}</p>
        <button
          type="button"
          onClick={() => void turnOn()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {busy && <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t('appLock.offer.enable')}
        </button>
        <button
          type="button"
          onClick={() => setMethod(null)}
          disabled={busy}
          className="w-full rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-slate-700"
        >
          {t('appLock.offer.later')}
        </button>
      </div>
    </div>
  );
};

export default AppLockOffer;
