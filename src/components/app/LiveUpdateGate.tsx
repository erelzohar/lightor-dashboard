import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { markAppReady, onForceUpdate, startLiveUpdates } from '../../lib/liveUpdate';
import { isNativeApp, nativePlatform } from '../../lib/platform';

/** How long the app runs before it tells the update plugin this bundle is good (its rollback timer is 30 s). */
const READY_AFTER_MS = 4000;

/**
 * LT-608: the apps' over-the-air updates (lib/liveUpdate.ts). Mounted once in
 * App. Confirms the running bundle a few seconds after it rendered (a page
 * that crashed meanwhile leaves it unconfirmed, so the plugin rolls it back),
 * starts the update checks, and - when the server asks for a store update -
 * covers the app with the update screen and a button to the store.
 */
const LiveUpdateGate: React.FC = () => {
  const { t } = useTranslation();
  const [forced, setForced] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return undefined;
    const ready = setTimeout(() => void markAppReady(), READY_AFTER_MS);
    void startLiveUpdates();
    const stop = onForceUpdate(() => setForced(true));
    return () => {
      clearTimeout(ready);
      stop();
    };
  }, []);

  if (!forced) return null;
  const env = import.meta.env as Record<string, string | undefined>;
  const storeUrl = nativePlatform() === 'android' ? env.VITE_PLAY_STORE_URL : env.VITE_APP_STORE_URL;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="force-update-title"
      className="lt-ui fixed inset-0 z-[10200] flex items-center justify-center bg-white p-6 dark:bg-slate-900"
      data-testid="force-update"
    >
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-primary/10 text-primary">
          <Download className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 id="force-update-title" className="text-xl font-semibold text-gray-900 dark:text-white">{t('app.update.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('app.update.body')}</p>
        {storeUrl && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white shadow-md hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t('app.update.cta')}
          </a>
        )}
      </div>
    </div>
  );
};

export default LiveUpdateGate;
