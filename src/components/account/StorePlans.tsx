import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Lock, Package, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import type { MyEntitlements } from '../../services/entitlementsApi';
import { PLAN_NAMES, type UpgradePlan } from '../../services/paddleApi';
import { nativePlatform } from '../../lib/platform';
import {
  buyStoreProduct,
  hasFreeTrial,
  loadStoreOffers,
  manageStoreUrl,
  offerFor,
  restoreStore,
  type StoreOffers,
} from '../../lib/storePurchases';
import type { CardExtra } from '../ui/pricing-section-3';

// LT-602: the web's plan cards, with the stores' prices; their own chunk, as on the web.
const PricingSection = lazy(() => import('../ui/pricing-section-3'));

const TERMS_URL = 'https://lightor.app/terms.html';
const DAY_MS = 24 * 60 * 60 * 1000;
/** iPhone: Lightor+ opens in the free days' last 3 days (Erel 2026-11-05, LT-589). */
export const APPLE_PLUS_OPEN_DAYS = 3;
const PRIVACY_URL = 'https://lightor.app/privacy.html';
/** How long the store may take to name its products before the plans read as unavailable. */
const STORE_TIMEOUT_MS = 30_000;

/**
 * LT-580: the Account page's store in the apps - the plans for an owner who
 * has none, and for a subscription the store bills: managing it in the store,
 * moving Lightor+ up to Pro, restoring purchases, and the booking packs (100
 * bookings, never expiring) that take the extra bookings' place.
 *
 * In the free days (LT-589, Erel 2026-11-05) both plans are on show. Pro is
 * paid today and opens at once. Lightor+ is what the free days already are:
 * on Google Play its short trial is deferred by the server to the free days'
 * end, so it is first charged then; the App Store cannot defer, so on the
 * iPhone (and on Play without a trial to take) it opens only in the free
 * days' last 3 days, and is paid from that day.
 * Prices are the store's own, in the owner's money. Shown only where
 * `storeSalesOn()`; a subscription paid on the web is left to the web.
 *
 * LT-602 (Erel 2026-11-06): the plans are the web's cards, monthly and
 * yearly, each yearly product the store sells beside its monthly one.
 */
