import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarClock, CalendarPlus, CalendarX, Inbox, Loader2, PencilLine, Sunrise } from 'lucide-react';
import PullToRefresh from '../components/ui/PullToRefresh';
import { fetchNotifications, markNotificationsRead, OwnerNotification } from '../services/notificationsApi';
import { setUnreadNotifications } from '../hooks/useUnreadNotifications';

const EVENT_ICONS: Record<string, typeof Bell> = {
  newBooking: CalendarPlus,
  cancellation: CalendarX,
  reschedule: CalendarClock,
  detailsChanged: PencilLine,
  morningDigest: Sunrise,
  newLead: Inbox,
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "5 minutes ago" for the last week, the date after it. */
export const whenText = (createdAt: string, language: string, justNow: string, now = Date.now()): string => {
  const then = new Date(createdAt).getTime();
  const ago = now - then;
  if (ago < MINUTE) return justNow;
  if (ago >= 7 * DAY) return new Date(then).toLocaleDateString(language, { day: 'numeric', month: 'short' });
  const relative = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (ago < HOUR) return relative.format(-Math.floor(ago / MINUTE), 'minute');
  if (ago < DAY) return relative.format(-Math.floor(ago / HOUR), 'hour');
  return relative.format(-Math.floor(ago / DAY), 'day');
};

/**
 * Notifications (LT-527): the newest messages the system sent the owner, in
 * the words they were sent, whatever carried them. Opening the page reads
 * them; the ones that were new keep their mark until the owner leaves.
 */
const Notifications: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<OwnerNotification[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, unread } = await fetchNotifications();
      setItems(data);
      setFailed(false);
      if (unread > 0) {
        setUnreadNotifications(0);
        await markNotificationsRead();
      }
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PullToRefresh onRefresh={load}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Bell size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{t('notifications.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('notifications.subtitle')}</p>
          </div>
        </div>

        {failed && !items && (
          <div className="text-center py-12" role="alert">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('notifications.loadFailed')}</p>
            <button type="button" onClick={() => void load()} className="text-sm font-semibold text-primary">
              {t('notifications.retry')}
            </button>
          </div>
        )}

        {!failed && !items && (
          <div className="flex justify-center py-12" role="status" aria-label={t('notifications.loading')}>
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {items?.length === 0 && (
          <div className="text-center py-12" data-testid="notifications-empty">
            <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-3">
              <Bell size={28} className="text-primary" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-dark-text">{t('notifications.emptyTitle')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">{t('notifications.emptyBody')}</p>
          </div>
        )}

        {!!items?.length && (
          <ul data-tour="notifications-list" className="space-y-2 max-w-2xl">
            {items.map((item) => {
              const Icon = EVENT_ICONS[item.event] ?? Bell;
              const unread = !item.read;
              return (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => item.url.startsWith('/') && navigate(item.url)}
                    data-testid="notification"
                    data-unread={unread}
                    className={`w-full flex items-start gap-3 text-start rounded-2xl border p-3.5 transition-colors ${
                      unread
                        ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/60'
                        : 'bg-white dark:bg-dark-surface border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="p-2 rounded-xl bg-primary/10 shrink-0">
                      <Icon size={18} className="text-primary" aria-hidden="true" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-sm text-gray-900 dark:text-dark-text break-words min-w-0">{item.title}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {whenText(item.createdAt, i18n.language, t('notifications.justNow'))}
                        </span>
                      </span>
                      {item.body && (
                        <span className="block text-sm text-gray-600 dark:text-gray-300 mt-0.5 whitespace-pre-line break-words">{item.body}</span>
                      )}
                    </span>
                    {unread && (
                      <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0">
                        <span className="sr-only">{t('notifications.new')}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </motion.div>
    </PullToRefresh>
  );
};

export default Notifications;
