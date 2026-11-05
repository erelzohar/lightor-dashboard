import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Lock, Package, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import type { MyEntitlements } from '../../services/entitlementsApi';
import { PLAN_NAMES } from '../../services/paddleApi';
import { nativePlatform } from '../../lib/platform';
import {
  buyStoreProduct,
  hasFreeTrial,
  loadStoreOffers,
  manageStoreUrl,
  restoreStore,
  type StoreOffers,
  type StorePlan,
} from '../../lib/storePurchases';

const TERMS_URL = 'https://lightor.app/terms.html';
const DAY_MS = 24 * 60 * 60 * 1000;
/** iPhone: Lightor+ opens in the free days' last 3 days (Erel 2026-11-05, LT-589). */
export const APPLE_PLUS_OPEN_DAYS = 3;
const PRIVACY_URL = 'https://lightor.app/privacy.html';

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
  const subscribed = auth.user?.subscription?.status === 'active' && !!billedBy;
  const pilot = entitlements.pilot ?? null;
  const freeDaysEnd = pilot ? new Date(pilot.until) : null;
  const inFreeDays = !!freeDaysEnd && freeDaysEnd.getTime() > Date.now();
  const storeName = t(nativePlatform() === 'android' ? 'billing.store.googlePlay' : 'billing.store.appStore');
  const dateLocale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';

  useEffect(() => {
    if (!store || !userId) return;
    let live = true;
    loadStoreOffers(userId, store.products)
      .then((found) => { if (live) setOffers(found); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
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
    const pro = offers?.plans.pro;
    const plus = offers?.plans.plus;
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
              onClick={() => void run('upgrade', () => buyStoreProduct(userId, pro, plus), 'billing.activated')}
              disabled={busy !== null}
              data-testid="store-upgrade-pro"
            >
              {busy === 'upgrade' ? t('billing.opening') : t('billing.store.upgrade', { plan: PLAN_NAMES.pro, price: pro.priceString })}
            </Button>
          </div>
        )}
        {!leadsSite && packs && (
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
            onClick={() => void manageStoreUrl(userId).then((url) => window.open(url, '_blank'))}
            data-testid="store-manage"
          >
            {t('billing.store.manage', { store: storeName })}
          </Button>
          {restore}
        </div>
      </div>
    );
  }

  const plans: StorePlan[] = ['plus', 'pro'];
  const terms = entitlements.bookingTerms;
  const bookingsOf = (plan: StorePlan) => (plan === 'plus' ? terms?.plusIncluded : terms?.included);
  return (
    <div className="space-y-3" data-testid="store-plans">
      {failed ? (
        <p className="text-sm text-gray-500">{t('billing.plansUnavailable')}</p>
      ) : !offers ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin shrink-0" />
          {t('billing.loadingPlans')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => {
            const product = offers.plans[plan];
            if (!product) return null;
            const bookings = bookingsOf(plan);
            // Lightor+ in the free days: first charged at their end where the store can defer it (Play's trial), else from their last 3 days.
            const deferred = plan === 'plus' && inFreeDays && nativePlatform() === 'android' && hasFreeTrial(product);
            const opensAt = freeDaysEnd ? new Date(freeDaysEnd.getTime() - APPLE_PLUS_OPEN_DAYS * DAY_MS) : null;
            const locked = plan === 'plus' && inFreeDays && !deferred && !!opensAt && Date.now() < opensAt.getTime();
            const note = !inFreeDays
              ? null
              : plan === 'pro'
                ? t('billing.store.proPaysNow', { plan: PLAN_NAMES.pro })
                : deferred
                  ? t('billing.store.plusDeferred', { date: day(freeDaysEnd!) })
                  : locked
                    ? t('billing.store.plusLocked', { date: day(opensAt!), days: APPLE_PLUS_OPEN_DAYS })
                    : t('billing.store.plusPaysNow');
            return (
              <div key={plan} className="flex flex-col gap-2 rounded-2xl border border-gray-200 p-4 dark:border-slate-700" data-testid={`store-plan-${plan}`}>
                <p className="font-semibold text-gray-900 dark:text-white"><bdi>{PLAN_NAMES[plan]}</bdi></p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  <bdi>{product.priceString}</bdi>
                  <span className="ms-1 text-sm font-normal text-gray-500 dark:text-gray-400">{t('billing.store.perMonth')}</span>
                </p>
                {!leadsSite && bookings ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300">{t('billing.store.bookingsAMonth', { count: bookings })}</p>
                ) : null}
                {plan === 'plus' && inFreeDays && (
                  <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-300" data-testid="store-plus-current">
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    {t('billing.store.inFreeDays', { date: day(freeDaysEnd!) })}
                  </p>
                )}
                {note && <p className="text-xs leading-5 text-gray-600 dark:text-gray-300" data-testid={`store-note-${plan}`}>{note}</p>}
                <Button
                  className="mt-auto"
                  variant={plan === 'pro' ? 'primary' : 'outline'}
                  onClick={() => void run(plan, () => buyStoreProduct(userId, product), 'billing.activated')}
                  disabled={busy !== null || locked}
                  leftIcon={locked ? <Lock size={14} /> : undefined}
                  data-testid={`store-buy-${plan}`}
                >
                  {busy === plan
                    ? t('billing.opening')
                    : locked
                      ? t('billing.store.opensOnShort', { date: day(opensAt!) })
                      : t('billing.store.subscribe', { plan: PLAN_NAMES[plan] })}
                </Button>
              </div>
            );
          })}
        </div>
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
