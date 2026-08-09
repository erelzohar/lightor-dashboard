import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, Check, Loader2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUpgradePlans, openUpgradeCheckout, UpgradePlan } from '../../services/paddleApi';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

// Activation is webhook-driven, so after a completed checkout the server is
// re-read on this cadence until the subscription flips. Sandbox webhooks
// usually land within seconds; a lost webhook gives up after the full window
// rather than spinning forever.
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_TRIES = 24;

/**
 * Subscription state + upgrade checkout (LT-004).
 *
 * Renders what the *server* says the subscription is; the upgrade button opens
 * Paddle's overlay and that is the extent of this component's authority.
 * Activation arrives asynchronously via the Paddle→backend webhook, which is
 * why completing a checkout shows "processing" rather than flipping the badge
 * locally — the badge changes when the server's user record does.
 */
const BillingSection: React.FC = () => {
  const { auth, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [plans, setPlans] = useState<UpgradePlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [awaitingWebhook, setAwaitingWebhook] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = auth.user?.subscription?.status ?? 'free';
  const isPaid = status === 'active';

  useEffect(() => {
    let cancelled = false;
    fetchUpgradePlans().then((fetched) => {
      if (!cancelled) {
        setPlans(fetched);
        setLoadingPlans(false);
      }
    });
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  // Payment confirmed on Paddle's side; now chase the webhook. Each round
  // re-reads /auth/me — the badge flips through context state the moment the
  // server record does, no manual refresh needed.
  const pollUntilActive = (tries: number) => {
    pollTimer.current = setTimeout(async () => {
      const user = await refreshUser();
      if (user?.subscription?.status === 'active') {
        setAwaitingWebhook(false);
        toast.success(t('billing.activated'), { duration: 6000 });
        return;
      }
      if (tries + 1 >= POLL_MAX_TRIES) {
        setAwaitingWebhook(false);
        toast(t('billing.stillProcessing'), { icon: '⏳', duration: 8000 });
        return;
      }
      pollUntilActive(tries + 1);
    }, POLL_INTERVAL_MS);
  };

  const handleUpgrade = async (priceId: string) => {
    if (!auth.user?._id) return;
    setOpening(priceId);
    const opened = await openUpgradeCheckout({
      priceId,
      userId: auth.user._id,
      email: auth.user.email,
      // Only a *completed* checkout means anything is processing. Opening the
      // overlay used to fire the toast, which told window-shoppers their
      // payment was underway before any form existed to fill.
      onCompleted: () => {
        toast(t('billing.processingHint'), { icon: '⏳', duration: 6000 });
        setAwaitingWebhook(true);
        pollUntilActive(0);
      },
    });
    setOpening(null);
    if (!opened) {
      toast.error(t('billing.checkoutUnavailable'));
    }
  };

  const statusLabel: Record<string, string> = {
    free: t('billing.statusFree'),
    active: t('billing.statusActive'),
    past_due: t('billing.statusPastDue'),
    canceled: t('billing.statusCanceled'),
    deleted: t('billing.statusCanceled'),
  };

  const badgeClasses = isPaid
    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    : status === 'past_due'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="text-primary w-5 h-5 shrink-0" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('billing.title')}
            </h2>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClasses}`}>
            {statusLabel[status] ?? status}
          </span>
        </div>

        {isPaid ? (
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <p className="flex items-center gap-2">
              <Check size={16} className="text-green-600 shrink-0" />
              {t('billing.activeDesc')}
            </p>
            {auth.user?.subscription?.nextBillDate && (
              <p>
                {t('billing.nextBill')}{' '}
                {new Date(auth.user.subscription.nextBillDate).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('billing.freeDesc')}
            </p>

            {awaitingWebhook ? (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Loader2 size={16} className="animate-spin shrink-0" />
                {t('billing.processingHint')}
              </div>
            ) : loadingPlans ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin shrink-0" />
                {t('billing.loadingPlans')}
              </div>
            ) : plans.length === 0 ? (
              <p className="text-sm text-gray-500">{t('billing.plansUnavailable')}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((plan) => (
                  <div
                    key={plan.priceId}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-2"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {plan.productName}
                    </span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {plan.formatted}
                      {plan.interval && (
                        <span className="text-sm font-normal text-gray-500">
                          {' / '}
                          {t(`billing.per_${plan.interval}`)}
                        </span>
                      )}
                    </span>
                    <Button
                      variant="primary"
                      onClick={() => handleUpgrade(plan.priceId)}
                      disabled={opening !== null}
                    >
                      {opening === plan.priceId ? t('billing.opening') : t('billing.upgrade')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
};

export default BillingSection;
