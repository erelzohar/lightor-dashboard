import React, { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMyEntitlements, MyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases } from '../../lib/platform';

/**
 * What stops the site taking bookings, over the owner's pages (LT-458). The
 * Account page says it beside the subscription, so the layout leaves it out
 * there.
 *  - A failed payment Paddle is retrying (red): no bookings, inquiries or
 *    reminders until it is paid.
 *  - A free-period month's 200 bookings (amber): no bookings until a card is
 *    added, or the next free month.
 *  - A subscriber's 500 with the extra bookings switched off (amber, LT-465):
 *    no bookings until the next period, or until the owner switches them on.
 * The way to pay is a call to buy, so the app states the fact only (LT-130).
 */
const AccountBanners: React.FC<{ go: (to: string) => void }> = ({ go }) => {
  const { auth } = useAuth();
  const { t, i18n } = useTranslation();
  const userId = auth.user?._id;
  const status = auth.user?.subscription?.status;
  const [entitlements, setEntitlements] = useState<MyEntitlements | null>(null);

  // Read again when the subscription changes: a card added, a payment through.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchMyEntitlements().then((data) => {
      if (!cancelled) setEntitlements(data);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, status]);

  const canSell = canOfferPurchases();
  const dateLocale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';
  const day = (iso: string | undefined) => (iso ? new Date(iso).toLocaleDateString(dateLocale) : '');

  // The server's word when it answered; the subscription's status otherwise.
  const paymentFailed = entitlements
    ? entitlements.paymentFailed === true
    : status === 'past_due' && auth.user?.role !== 'admin';
  const bookings = entitlements?.bookings;
  const freeMonthFull = bookings?.kind === 'freePeriod' && bookings.used >= bookings.included;
  const includedClosed = bookings?.kind === 'plus' && bookings.extras?.closed === true;
  // Switching on is agreeing to pay more: on the web, and only when it can be (LT-465).
  const canReopen = canSell && bookings?.extras?.blockedBy === null;

  if (paymentFailed) {
    return (
      <div
        role="alert"
        data-testid="payment-failed-banner"
        className="mb-4 glass-card glass-tint-red rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-800/40 rounded-full text-red-600 dark:text-red-400 shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-red-800 dark:text-red-300 text-sm">{t('accountBanner.paymentFailed.title')}</h2>
            <p className="text-red-700 dark:text-red-300 mt-0.5 text-xs">
              {t('accountBanner.paymentFailed.body')}
            </p>
          </div>
        </div>
        {canSell && (
          <button
            type="button"
            onClick={() => go('/account')}
            className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors bg-red-600 hover:bg-red-700 text-white"
          >
            <CreditCard className="w-4 h-4" aria-hidden="true" />
            {t('accountBanner.paymentFailed.cta')}
          </button>
        )}
      </div>
    );
  }

  if (freeMonthFull && bookings) {
    return (
      <div
        role="status"
        data-testid="free-month-full-banner"
        className="mb-4 glass-card glass-tint-amber rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-800/40 rounded-full text-amber-700 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
              {t('accountBanner.freeMonthFull.title', { included: bookings.included })}
            </h2>
            <p className="text-amber-800 dark:text-amber-300 mt-0.5 text-xs">
              {canSell
                ? t('accountBanner.freeMonthFull.body', { date: day(entitlements?.pilot?.until) })
                : t('accountBanner.freeMonthFull.bodyApp', { date: day(bookings.periodEnd) })}
            </p>
          </div>
        </div>
        {canSell && (
          <button
            type="button"
            onClick={() => go('/account')}
            className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors bg-amber-700 hover:bg-amber-800 text-white"
          >
            <CreditCard className="w-4 h-4" aria-hidden="true" />
            {t('accountBanner.freeMonthFull.cta')}
          </button>
        )}
      </div>
    );
  }

  if (includedClosed && bookings) {
    return (
      <div
        role="status"
        data-testid="included-used-banner"
        className="mb-4 glass-card glass-tint-amber rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-800/40 rounded-full text-amber-700 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
              {t('accountBanner.includedUsed.title', { included: bookings.included })}
            </h2>
            <p className="text-amber-800 dark:text-amber-300 mt-0.5 text-xs">
              {t(canReopen ? 'accountBanner.includedUsed.body' : 'accountBanner.includedUsed.bodyApp', {
                date: day(bookings.periodEnd),
              })}
            </p>
          </div>
        </div>
        {canReopen && (
          <button
            type="button"
            onClick={() => go('/account')}
            className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors bg-amber-700 hover:bg-amber-800 text-white"
          >
            {t('accountBanner.includedUsed.cta')}
          </button>
        )}
      </div>
    );
  }

  return null;
};

export default AccountBanners;