const StorePlans: React.FC<{ entitlements: MyEntitlements; leadsSite?: boolean; onChanged: () => Promise<void> }> = ({ entitlements, leadsSite = false, onChanged }) => {
  const { t, i18n } = useTranslation();
  const { auth } = useAuth();
  const userId = auth.user?._id ?? '';
  const [offers, setOffers] = useState<StoreOffers | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const store = entitlements.store;
  const billedBy = store?.billedBy ?? null;
  // LT-607: a store renewal that failed (past_due, the grace period) is still the store's to fix.
  const pastDue = auth.user?.subscription?.status === 'past_due';
  const subscribed = (auth.user?.subscription?.status === 'active' || pastDue) && !!billedBy;
  const pilot = entitlements.pilot ?? null;
  const freeDaysEnd = pilot ? new Date(pilot.until) : null;
  const inFreeDays = !!freeDaysEnd && freeDaysEnd.getTime() > Date.now();
  const storeName = t(nativePlatform() === 'android' ? 'billing.store.googlePlay' : 'billing.store.appStore');
  const dateLocale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';

  useEffect(() => {
    if (!store || !userId) return;
    let live = true;
    // LT-604: a store that never answers shows "plans unavailable", not a loader for ever.
    const giveUp = setTimeout(() => { if (live) setFailed(true); }, STORE_TIMEOUT_MS);
    loadStoreOffers(userId, store.products)
      .then((found) => { if (live) setOffers(found); })
      .catch(() => { if (live) setFailed(true); })
      .finally(() => clearTimeout(giveUp));
    return () => { live = false; clearTimeout(giveUp); };
  }, [store, userId]);

  if (!store) return null;

  const run = async (key: string, action: () => Promise<'done' | 'cancelled' | void>, done: string) => {
    setBusy(key);
    try {
      const outcome = await action();
      if (outcome !== 'cancelled') {
        await onChanged();
        toast.success(t(done), { duration: 6000 });
      }
    } catch {
      toast.error(t('billing.store.failed'));
    } finally {
      setBusy(null);
    }
  };

  const restore = (
    <button
      type="button"
      onClick={() => void run('restore', () => restoreStore(userId), 'billing.store.restored')}
      disabled={busy !== null}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 underline-offset-2 hover:underline disabled:opacity-60 dark:text-gray-400"
      data-testid="store-restore"
    >
      {busy === 'restore' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
      {t('billing.store.restore')}
    </button>
  );

  const day = (date: Date) => date.toLocaleDateString(dateLocale);

  if (subscribed) {
    const packs = entitlements.bookings?.packs;
    const pack = offers?.pack;
    // Pro for the same period as the Lightor+ it replaces (LT-602), else the monthly one.
    const sub = auth.user?.subscription as { interval?: string; priceId?: string } | undefined;
    const pro = offerFor(offers, 'pro', sub?.interval === 'year' ? 'year' : 'month') ?? offerFor(offers, 'pro', 'month');
    const replacing = sub?.priceId ?? offerFor(offers, 'plus', 'month')?.identifier;
    return (
      <div className="space-y-3" data-testid="store-subscribed">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('billing.store.billedBy', { store: storeName })}</p>
        {/* Lightor+ up to Pro (LT-589): paid today and open at once, in a free trial too. */}
        {entitlements.plan === 'plus' && pro && (
          <div className="rounded-xl border border-gray-200 p-3 text-sm dark:border-slate-700" data-testid="store-upgrade">
            <p className="text-gray-600 dark:text-gray-300">{t('billing.store.upgradeNote', { plan: PLAN_NAMES.pro })}</p>
            <Button
              className="mt-3"
              size="sm"
              onClick={() => void run('upgrade', () => buyStoreProduct(userId, pro, replacing), 'billing.activated')}
              disabled={busy !== null}
              data-testid="store-upgrade-pro"
            >
              {busy === 'upgrade' ? t('billing.opening') : t('billing.store.upgrade', { plan: PLAN_NAMES.pro, price: pro.priceString })}
            </Button>
          </div>
        )}
        {!leadsSite && !pastDue && packs && (
          <div className={`rounded-xl border p-3 text-sm ${packs.closed ? 'border-amber-300/70 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-gray-200 dark:border-slate-700'}`} data-testid="store-packs">
            <p className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
              <Package className="h-4 w-4 shrink-0 text-primary" />
              {t('billing.store.packsLeft', { count: packs.left })}
            </p>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              {t(packs.closed ? 'billing.store.packsClosed' : 'billing.store.packsHint', { size: packs.size })}
            </p>
            {pack && (
              <Button
                className="mt-3"
                size="sm"
                variant={packs.closed ? 'primary' : 'outline'}
                onClick={() => void run('pack', () => buyStoreProduct(userId, pack), 'billing.store.packBought')}
                disabled={busy !== null}
                data-testid="store-buy-pack"
              >
                {busy === 'pack' ? t('billing.opening') : t('billing.store.buyPack', { size: packs.size, price: pack.priceString })}
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<ExternalLink size={14} />}
            onClick={() => void manageStoreUrl(userId).then((url) => window.open(url, '_blank', 'noopener,noreferrer'))}
            data-testid="store-manage"
          >
            {t('billing.store.manage', { store: storeName })}
          </Button>
          {restore}
        </div>
      </div>
    );
  }

  // The store's products as the cards' offers: the product id stands in for a price id.
  const cards: UpgradePlan[] = (offers?.plans ?? []).map(({ plan, interval, product }) => ({
    plan,
    interval,
    priceId: product.identifier,
    formatted: product.priceString,
    amount: product.price,
    currency: product.currencyCode,
    productName: product.title,
  }));
  const productOf = (card: UpgradePlan) => offers?.plans.find((offer) => offer.product.identifier === card.priceId)?.product;
  const opensAt = freeDaysEnd ? new Date(freeDaysEnd.getTime() - APPLE_PLUS_OPEN_DAYS * DAY_MS) : null;
  const extraFor = (card: UpgradePlan): CardExtra | null => {
    if (!inFreeDays) return null;
    if (card.plan === 'pro') return { note: <span data-testid="store-note-pro">{t('billing.store.proPaysNow', { plan: PLAN_NAMES.pro })}</span> };
    // Lightor+ in the free days: first charged at their end where the store can defer it (Play's trial), else from their last 3 days.
    const deferred = nativePlatform() === 'android' && hasFreeTrial(productOf(card));
    const locked = !deferred && !!opensAt && Date.now() < opensAt.getTime();
    const badge = (
      <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-300" data-testid="store-plus-current">
        <Check className="h-3.5 w-3.5 shrink-0" />
        {t('billing.store.inFreeDays', { date: day(freeDaysEnd!) })}
      </p>
    );
    const note = deferred
      ? t('billing.store.plusDeferred', { date: day(freeDaysEnd!) })
      : locked
        ? t('billing.store.plusLocked', { date: day(opensAt!), days: APPLE_PLUS_OPEN_DAYS })
        : t('billing.store.plusPaysNow');
    return {
      badge,
      note: <span data-testid="store-note-plus">{note}</span>,
      ...(locked ? { disabled: true, icon: <Lock size={16} aria-hidden="true" />, label: t('billing.store.opensOnShort', { date: day(opensAt!) }) } : {}),
    };
  };
  const loading = (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <Loader2 size={16} className="animate-spin shrink-0" />
      {t('billing.loadingPlans')}
    </div>
  );
  return (
    <div className="space-y-3" data-testid="store-plans">
      {failed ? (
        <p className="text-sm text-gray-500">{t('billing.plansUnavailable')}</p>
      ) : !offers ? (
        loading
      ) : (
        <Suspense fallback={loading}>
          <PricingSection
            plans={cards}
            leadsSite={leadsSite}
            locale={dateLocale}
            extraPrice=""
            opening={busy}
            actionLabel={t(inFreeDays ? 'billing.subscribe' : 'billing.upgrade')}
            onFreePlan={!inFreeDays}
            store
            cardExtra={extraFor}
            onChoose={(card) => {
              const product = productOf(card);
              if (product) void run(card.priceId, () => buyStoreProduct(userId, product), 'billing.activated');
            }}
          />
        </Suspense>
      )}
      {/* App Store 3.1.2: what the subscription is, that it renews, how to cancel, and the terms. */}
      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400" data-testid="store-terms">
        {t('billing.store.renewal', { store: storeName })}{' '}
        <a href={TERMS_URL} target="_blank" rel="noreferrer" className="underline">{t('billing.store.terms')}</a>
        {' · '}
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="underline">{t('billing.store.privacy')}</a>
      </p>
      {restore}
    </div>
  );
};

export default StorePlans;
