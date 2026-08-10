import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, Check, Loader2, CalendarX } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUpgradePlans, openUpgradeCheckout, cancelSubscription, resumeSubscription, UpgradePlan } from '../../services/paddleApi';
import { fetchMyEntitlements, MyEntitlements } from '../../services/entitlementsApi';
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
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [entitlements, setEntitlements] = useState<MyEntitlements | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = auth.user?.subscription?.status ?? 'free';
  const isPaid = status === 'active';
  const cancelScheduled = auth.user?.subscription?.cancelAtPeriodEnd === true;
  const nextBillDate = auth.user?.subscription?.nextBillDate;

  useEffect(() => {
    let cancelled = false;
    fetchUpgradePlans().then((fetched) => {
      if (!cancelled) {
        setPlans(fetched);
        setLoadingPlans(false);
      }
    });
    fetchMyEntitlements().then((data) => {
      if (!cancelled) setEntitlements(data);
    });
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const appointmentCap = entitlements?.limits.monthlyAppointments ?? null;
  const appointmentsUsed = entitlements?.usage.appointmentsThisMonth ?? 0;
  const capRatio = appointmentCap ? Math.min(appointmentsUsed / appointmentCap, 1) : 0;

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

  // Cancellation is confirmed the same way an upgrade is: Paddle answers the
  // server through the webhook, which sets cancelAtPeriodEnd; re-read until
  // it lands. Timing out is harmless — the flag appears on the next refresh.
  const pollUntilCancelScheduled = (tries: number) => {
    pollTimer.current = setTimeout(async () => {
      const user = await refreshUser();
      if (user?.subscription?.cancelAtPeriodEnd || user?.subscription?.status === 'canceled') {
        return;
      }
      if (tries + 1 < POLL_MAX_TRIES) pollUntilCancelScheduled(tries + 1);
    }, POLL_INTERVAL_MS);
  };

  // The mirror image of cancelling: Paddle drops the scheduled change, the
  // webhook clears cancelAtPeriodEnd, and the poll below picks that up. A 409
  // means the plan already ended — refreshUser flips the card to the upgrade
  // state, which is the correct path back for a fully-ended subscription.
  const pollUntilResumed = (tries: number) => {
    pollTimer.current = setTimeout(async () => {
      const user = await refreshUser();
      if (user && !user.subscription?.cancelAtPeriodEnd) {
        setResuming(false);
        toast.success(t('billing.resumed'), { duration: 6000 });
        return;
      }
      if (tries + 1 >= POLL_MAX_TRIES) {
        setResuming(false);
        toast(t('billing.stillProcessing'), { icon: '⏳', duration: 8000 });
        return;
      }
      pollUntilResumed(tries + 1);
    }, POLL_INTERVAL_MS);
  };

  const handleResumeSubscription = async () => {
    setResuming(true);
    try {
      await resumeSubscription();
      pollUntilResumed(0);
    } catch (error: any) {
      setResuming(false);
      if (error?.response?.status === 409) {
        toast.error(t('billing.resumeTooLate'));
        await refreshUser();
      } else {
        toast.error(t('billing.resumeFailed'));
      }
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      const { activeUntil } = await cancelSubscription();
      setCancelModalOpen(false);
      const until = activeUntil ?? nextBillDate;
      toast.success(
        until
          ? t('billing.cancelScheduledToast', { date: new Date(until).toLocaleDateString() })
          : t('billing.cancelScheduledToastNoDate'),
        { duration: 8000 }
      );
      pollUntilCancelScheduled(0);
    } catch {
      toast.error(t('billing.cancelFailed'));
    } finally {
      setCancelling(false);
    }
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
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3">
            {cancelScheduled ? (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <CalendarX size={16} className="shrink-0" />
                  {nextBillDate
                    ? t('billing.cancelScheduledDesc', {
                        date: new Date(nextBillDate).toLocaleDateString(),
                      })
                    : t('billing.cancelScheduledDescNoDate')}
                </p>
                <div>
                  <Button
                    variant="primary"
                    onClick={handleResumeSubscription}
                    disabled={resuming}
                  >
                    {resuming ? t('billing.resuming') : t('billing.resumeCta')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="flex items-center gap-2">
                    <Check size={16} className="text-green-600 shrink-0" />
                    {t('billing.activeDesc')}
                  </p>
                  {nextBillDate && (
                    <p>
                      {t('billing.nextBill')}{' '}
                      {new Date(nextBillDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="text-xs text-gray-400 dark:text-gray-500 underline hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  {t('billing.cancelCta')}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t('billing.freeDesc')}
            </p>

            {appointmentCap !== null && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-200 font-medium">
                    {t('billing.usageMeter', { used: appointmentsUsed, cap: appointmentCap })}
                  </span>
                  {capRatio >= 0.8 && (
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {capRatio >= 1 ? t('billing.usageFull') : t('billing.usageNearCap')}
                    </span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      capRatio >= 1
                        ? 'bg-red-500'
                        : capRatio >= 0.8
                          ? 'bg-amber-500'
                          : 'bg-primary'
                    }`}
                    style={{ width: `${Math.round(capRatio * 100)}%` }}
                  />
                </div>
              </div>
            )}

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
                      {opening === plan.priceId
                        ? t('billing.opening')
                        : plan.trialDays
                          ? t('billing.upgradeTrial', { days: plan.trialDays })
                          : t('billing.upgrade')}
                    </Button>
                    {plan.trialDays && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
                        {t('billing.trialNote', { days: plan.trialDays })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {cancelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !cancelling && setCancelModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-dark-surface p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('billing.cancelModalTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {nextBillDate
                ? t('billing.cancelModalBody', {
                    date: new Date(nextBillDate).toLocaleDateString(),
                  })
                : t('billing.cancelModalBodyNoDate')}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelling}
              >
                {t('billing.cancelModalKeep')}
              </Button>
              <Button
                variant="danger"
                onClick={handleCancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? t('billing.cancelling') : t('billing.cancelModalConfirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default BillingSection;
