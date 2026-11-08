import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import Card from '../ui/Card';
import ToggleSwitch from '../ui/ToggleSwitch';
import { authenticate, loadLockEnabled, lockSupport, setLockEnabled, type LockSupport } from '../../lib/appLock';

/**
 * LT-617: the lock's switch on the Account page, in the apps only and only
 * where the phone has Face ID / fingerprint set up. Switching it on asks the
 * phone once, so a lock that cannot open is never set.
 */
const AppLockCard: React.FC = () => {
  const { t } = useTranslation();
  const [support, setSupport] = useState<LockSupport | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([lockSupport(), loadLockEnabled()]).then(([found, enabled]) => {
      if (cancelled) return;
      setSupport(found);
      setOn(enabled);
    });
    return () => { cancelled = true; };
  }, []);

  if (!support?.available) return null;
  const { method } = support;

  const change = async (value: boolean) => {
    setBusy(true);
    try {
      if (value) {
        const result = await authenticate({ reason: t('appLock.reason'), cancel: t('appLock.cancel'), title: t(`appLock.card.title.${method}`) });
        if (result !== 'ok') {
          if (result === 'failed') toast.error(t('appLock.failed'));
          return;
        }
      }
      await setLockEnabled(value);
      setOn(value);
      if (value) toast.success(t('appLock.enabled'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div data-testid="app-lock-card">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{t(`appLock.card.title.${method}`)}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('appLock.card.description')}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 py-1">
          <p className="text-sm text-light-text dark:text-dark-text">{t('appLock.card.toggle')}</p>
          <ToggleSwitch checked={on} disabled={busy} ariaLabel={t('appLock.card.toggle')} onChange={(value: boolean) => void change(value)} />
        </div>
      </div>
    </Card>
  );
};

export default AppLockCard;
