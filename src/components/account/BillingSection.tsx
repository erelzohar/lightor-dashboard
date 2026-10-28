import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, Check, Loader2, CalendarX, AlertTriangle, Receipt } from 'lucide-react';
import type { AxiosError } from 'axios';
import type { CheckoutEventsData } from '@paddle/paddle-js';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchUpgradePlans,
  createCheckout,
  openInlineCheckout,
  closeCheckout,
  onCheckoutEvent,
  fetchPortalLinks,
  cancelSubscription,
  resumeSubscription,
  UpgradePlan,
  PortalLinks,
  CheckoutTransaction,
} from '../../services/paddleApi';
import { fetchMyEntitlements, MyEntitlements, BookingsMeter } from '../../services/entitlementsApi';
import ExtraBookingsSwitch from './ExtraBookingsSwitch';
import PlanCompare from './PlanCompare';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { canOfferPurchases } from '../../lib/platform';

// Activation is webhook-driven, so after a completed checkout the server is
// re-read on this cadence until the subscription flips. Sandbox webhooks
// usually land within seconds; a lost webhook gives up after the full window
// rather than spinning forever.
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_TRIES = 24;

// The element Paddle draws the embedded checkout into (LT-303).
const CHECKOUT_FRAME = 'paddle-checkout-frame';

/**
 * Subscription state + upgrade checkout (LT-004).
 *
 * Renders what the *server* says the subscription is; the upgrade button opens
 * Paddle's overlay and that is the extent of this component's authority.
 * Activation arrives asynchronously via the Paddle→backend webhook, which is
 * why completing a checkout shows "processing" rather than flipping the badge
 * locally — the badge changes when the server's user record does.
 *
 * LT-265: the plans are on offer during the free Plus period too — a
 * subscription bought then is first charged when the period ends — and the
 * payment method and invoices are managed in Paddle's customer portal.
 */
interface BillingSectionProps {
  /**
   * A leads site (LT-199, `isLeadsSite`): it takes no bookings, so its plan is
   * measured by the leads meter alone.
   */
  leadsSite?: boolean;
}

