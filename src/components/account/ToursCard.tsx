import React, { useState } from 'react';
import { Compass, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Card from '../ui/Card';
import ToggleSwitch from '../ui/ToggleSwitch';
import { useAuth } from '../../contexts/AuthContext';
import { restartTours, setToursOff } from '../../services/toursApi';
import { forgetToursDoneHere } from '../tour/PageTour';

/**
 * Lighty's page tours on the account page (LT-389): show them or not, and
 * start them all over (every page's tour again, from its first step).
 */
const ToursCard: React.FC = () => {
  const { t } = useTranslation();
  const { auth, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const on = auth.user?.tours?.off !== true;

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setSaving(true);
    try {
      await action();
      await refreshUser();
      if (done) toast.success(done);
    } catch {
      toast.error(t('account.tours.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Compass className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{t('account.tours.title')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('account.tours.description')}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 py-1">
          <p className="text-sm text-light-text dark:text-dark-text">{t('account.tours.show')}</p>
          <ToggleSwitch
            checked={on}
            disabled={saving}
            ariaLabel={t('account.tours.show')}
            onChange={(value: boolean) => void run(() => {
              forgetToursDoneHere();
              return setToursOff(!value);
            })}
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void run(() => {
            forgetToursDoneHere();
            return restartTours();
          }, t('account.tours.restarted'))}
          className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-primary/50 disabled:opacity-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          {t('account.tours.restart')}
        </button>
      </div>
    </Card>
  );
};

export default ToursCard;
