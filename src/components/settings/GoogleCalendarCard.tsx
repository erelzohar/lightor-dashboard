import React, { useEffect, useState } from 'react';
import { CalendarCheck, Link2, Unlink, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import Card from '../ui/Card';
import Button from '../ui/Button';
import {
  GoogleCalendarStatus,
  disconnectGoogleCalendar,
  fetchGoogleCalendarStatus,
  fetchGoogleConnectUrl,
} from '../../services/calendarApi';

/**
 * Google Calendar sync (LT-045): connect via OAuth, after which every
 * booking/reschedule/cancel is pushed into the owner's Google Calendar by the
 * server. Renders nothing while the server has no Google credentials.
 */
const GoogleCalendarCard: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    // The OAuth round-trip lands back here with ?gcal=connected|error.
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('gcal');
    if (outcome === 'connected') toast.success(t('settings.googleCalendar.connectedToast'));
    if (outcome === 'error') toast.error(t('settings.googleCalendar.errorToast'));
    if (outcome) {
      params.delete('gcal');
      const query = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
    }

    fetchGoogleCalendarStatus()
      .then(setStatus)
      .finally(() => setIsLoading(false));
  }, [t]);

  const handleConnect = async () => {
    setIsWorking(true);
    const url = await fetchGoogleConnectUrl();
    if (url) {
      window.location.href = url;
      return; // navigating away
    }
    setIsWorking(false);
    toast.error(t('settings.googleCalendar.errorToast'));
  };

  const handleDisconnect = async () => {
    if (!window.confirm(t('settings.googleCalendar.disconnectConfirm'))) return;
    setIsWorking(true);
    const ok = await disconnectGoogleCalendar();
    setIsWorking(false);
    if (ok) {
      setStatus((prev) => prev && { ...prev, connected: false, revoked: false, email: null });
      toast.success(t('settings.googleCalendar.disconnectedToast'));
    } else {
      toast.error(t('settings.googleCalendar.errorToast'));
    }
  };

  // Server has no Google OAuth credentials — nothing useful to render.
  if (!isLoading && !status?.configured) return null;

  return (
    <Card className="shadow-xl">
      <div className="flex items-center gap-3 mb-2">
        <CalendarCheck className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
          {t('settings.googleCalendar.title')}
        </h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {t('settings.googleCalendar.description')}
      </p>

      {isLoading ? (
        <div className="h-10 rounded-lg bg-light-gray/40 dark:bg-dark-gray/40 animate-pulse" />
      ) : status?.connected ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 flex-1">
            <CalendarCheck className="w-4 h-4" />
            <span>
              {t('settings.googleCalendar.connectedAs')}{' '}
              <span className="font-medium" dir="ltr">{status.email}</span>
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleDisconnect}
            isLoading={isWorking}
            leftIcon={<Unlink className="w-4 h-4" />}
          >
            {t('settings.googleCalendar.disconnect')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {status?.revoked && (
            <div className="flex items-center gap-2 text-sm text-orange-500 dark:text-orange-400">
              <AlertCircle className="w-4 h-4" />
              {t('settings.googleCalendar.revokedNote')}
            </div>
          )}
          <div>
            <Button
              type="button"
              onClick={handleConnect}
              isLoading={isWorking}
              leftIcon={<Link2 className="w-4 h-4" />}
            >
              {status?.revoked
                ? t('settings.googleCalendar.reconnect')
                : t('settings.googleCalendar.connect')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default GoogleCalendarCard;
