import React, { useEffect, useState } from 'react';
import { Bell, Lock, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Card from '../ui/Card';
import ToggleSwitch from '../ui/ToggleSwitch';
import { useAuth } from '../../contexts/AuthContext';
import { canOfferPurchases, isNativeApp } from '../../lib/platform';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import type { NotificationPrefs, OwnerChannel } from '../../types';

/**
 * How and about what the owner hears about their business (LT-129, LT-213).
 *
 * Two settings on the user, both saved the moment they change and rolled
 * back if the save fails:
 *  - `channelType` — email (the default), SMS or WhatsApp. The phone is a
 *    Plus channel (`ownerTextAlerts`) and needs a number on the account;
 *    the server sends by email whenever either is missing, so the card
 *    shows email as the channel then.
 *  - `notificationPrefs` — one switch per event, for every channel and for
 *    push in the app alike. All on by default; absent on older accounts,
 *    which reads as all on. Sent as the full merged object — the API merges
 *    partials too, but the whole object keeps the request self-describing.
 *
 * Push used to be the only owner alert, so the card was native only; it is
 * on every platform now.
 */
const DEFAULT_PREFS: NotificationPrefs = {
  newBooking: true,
  cancellation: true,
  reschedule: true,
  morningDigest: true,
  newLead: true,
};

const EVENTS: (keyof NotificationPrefs)[] = ['newBooking', 'cancellation', 'reschedule', 'morningDigest', 'newLead'];
// A leads site (LT-199) takes no bookings: it only hears about new leads.
const LEADS_SITE_EVENTS: (keyof NotificationPrefs)[] = ['newLead'];

const CHANNELS: { value: OwnerChannel; icon: React.ElementType }[] = [
  { value: 'email', icon: Mail },
  { value: 'sms', icon: MessageSquare },
  { value: 'whatsapp', icon: MessageCircle },
];

interface NotificationsCardProps {
  /** A leads site (LT-199, `isLeadsSite`). */
  leadsSite?: boolean;
}

const NotificationsCard: React.FC<NotificationsCardProps> = ({ leadsSite = false }) => {
  const { auth, updateUser } = useAuth();
  const { t } = useTranslation();
  const [saving, setSaving] = useState<keyof NotificationPrefs | 'channel' | null>(null);
  // Null until the plan is known — and if it never is, the phone stays
  // offered: the server picks the channel that is really used anyway.
  const [textAllowed, setTextAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyEntitlements().then((entitlements) => {
      if (alive) setTextAllowed(entitlements?.limits.ownerTextAlerts ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const user = auth.user;
  const prefs: NotificationPrefs = { ...DEFAULT_PREFS, ...(user?.notificationPrefs ?? {}) };
  const phone = user?.phone?.trim() ?? '';
  const planLocked = textAllowed === false;
  const phoneLocked = !planLocked && !phone;
  const picked: OwnerChannel = user?.channelType ?? 'email';
  // What the server will actually use (ownerAlerts.ownerChannelFor).
  const channel: OwnerChannel = picked !== 'email' && (planLocked || phoneLocked) ? 'email' : picked;
  // In the app a locked option is hidden rather than shown with a lock that
  // points at the plans — that would be a call to buy (LT-130, App Store 3.1.1).
  const channels = planLocked && !canOfferPurchases() ? CHANNELS.filter((c) => c.value === 'email') : CHANNELS;

  const save = async (what: keyof NotificationPrefs | 'channel', data: Parameters<typeof updateUser>[0]) => {
    setSaving(what);
    try {
      await updateUser(data);
      toast.success(t('account.notifications.saved'));
    } catch {
      toast.error(t('account.notifications.saveFailed'));
    } finally {
      setSaving(null);
    }
  };

  const pickChannel = (value: OwnerChannel) => {
    if (value === channel) return;
    void save('channel', { channelType: value });
  };

  const toggle = (event: keyof NotificationPrefs, value: boolean) => {
    void save(event, { notificationPrefs: { ...prefs, [event]: value } });
  };

  const destination = channel === 'email' ? user?.email : phone;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
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

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
        {t('account.notifications.channel')}
      </p>
      <div
        role="radiogroup"
        aria-label={t('account.notifications.channel')}
        data-testid="notification-channel"
        className={`flex flex-wrap rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 w-fit text-sm ${saving ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {channels.map(({ value, icon: Icon }) => {
          const locked = value !== 'email' && (planLocked || phoneLocked);
          const active = value === channel;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={locked || saving !== null}
              onClick={() => pickChannel(value)}
              className={`flex items-center gap-1.5 px-4 py-2 font-medium transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : locked
                    ? 'bg-white dark:bg-dark-surface text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {locked ? <Lock size={14} aria-hidden /> : <Icon size={14} aria-hidden />}
              {t(`account.notifications.channels.${value}`)}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2" data-testid="notification-channel-hint">
        {destination && (
          <>
            {t('account.notifications.sendsTo')}{' '}
            <span dir="ltr" className="font-medium text-gray-700 dark:text-gray-300">{destination}</span>
          </>
        )}
        {planLocked && canOfferPurchases() && (
          <span className="block mt-1">{t('account.notifications.plusOnly')}</span>
        )}
        {phoneLocked && <span className="block mt-1">{t('account.notifications.needsPhone')}</span>}
      </p>

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-6 mb-1">
        {t('account.notifications.events')}
      </p>
      <ul className="divide-y divide-gray-200/60 dark:divide-gray-700/60" data-testid="notification-prefs">
        {(leadsSite ? LEADS_SITE_EVENTS : EVENTS).map((event) => (
          <li key={event} className="flex items-center justify-between py-3 gap-4">
            <div className="min-w-0">
              <p className="text-sm text-light-text dark:text-dark-text">{t(`account.notifications.${event}`)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t(`account.notifications.hints.${event}`)}
              </p>
            </div>
            <ToggleSwitch
              checked={prefs[event] !== false}
              disabled={saving !== null}
              ariaLabel={t(`account.notifications.${event}`)}
              onChange={(value) => toggle(event, value)}
            />
          </li>
        ))}
      </ul>

      {isNativeApp() && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{t('account.notifications.pushNote')}</p>
      )}
    </Card>
  );
};

export default NotificationsCard;
