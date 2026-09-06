import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Card from '../ui/Card';
import ToggleSwitch from '../ui/ToggleSwitch';
import { useAuth } from '../../contexts/AuthContext';
import { isNativeApp } from '../../lib/platform';
import type { NotificationPrefs } from '../../types';

/**
 * Per-event push toggles (LT-129, mobile plan phase 2 §4). Native only —
 * on the web there is nothing to be notified on, so the card is not rendered.
 *
 * Prefs live on the user (`notificationPrefs`, all true by default; absent on
 * older accounts, which reads as all true). Each toggle saves immediately via
 * `PUT /api/users/:id` with the full merged object — the API merges partials
 * too, but sending all four keeps the request self-describing — and rolls
 * back on failure.
 */
const DEFAULT_PREFS: NotificationPrefs = {
  newBooking: true,
  cancellation: true,
  reschedule: true,
  morningDigest: true,
};

const EVENTS: (keyof NotificationPrefs)[] = ['newBooking', 'cancellation', 'reschedule', 'morningDigest'];

const NotificationsCard: React.FC = () => {
  const { auth, updateUser } = useAuth();
  const { t } = useTranslation();
  const [saving, setSaving] = useState<keyof NotificationPrefs | null>(null);

  if (!isNativeApp()) return null;

  const prefs: NotificationPrefs = { ...DEFAULT_PREFS, ...(auth.user?.notificationPrefs ?? {}) };

  const toggle = async (event: keyof NotificationPrefs, value: boolean) => {
    setSaving(event);
    try {
      await updateUser({ notificationPrefs: { ...prefs, [event]: value } });
      toast.success(t('account.notifications.saved'));
    } catch {
      toast.error(t('account.notifications.saveFailed'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <Bell className="w-5 h-5 text-primary shrink-0" />
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
            {t('account.notifications.title')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('account.notifications.description')}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-gray-200/60 dark:divide-gray-700/60" data-testid="notification-prefs">
        {EVENTS.map((event) => (
          <li key={event} className="flex items-center justify-between py-3 gap-4">
            <span className="text-sm text-light-text dark:text-dark-text">
              {t(`account.notifications.${event}`)}
            </span>
            <ToggleSwitch
              checked={prefs[event]}
              disabled={saving !== null}
              onChange={(value) => void toggle(event, value)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default NotificationsCard;
