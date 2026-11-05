import React, { useEffect, useState } from 'react';
import { Loader2, Package, RotateCcw, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import type { MyEntitlements } from '../../services/entitlementsApi';
import { PLAN_NAMES } from '../../services/paddleApi';
import { nativePlatform } from '../../lib/platform';
import {
  buyStoreProduct,
  loadStoreOffers,
  manageStoreUrl,
  restoreStore,
  type StoreOffers,
  type StorePlan,
} from '../../lib/storePurchases';

const TERMS_URL = 'https://lightor.app/terms.html';
const PRIVACY_URL = 'https://lightor.app/privacy.html';

/**
 * LT-580: the Account page's store in the apps - the plans for an owner who
 * has none (from the free days' last week, as their upgrade opens, since a
 * store subscription is charged at once), and for a subscription the store
 * bills: managing it in the store, restoring purchases, and the booking packs
 * (100 bookings, never expiring) that take the extra bookings' place.
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
  const opensAt = pilot?.upgradeFrom ? new Date(pilot.upgradeFrom) : null;
  const notYet = !subscribed && !!opensAt && opensAt.getTime() > Date.now();
  const storeName = t(nativePlatform() === 'android' ? 'billing.store.googlePlay' : 'billing.store.appStore');
  const dateLocale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';

  useEffect(() => {
    if (!store || !userId || notYet) return;
    let live = true;
    loadStoreOffers(userId, store.products)
      .then((found) => { if (live) setOffers(found); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [store, userId, notYet]);

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

  if (notYet) {
    return (
      <div className="space-y-2" data-testid="store-not-yet">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('billing.store.opensOn', { date: opensAt!.toLocaleDateString(dateLocale) })}</p>
        {restore}
      </div>
    );
  }

  if (subscribed) {
    const packs = entitlements.bookings?.packs;
    const pack = offers?.pack;
    return (
      <div className="space-y-3" data-testid="store-subscribed">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('billing.store.billedBy', { store: storeName })}</p>
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
                <Button
                  className="mt-auto"
                  variant={plan === 'pro' ? 'primary' : 'outline'}
                  onClick={() => void run(plan, () => buyStoreProduct(userId, product), 'billing.activated')}
                  disabled={busy !== null}
                  data-testid={`store-buy-${plan}`}
                >
                  {busy === plan ? t('billing.opening') : t('billing.store.subscribe', { plan: PLAN_NAMES[plan] })}
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
