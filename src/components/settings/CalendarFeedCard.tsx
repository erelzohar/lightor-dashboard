import React, { useEffect, useState } from 'react';
import { CalendarDays, Copy, Check, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import Card from '../ui/Card';
import Button from '../ui/Button';
import {
  fetchCalendarFeedUrl,
  regenerateCalendarFeedUrl,
} from '../../services/calendarApi';

/**
 * "Sync to your calendar" (LT-044): shows the owner's private ICS feed URL,
 * subscribable from Apple Calendar, Google Calendar and Outlook. The URL is a
 * bearer credential, which is why regeneration exists and the copy explains
 * not to share it.
 */
const CalendarFeedCard: React.FC = () => {
  const { t } = useTranslation();
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchCalendarFeedUrl()
      .then(setFeedUrl)
      .finally(() => setIsLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('settings.calendar.copyFailed'));
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm(t('settings.calendar.regenerateConfirm'))) return;
    setIsRegenerating(true);
    const url = await regenerateCalendarFeedUrl();
    setIsRegenerating(false);
    if (url) {
      setFeedUrl(url);
      toast.success(t('settings.calendar.regenerated'));
    } else {
      toast.error(t('settings.calendar.regenerateFailed'));
    }
  };

  return (
    <Card className="shadow-xl">
      <div className="flex items-center gap-3 mb-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
          {t('settings.calendar.title')}
        </h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {t('settings.calendar.description')}
      </p>

      {isLoading ? (
        <div className="h-10 rounded-lg bg-light-gray/40 dark:bg-dark-gray/40 animate-pulse" />
      ) : feedUrl ? (
        <>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              readOnly
              value={feedUrl}
              onFocus={(e) => e.target.select()}
              dir="ltr"
              className="flex-1 px-3 py-2 rounded-lg border border-light-gray dark:border-dark-gray bg-light-surface dark:bg-dark-surface text-sm text-light-text dark:text-dark-text font-mono overflow-x-auto"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCopy}
                leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? t('settings.calendar.copied') : t('settings.calendar.copy')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleRegenerate}
                isLoading={isRegenerating}
                leftIcon={<RefreshCcw className="w-4 h-4" />}
              >
                {t('settings.calendar.regenerate')}
              </Button>
            </div>
          </div>
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-disc ps-4">
            <li>{t('settings.calendar.howApple')}</li>
            <li>{t('settings.calendar.howGoogle')}</li>
            <li className="text-orange-500 dark:text-orange-400">
              {t('settings.calendar.privacyNote')}
            </li>
          </ul>
        </>
      ) : (
        <p className="text-sm text-red-500">{t('settings.calendar.loadFailed')}</p>
      )}
    </Card>
  );
};

export default CalendarFeedCard;