const BillingSection: React.FC<BillingSectionProps> = ({ leadsSite = false }) => {
  const { auth, refreshUser } = useAuth();
  const { t, i18n } = useTranslation();
  const [plans, setPlans] = useState<UpgradePlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [awaitingWebhook, setAwaitingWebhook] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [portalOpening, setPortalOpening] = useState<keyof PortalLinks | null>(null);
  const [entitlements, setEntitlements] = useState<MyEntitlements | null>(null);
  // LT-303: the checkout embedded in this card — the plan picked and the
  // transaction the server prepared for it — and the checkout's own numbers,
  // from Paddle's events.
  const [checkout, setCheckout] = useState<{ plan: UpgradePlan; transaction: CheckoutTransaction } | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutEventsData | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = auth.user?.subscription?.status ?? 'free';
  const isPaid = status === 'active';
  // LT-310: Plus that is not bought (the server says so; the operator's account).
  const complimentary = entitlements?.complimentary === true;
  const cancelScheduled = auth.user?.subscription?.cancelAtPeriodEnd === true;
  const nextBillDate = auth.user?.subscription?.nextBillDate;
  // In the app this card only reports the plan (LT-130, App Store 3.1.1): no
  // prices, no upgrade, and no cancel, resume or payment management either,
  // since each of those is managing a purchase made outside Apple. The usage
  // meter stays — it is the account's own usage, not an offer.
  const canSell = canOfferPurchases();
  // Paddle's customer portal (LT-265) is for an account Paddle knows as a
  // customer: /auth/me says so with customerId, and the statuses stand in for
  // a record without one. Should Paddle not know it after all, the server
  // answers 400 and the button says so.
  const hasBillingAccount =
    !!auth.user?.subscription?.customerId || ['active', 'past_due', 'canceled'].includes(status);

  useEffect(() => {
    let cancelled = false;
    fetchMyEntitlements().then((data) => {
      if (cancelled) return;
      setEntitlements(data);
      // The plans are on offer all through the free days (LT-458; before it
      // only in their last week, LT-290): a card added early starts a trial
      // of the days left. Not for an account whose Plus is not bought
      // (LT-310), nor when the account's plan could not be read (LT-315):
      // unknown is not "open", so nothing is offered.
      if (data && !data.complimentary && canOfferPurchases()) {
        fetchUpgradePlans()
          // A failure to load Paddle reads as no plans: "unavailable", never
          // a spinner that turns forever (LT-315).
          .catch((): UpgradePlan[] => [])
          .then((fetched) => {
            if (!cancelled) {
              setPlans(fetched);
              setLoadingPlans(false);
            }
          });
      } else {
        setLoadingPlans(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingPlans(false);
    });
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const appointmentCap = entitlements?.limits.monthlyAppointments ?? null;
  const appointmentsUsed = entitlements?.usage.appointmentsThisMonth ?? 0;
  const capRatio = appointmentCap ? Math.min(appointmentsUsed / appointmentCap, 1) : 0;
  // Contact-form leads (LT-197): the second meter on a capped plan.
  const leadsCap = entitlements?.limits.monthlyLeads ?? null;
  const leadsUsed = entitlements?.usage.leadsThisMonth ?? 0;
  const leadsRatio = leadsCap ? Math.min(leadsUsed / leadsCap, 1) : 0;
  // Pilot grant (LT-187): the server says the account has Plus free until a
  // date although the subscription still reads 'free'. Dated in the UI's
  // language, as the Customers page formats its dates.
  const pilot = entitlements?.pilot ?? null;
  const dateLocale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';
  const pilotDate = pilot ? new Date(pilot.until).toLocaleDateString(dateLocale) : null;
  // LT-458: the bookings this period - a subscriber's 500 (past them the
  // owner's switch decides, LT-465: extras billed, or booking closed until
  // the next period) or a free-period month's 200 (then the site stops
  // taking bookings until a card is added).
  const bookings = entitlements?.bookings ?? null;
  const extras = bookings?.kind === 'plus' ? bookings.extras : undefined;
  const includedClosed = extras?.closed === true;
  const bookingsRatio = bookings && bookings.included > 0 ? Math.min(bookings.used / bookings.included, 1) : 0;
  const extraBookings = bookings ? Math.max(0, bookings.used - bookings.included) : 0;
  const freeMonthFull = bookings?.kind === 'freePeriod' && bookings.used >= bookings.included;
  const bookingsPeriodEnd = bookings ? new Date(bookings.periodEnd).toLocaleDateString(dateLocale) : null;
  const bookingTerms = entitlements?.bookingTerms;

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

  // Picking a plan asks the server for the transaction (when the first charge
  // comes is its to say), then the card makes room for the checkout; the
  // effect below opens Paddle into it.
  const handleUpgrade = async (plan: UpgradePlan) => {
    setOpening(plan.priceId);
    try {
      const transaction = await createCheckout(plan.priceId);
      setCheckoutData(null);
      setCheckout({ plan, transaction });
    } catch (error) {
      const response = (error as AxiosError<{ code?: string }>)?.response;
      if (response?.status === 409 && (response.data?.code === 'TOO_EARLY' || response.data?.code === 'COMPLIMENTARY')) {
        // Not "already subscribed" (LT-315): nothing to buy yet, or Plus is
        // given. Re-read the plan and the card stops offering.
        toast.error(t('billing.checkoutUnavailable'));
        void fetchMyEntitlements().then((data) => { if (data) setEntitlements(data); });
      } else if (response?.status === 409) {
        // Subscribed already — in another tab, or by a webhook this page has
        // not seen yet: re-read the account and the card follows.
        toast(t('billing.alreadySubscribed'));
        await refreshUser();
      } else {
        toast.error(t('billing.checkoutUnavailable'));
      }
    } finally {
      setOpening(null);
    }
  };

  // LT-303: Paddle draws the checkout once its element is on the page, and it
  // goes with the panel — back to the plans, a finished payment, leaving.
  const checkoutTransactionId = checkout?.transaction.transactionId;
  useEffect(() => {
    if (!checkoutTransactionId) return;
    const off = onCheckoutEvent((event) => {
      if ((event.name === 'checkout.loaded' || event.name === 'checkout.updated') && event.data) {
        setCheckoutData(event.data);
      }
    });
    void openInlineCheckout({
      transactionId: checkoutTransactionId,
      email: auth.user?.email,
      language: i18n.language,
      frameTarget: CHECKOUT_FRAME,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      // Only a *completed* checkout means anything is processing.
      onCompleted: () => {
        setCheckout(null);
        toast(t('billing.processingHint'), { icon: '⏳', duration: 6000 });
        setAwaitingWebhook(true);
        pollUntilActive(0);
      },
    }).then((opened) => {
      if (opened) return;
      setCheckout(null);
      toast.error(t('billing.checkoutUnavailable'));
    });
    return () => {
      off();
      closeCheckout();
    };
    // The checkout belongs to its transaction; nothing else re-opens it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutTransactionId]);

  // Paddle's numbers in the page's language; the currency is the checkout's.
  const money = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(dateLocale, { style: 'currency', currency }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  };
  const termsLine = (included: number, agorot: number) =>
    t('billing.planBookingTerms', { included, price: money(agorot / 100, 'ILS') });
  // What one extra booking costs (LT-465), for the switch and the plans.
  const extraPrice = money((bookings?.extraAgorot ?? bookingTerms?.extraAgorot ?? 35) / 100, 'ILS');
  const meterChanged = (next: BookingsMeter) =>
    setEntitlements((current) => (current ? { ...current, bookings: next } : current));
  const firstChargeDate = checkout?.transaction.firstChargeAt
    ? new Date(checkout.transaction.firstChargeAt).toLocaleDateString(dateLocale)
    : null;

  // Each visit to the portal gets a fresh, short-lived link from the server,
  // so the tab is opened blank inside the click — the one moment a popup
  // blocker allows it — and sent on once the link arrives. Blocked anyway,
  // the portal opens in this tab instead.
  const openPortal = async (link: keyof PortalLinks) => {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    setPortalOpening(link);
    try {
      const links = await fetchPortalLinks();
      const url = links[link] ?? links.overview;
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (error) {
      tab?.close();
      toast.error(
        t((error as AxiosError)?.response?.status === 400 ? 'billing.portalNoAccount' : 'billing.portalUnavailable')
      );
    } finally {
      setPortalOpening(null);
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

  const manageButton =
    canSell && hasBillingAccount ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => void openPortal('overview')}
        disabled={portalOpening !== null}
        leftIcon={<Receipt size={14} />}
      >
        {portalOpening === 'overview' ? t('billing.opening') : t('billing.manageBilling')}
      </Button>
    ) : null;

  const meters = (
    <>
      {/* A leads site has no bookings to count (LT-199). */}
      {appointmentCap !== null && !leadsSite && (
        <div className="space-y-1.5" data-testid="appointments-meter">
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

      {/* Contact-form leads (LT-197). */}
      {leadsCap !== null && (
        <div className="space-y-1.5" data-testid="leads-meter">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-200 font-medium">
              {t('billing.leadsMeter', { used: leadsUsed, cap: leadsCap })}
            </span>
            {leadsRatio >= 0.8 && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {leadsRatio >= 1 ? t('billing.leadsFull') : t('billing.usageNearCap')}
              </span>
            )}
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                leadsRatio >= 1
                  ? 'bg-red-500'
                  : leadsRatio >= 0.8
                    ? 'bg-amber-500'
                    : 'bg-primary'
              }`}
              style={{ width: `${Math.round(leadsRatio * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* The bookings made this period, cancelled ones included (LT-458). A
          leads site takes none (LT-199). */}
      {bookings && !leadsSite && (
        <div className="space-y-1.5" data-testid="bookings-meter">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-gray-700 dark:text-gray-200 font-medium">
              {t(bookings.kind === 'plus' ? 'billing.bookingsMeter' : 'billing.bookingsMeterFree', {
                used: bookings.used,
                included: bookings.included,
              })}
            </span>
            {bookingsRatio >= 0.8 && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 text-end">
                {bookings.kind === 'freePeriod'
                  ? freeMonthFull ? t('billing.bookingsFreeFull') : t('billing.usageNearCap')
                  : includedClosed
                    ? t('billing.extras.closedShort')
                    : extraBookings > 0
                      ? t('billing.bookingsExtraCount', { n: extraBookings })
                      : t('billing.bookingsNearIncluded')}
              </span>
            )}
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                freeMonthFull || includedClosed ? 'bg-red-500' : bookingsRatio >= 0.8 ? 'bg-amber-500' : 'bg-primary'
              }`}
              style={{ width: `${Math.round(bookingsRatio * 100)}%` }}
            />
          </div>
          {bookings.kind === 'plus' ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {/* With the switch (LT-465) the price is said beside it. */}
                {bookings.extraAgorot !== null && !extras &&
                  `${t('billing.bookingsExtraPrice', {
                    included: bookings.included,
                    price: money(bookings.extraAgorot / 100, 'ILS'),
                  })} `}
                {t('billing.bookingsResets', { date: bookingsPeriodEnd })}
              </p>
              <ExtraBookingsSwitch
                bookings={bookings}
                price={extraPrice}
                periodEnd={bookingsPeriodEnd}
                dateLocale={dateLocale}
                canSell={canSell}
                onChanged={meterChanged}
              />
            </>
          ) : freeMonthFull ? (
            // Adding a card is a call to buy, so the app states the fact only (LT-130).
            <p className="text-xs text-red-600 dark:text-red-400" data-testid="free-month-full">
              {canSell
                ? t('billing.bookingsFreeFullDesc', { date: pilotDate })
                : t('billing.bookingsFreeFullNative', { date: bookingsPeriodEnd })}
            </p>
          ) : null}
        </div>
      )}
    </>
  );

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
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${complimentary ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : badgeClasses}`}>
            {complimentary ? <bdi>Plus</bdi> : (statusLabel[status] ?? status)}
          </span>
        </div>

        {/* LT-310: the operator's own account — Plus for good, nothing to buy,
            cancel or manage, whatever an old subscription record says. */}
        {complimentary ? (
          <p className="text-sm text-gray-600 dark:text-gray-300" data-testid="billing-complimentary">
            {t('billing.complimentary')}
          </p>
        ) : isPaid ? (
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
                {meters}
                {canSell && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      onClick={handleResumeSubscription}
                      disabled={resuming}
                    >
                      {resuming ? t('billing.resuming') : t('billing.resumeCta')}
                    </Button>
                    {manageButton}
                  </div>
                )}
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
                {/* LT-458: the bookings beside the subscription (Erel: only here). */}
                {meters}
                {/* What the plan includes (LT-465), in place of "no monthly limits". */}
                <PlanCompare mode="plus" price={extraPrice} />
                {manageButton && <div>{manageButton}</div>}
                {canSell && (
                  <button
                    type="button"
                    onClick={() => setCancelModalOpen(true)}
                    className="text-xs text-gray-400 dark:text-gray-500 underline hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    {t('billing.cancelCta')}
                  </button>
                )}
              </>
            )}
          </div>
        ) : status === 'past_due' ? (
          <>
            {/* A renewal Paddle could not collect (LT-265): until it is paid
                the site takes no bookings or inquiries and the customers'
                reminders stop (LT-458). The app states it without the way to
                pay (LT-130). */}
            <div
              className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200"
              data-testid="billing-past-due"
            >
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <p>{t(canSell ? 'billing.pastDueDesc' : 'billing.pastDueDescNative')}</p>
            </div>
            {meters}
            {canSell && <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => void openPortal('updatePaymentMethod')}
                disabled={portalOpening !== null}
                leftIcon={<CreditCard size={16} />}
              >
                {portalOpening === 'updatePaymentMethod' ? t('billing.opening') : t('billing.updatePaymentMethod')}
              </Button>
              {manageButton}
            </div>}
          </>
        ) : (
          <>
            {/* Under the pilot grant the free-plan copy would claim a cap the
                account does not have, so the pilot line stands in for it. A
                statement about the account, not an offer, so it shows in the
                app as well (LT-130). */}
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {pilotDate
                ? t('billing.pilotLine', { date: pilotDate })
                : canSell
                  ? t('billing.freeDesc')
                  : t('billing.freeDescNative')}
            </p>
            {/* The free period this account did not get, and why (LT-360). */}
            {!pilotDate && auth.user?.freePeriod?.state === 'withheld' && (
              <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="free-period-used">{t('billing.freePeriodUsed')}</p>
            )}
            {!pilotDate && auth.user?.freePeriod?.state === 'pending' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('billing.freePeriodPending')}</p>
            )}
            {meters}

            {/* On sale all through the free days (LT-458): the server starts
                such a subscription with its first charge at the grant's end. */}
            {!canSell ? null : awaitingWebhook ? (
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
            ) : checkout ? (
              <div className="space-y-4" data-testid="inline-checkout">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {t('billing.checkout.title')}
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCheckout(null)}
                  >
                    {t('billing.checkout.back')}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
                  {/* Paddle draws only the payment form in the page, so the
                      summary is ours — with the checkout's own numbers. */}
                  <div
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 text-sm"
                    data-testid="checkout-summary"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {/* "Lightor+" beside Hebrew reads "+Lightor" without an isolate. */}
                      <bdi>{checkout.plan.productName}</bdi>
                      {checkout.plan.interval && (
                        <span className="font-normal text-gray-500 dark:text-gray-400">
                          {' · '}
                          {t(`billing.per_${checkout.plan.interval}`)}
                        </span>
                      )}
                    </div>
                    {checkoutData ? (
                      <>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-gray-600 dark:text-gray-300">{t('billing.checkout.dueToday')}</span>
                          <span className="text-lg font-bold text-gray-900 dark:text-white" data-testid="checkout-due-today">
                            {money(checkoutData.totals.total, checkoutData.currency_code)}
                          </span>
                        </div>
                        {firstChargeDate && checkoutData.recurring_totals && (
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-gray-600 dark:text-gray-300">
                              {t('billing.checkout.firstCharge', { date: firstChargeDate })}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white" data-testid="checkout-first-charge">
                              {money(checkoutData.recurring_totals.total, checkoutData.currency_code)}
                            </span>
                          </div>
                        )}
                        {bookingTerms?.extraAgorot != null && (
                          <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="checkout-booking-terms">
                            {termsLine(bookingTerms.included, bookingTerms.extraAgorot)}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {firstChargeDate
                            ? t('billing.checkout.cancelBefore', { date: firstChargeDate })
                            : t(`billing.checkout.renews_${checkout.plan.interval === 'year' ? 'year' : 'month'}`)}
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 size={14} className="animate-spin shrink-0" />
                        {t('billing.checkout.loading')}
                      </div>
                    )}
                    <a
                      href="https://lightor.app/refund.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-gray-500 dark:text-gray-400 underline hover:text-primary"
                    >
                      {t('billing.refundPolicy')}
                    </a>
                  </div>
                  {/* Paddle needs 312px; on a phone the frame takes the card's padding too. */}
                  <div className={`${CHECKOUT_FRAME} -mx-6 sm:mx-0 min-w-0`} data-testid="checkout-frame" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {pilotDate && (
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    {t('billing.pilotSubscribeNote', { date: pilotDate })}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {plans.map((plan) => (
                    <div
                      key={plan.priceId}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-2"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        <bdi>{plan.productName}</bdi>
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
                        onClick={() => handleUpgrade(plan)}
                        disabled={opening !== null}
                      >
                        {opening === plan.priceId
                          ? t('billing.opening')
                          : pilotDate
                            ? t('billing.subscribe')
                            : t('billing.upgrade')}
                      </Button>
                    </div>
                  ))}
                </div>
                {/* What the plan includes, and what a booking over it costs (LT-458). */}
                {bookingTerms?.extraAgorot != null && (
                  <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="plan-booking-terms">
                    {termsLine(bookingTerms.included, bookingTerms.extraAgorot)}
                  </p>
                )}
                {/* Paddle asks for the seller's own refund terms beside the plans (LT-265). */}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <a
                    href="https://lightor.app/refund.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-primary"
                  >
                    {t('billing.refundPolicy')}
                  </a>
                </p>
              </div>
            )}

            {/* Free and Lightor+ side by side (LT-465): web only, as the plans
                are, and said even when Paddle's prices could not be read. */}
            {canSell && !checkout && <PlanCompare mode="compare" price={extraPrice} />}

            {/* A plan that ended still has its invoices (LT-265). */}
            {manageButton && <div>{manageButton}</div>}
          </>
        )}
      </div>

      {cancelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overlay-safe"
          onClick={() => !cancelling && setCancelModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl glass-modal p-6 space-y-4"
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
