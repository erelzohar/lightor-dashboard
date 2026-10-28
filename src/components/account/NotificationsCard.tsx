import React, { useEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, Check, ChevronDown, Inbox, Mail, MessageCircle, Smartphone, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Card from '../ui/Card';
import ToggleSwitch from '../ui/ToggleSwitch';
import { useAuth } from '../../contexts/AuthContext';
import { canOfferPurchases, isNativeApp } from '../../lib/platform';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { pushPermission } from '../../services/pushClient';
import type { EventChannels, NotifyEvent, User } from '../../types';
import { cn } from '../../lib/utils';
import { lightTick } from '../../lib/haptics';
import { formatPhoneForDisplay } from '../../utils/phone';

/**
 * Where and about what the owner hears about their business (LT-455, Erel
 * 2026-10-25: "not a table, convenient for the user").
 *
 * On top, a few lines saying what reaches them where, built from the
 * settings; under them three groups - bookings, the morning digest, inquiries
 * - each with a chip per channel, saved the moment it is tapped (rolled back
 * by the server's answer if the save fails). The server resolves every
 * event's channels (`notifyChannels`) and takes partial writes (`notifyBy`).
 *
 * The phone is WhatsApp, by SMS when WhatsApp does not get through; a new
 * booking never goes by phone, and a cancellation or change only when it is
 * last minute (the server's mayText), so bookings get one switch for it.
 * A row whose only channel is the app still reaches the owner by email when
 * no phone with the app took it - the card says so.
 */
const BOOKING_EVENTS: NotifyEvent[] = ['newBooking', 'cancellation', 'reschedule'];
const CHANGE_EVENTS: NotifyEvent[] = ['cancellation', 'reschedule'];
const DEFAULT_CHANNELS: EventChannels = { app: true, email: true, phone: false };

type Channel = keyof EventChannels;
type AppState = 'connected' | 'notConnected' | 'permissionOff';

const CHIP_ICONS: Record<Channel, React.ElementType> = { app: Smartphone, email: Mail, phone: MessageCircle };
const CHIP_KEYS: Record<Channel, string> = { app: 'app', email: 'email', phone: 'whatsapp' };

type ListFormatter = new (lang?: string, options?: { style: string; type: string }) => { format: (items: string[]) => string };

/** "a, b and c" in the page's language; a plain comma list where the browser has no formatter. */
const listOf = (items: string[], lang?: string): string => {
  try {
    const ListFormat = (Intl as unknown as { ListFormat: ListFormatter }).ListFormat;
    return new ListFormat(lang, { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
};

interface ChipProps {
  channel: Channel;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
  testId: string;
}

const Chip: React.FC<ChipProps> = ({ channel, on, disabled, onToggle, testId }) => {
  const { t } = useTranslation();
  // A tick when on, so the state does not rest on colour alone.
  const Icon = on ? Check : CHIP_ICONS[channel];
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      data-testid={testId}
      onClick={() => {
        lightTick();
        onToggle();
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
        on
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
    >
      <Icon size={14} aria-hidden />
      {t(`account.notifications.chips.${CHIP_KEYS[channel]}`)}
    </button>
  );
};

interface NotificationsCardProps {
  /** A leads site (LT-199, `isLeadsSite`): it only hears about inquiries. */
  leadsSite?: boolean;
}

const NotificationsCard: React.FC<NotificationsCardProps> = ({ leadsSite = false }) => {
  const { auth, updateUser, refreshUser } = useAuth();
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [eachKind, setEachKind] = useState(false);
  // Null until the plan is known - and if it never is, the phone stays
  // offered: the server decides what really goes by phone anyway.
  const [textAllowed, setTextAllowed] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyEntitlements().then((entitlements) => {
      if (alive) setTextAllowed(entitlements?.limits.ownerTextAlerts ?? null);
    });
    pushPermission().then((state) => {
      if (alive) setPermission(state);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The app's first connection may have just turned the booking emails off
  // (LT-455), and whether the app is connected is read fresh: once a page,
  // as soon as the session is there.
  const refreshed = useRef(false);
  useEffect(() => {
    if (!auth.isAuthenticated || refreshed.current) return;
    refreshed.current = true;
    void refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated]);

  const user = auth.user;
  const channels = (event: NotifyEvent): EventChannels => user?.notifyChannels?.[event] ?? DEFAULT_CHANNELS;
  const phone = user?.phone?.trim() ?? '';
  const planLocked = textAllowed === false;
  // In the app a locked option is hidden rather than shown pointing at the
  // plans - that would be a call to buy (LT-130, App Store 3.1.1).
  const phoneShown = !planLocked || canOfferPurchases();
  const phoneUsable = !planLocked && Boolean(phone);

  const bookingsDiffer = (['app', 'email'] as const).some(
    (channel) => new Set(BOOKING_EVENTS.map((event) => channels(event)[channel])).size > 1
  );
  const showEachKind = !leadsSite && (eachKind || bookingsDiffer);

  const save = async (notifyBy: User['notifyBy']) => {
    setSaving(true);
    try {
      await updateUser({ notifyBy });
      toast.success(t('account.notifications.saved'));
    } catch {
      toast.error(t('account.notifications.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /** Set one channel on the given events to `on`. */
  const set = (events: NotifyEvent[], channel: Channel, on: boolean): void => {
    void save(Object.fromEntries(events.map((event) => [event, { [channel]: on }])));
  };

  const allOn = (events: NotifyEvent[], channel: Channel) => events.every((event) => channels(event)[channel]);
  const lastMinute = allOn(CHANGE_EVENTS, 'phone');

  // What reaches the owner where, in a line per channel.
  const label = (key: string) => t(`account.notifications.items.${key}`);
  const bookingItems = (channel: Channel): string[] => {
    if (leadsSite) return [];
    if (channel === 'phone') {
      const on = CHANGE_EVENTS.filter((event) => channels(event).phone);
      if (on.length === 2) return [label('lastMinute')];
      return on.map((event) => label(event === 'cancellation' ? 'lastMinuteCancellation' : 'lastMinuteReschedule'));
    }
    if (allOn(BOOKING_EVENTS, channel)) return [label('bookings')];
    return BOOKING_EVENTS.filter((event) => channels(event)[channel]).map(label);
  };
  const otherItems = (channel: Channel): string[] =>
    (leadsSite ? (['newLead'] as NotifyEvent[]) : (['morningDigest', 'newLead'] as NotifyEvent[]))
      .filter((event) => channels(event)[channel])
      .map(label);
  const summary = (['app', 'email', 'phone'] as const)
    .filter((channel) => channel !== 'phone' || phoneUsable)
    .map((channel) => ({ channel, items: [...bookingItems(channel), ...otherItems(channel)] }))
    .filter(({ items }) => items.length > 0);
  const anyPhone = summary.some(({ channel }) => channel === 'phone');

  const appOnly = BOOKING_EVENTS.some((event) => channels(event).app && !channels(event).email);
  const appState: AppState | null = isNativeApp() && permission !== null && permission !== 'granted'
    ? 'permissionOff'
    : user?.appConnected === undefined
      ? null
      : user.appConnected
        ? 'connected'
        : 'notConnected';

  const chips = (events: NotifyEvent[], list: Channel[], testId: string) => (
    <div className="flex flex-wrap gap-2">
      {list
        .filter((channel) => channel !== 'phone' || phoneShown)
        .map((channel) => (
          <Chip
            key={channel}
            channel={channel}
            on={allOn(events, channel) && (channel !== 'phone' || phoneUsable)}
            disabled={saving || (channel === 'phone' && !phoneUsable)}
            onToggle={() => set(events, channel, !allOn(events, channel))}
            testId={`${testId}-${channel}`}
          />
        ))}
    </div>
  );

  const group = (icon: React.ElementType, title: string, hint: string, body: React.ReactNode, testId: string) => {
    const Icon = icon;
    return (
      <section className="border-t border-gray-200/60 dark:border-gray-700/60 py-4 first:border-t-0" data-testid={testId}>
        <p className="flex items-center gap-2 text-sm font-medium text-light-text dark:text-dark-text">
          <Icon size={16} aria-hidden className="text-gray-500 dark:text-gray-400" />
          {title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">{hint}</p>
        {body}
      </section>
    );
  };

  const phoneHint = phoneShown && !phoneUsable && (
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2" data-testid="notification-phone-hint">
      {planLocked ? t('account.notifications.plusOnly') : t('account.notifications.needsPhone')}
    </p>
  );

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
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
        {appState && (
          <span
            data-testid="notification-app-state"
            className={cn(
              'shrink-0 text-xs mt-0.5',
              appState === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {t(`account.notifications.appState.${appState}`)}
          </span>
        )}
      </div>

      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5 mb-2" data-testid="notification-summary">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('account.notifications.summaryTitle')}</p>
        {summary.length === 0 ? (
          <p className="text-sm text-red-600 dark:text-red-400">{t('account.notifications.summary.allOff')}</p>
        ) : (
          summary.map(({ channel, items }) => {
            const Icon = CHIP_ICONS[channel];
            return (
              <p key={channel} className="flex items-start gap-2 text-sm text-light-text dark:text-dark-text leading-relaxed" data-testid={`notification-summary-${channel}`}>
                <Icon size={15} aria-hidden className="mt-1 shrink-0 text-gray-500 dark:text-gray-400" />
                {t(`account.notifications.summary.${CHIP_KEYS[channel]}`, { items: listOf(items, i18n?.language) })}
              </p>
            );
          })
        )}
      </div>

      {!leadsSite &&
        group(
          CalendarDays,
          t('account.notifications.groups.bookings'),
          t('account.notifications.groups.bookingsHint'),
          <>
            {showEachKind ? (
              // Eases in once when the owner opens it (LT-478); not when it
              // is open from the start because the kinds already differ.
              <div className={cn('space-y-3', eachKind && 'notif-each-kind-in')} data-testid="notification-each-kind">
                {BOOKING_EVENTS.map((event) => (
                  <div key={event}>
                    <p className="text-sm text-light-text dark:text-dark-text mb-1.5">{t(`account.notifications.${event}`)}</p>
                    {chips([event], ['app', 'email'], `notification-${event}`)}
                  </div>
                ))}
              </div>
            ) : (
              chips(BOOKING_EVENTS, ['app', 'email'], 'notification-bookings')
            )}
            {/* Right under the chips it splits (LT-478, Erel: at the bottom
                of the group it looked unrelated to them). */}
            {!bookingsDiffer && (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary"
                aria-expanded={showEachKind}
                onClick={() => setEachKind((open) => !open)}
                data-testid="notification-each-kind-toggle"
              >
                {t(showEachKind ? 'account.notifications.sameForAll' : 'account.notifications.eachKind')}
                <ChevronDown size={14} aria-hidden className={cn('transition-transform', showEachKind && 'rotate-180')} />
              </button>
            )}
            {phoneShown && (
              <div className="flex items-center justify-between gap-4 mt-4">
                <div className="min-w-0">
                  <p className="text-sm text-light-text dark:text-dark-text">{t('account.notifications.lastMinute')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('account.notifications.lastMinuteHint')}</p>
                </div>
                <ToggleSwitch
                  checked={lastMinute && phoneUsable}
                  disabled={saving || !phoneUsable}
                  ariaLabel={t('account.notifications.lastMinute')}
                  onChange={(value) => set(CHANGE_EVENTS, 'phone', value)}
                />
              </div>
            )}
            {appOnly && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3" data-testid="notification-safety-net">
                {t('account.notifications.safetyNet')}
              </p>
            )}
          </>,
          'notification-group-bookings'
        )}

      {!leadsSite &&
        group(
          Sun,
          t('account.notifications.morningDigest'),
          t('account.notifications.hints.morningDigest'),
          chips(['morningDigest'], ['app', 'email', 'phone'], 'notification-morningDigest'),
          'notification-group-digest'
        )}

      {group(
        Inbox,
        t('account.notifications.groups.leads'),
        t('account.notifications.hints.newLead'),
        chips(['newLead'], ['app', 'email', 'phone'], 'notification-newLead'),
        'notification-group-leads'
      )}

      {phoneHint}
      {anyPhone && (
        <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200/60 dark:border-gray-700/60 pt-3" data-testid="notification-phone-line">
          {/* The number isolated left to right inside a right-to-left line. */}
          {t('account.notifications.phoneLine', { phone: `\u2066${formatPhoneForDisplay(phone)}\u2069` })}
        </p>
      )}
    </Card>
  );
};

export default NotificationsCard;
