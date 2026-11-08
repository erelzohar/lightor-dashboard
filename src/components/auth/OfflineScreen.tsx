import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader, WifiOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * LT-614: what a signed-in owner sees when the app opens and the server
 * cannot be reached (no internet, or the server down). It used to be the
 * sign-in screen, as if they had been signed out; the session is kept, the
 * context asks again by itself, and the button asks right away.
 */
const OfflineScreen: React.FC = () => {
  const { t } = useTranslation();
  const { retryConnection } = useAuth();
  const [checking, setChecking] = useState(false);

  const retry = async () => {
    setChecking(true);
    try {
      await retryConnection();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-light-bg p-6 dark:bg-slate-900" data-testid="offline-screen">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-primary/10 text-primary">
          <WifiOff className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('app.offline.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('app.offline.body')}</p>
        <button
          type="button"
          onClick={() => void retry()}
          disabled={checking}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {checking && <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {checking ? t('app.offline.checking') : t('app.offline.retry')}
        </button>
      </div>
    </div>
  );
};

export default OfflineScreen;
