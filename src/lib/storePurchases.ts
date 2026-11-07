import type { PurchasesStoreProduct } from '@revenuecat/purchases-capacitor';
import apiClient from '../services/apiClient';
import globals from '../services/globals';
import { isNativeApp, nativePlatform } from './platform';

/**
 * LT-580 (Erel 2026-11-05): the plans and booking packs on sale in the apps,
 * through the App Store and Google Play, with RevenueCat between the stores
 * and the server. The app never tells the server what was bought: after a
 * purchase or a restore it asks the server to read RevenueCat
 * (`/api/store/sync`), and the account changes when the server says so.
 *
 * On only in the apps, with VITE_STORE_PURCHASES=true and the platform's
 * public RevenueCat key (VITE_REVENUECAT_IOS_KEY / _ANDROID_KEY). The web
 * never loads the plugin: it sells through Paddle.
 */

const keyFor = (): string => {
  const platform = nativePlatform();
  const env = import.meta.env as Record<string, string | undefined>;
  return (platform === 'ios' ? env.VITE_REVENUECAT_IOS_KEY : platform === 'android' ? env.VITE_REVENUECAT_ANDROID_KEY : '') ?? '';
};

export const storeSalesOn = (): boolean =>
  isNativeApp() && (import.meta.env as Record<string, string | undefined>).VITE_STORE_PURCHASES === 'true' && !!keyFor();

const plugin = () => import('@revenuecat/purchases-capacitor');

let configuredFor: string | null = null;

/**
 * RevenueCat knows the owner by our user id, so the webhook names them.
 *
 * LT-604: the plugin comes back wrapped (`{ Purchases }`), never on its own
 * from an async function: a Capacitor plugin is a proxy that answers every
 * name, so resolving a promise with it calls `Purchases.then()`, which the
 * native side refuses, and the promise never settles ("loading plans" for
 * ever on the iPhone).
 */
const ready = async (userId: string): Promise<{ Purchases: (typeof import('@revenuecat/purchases-capacitor'))['Purchases'] }> => {
  const { Purchases } = await plugin();
  if (configuredFor === null) {
    await Purchases.configure({ apiKey: keyFor(), appUserID: userId });
  } else if (configuredFor !== userId) {
    await Purchases.logIn({ appUserID: userId });
  }
  configuredFor = userId;
  return { Purchases };
};

export type StorePlan = 'plus' | 'pro';
export type StoreInterval = 'month' | 'year';

/** One plan's product in the store, monthly or yearly (LT-602). */
export interface StoreOffer {
  plan: StorePlan;
  interval: StoreInterval;
  product: PurchasesStoreProduct;
}

export interface StoreOffers {
  plans: StoreOffer[];
  pack: PurchasesStoreProduct | null;
}

/** A Google subscription answers as "id:base-plan": the id is before the colon. */
const sameProduct = (product: PurchasesStoreProduct, ids: string[]): boolean =>
  ids.includes(product.identifier) || ids.includes(product.identifier.split(':')[0]);

/** The store's period, ISO 8601: a year ("P1Y", "P12M"), else a month. */
export const intervalOf = (product: PurchasesStoreProduct): StoreInterval => {
  const period = (product.subscriptionPeriod ?? '').toUpperCase();
  return period === 'P1Y' || period === 'P12M' ? 'year' : 'month';
};

/** The plan's product for an interval, if the store sells one. */
export const offerFor = (offers: StoreOffers | null, plan: StorePlan, interval: StoreInterval): PurchasesStoreProduct | undefined =>
  offers?.plans.find((offer) => offer.plan === plan && offer.interval === interval)?.product;

/** The store's own products for the plans and the pack, with its prices in the owner's money. */
export const loadStoreOffers = async (
  userId: string,
  products: { plus: string[]; pro: string[]; bookingPack: string[] }
): Promise<StoreOffers> => {
  const { Purchases } = await ready(userId);
  const { PRODUCT_CATEGORY } = await plugin();
  const subscriptionIds = [...products.plus, ...products.pro];
  const [subs, packs] = await Promise.all([
    subscriptionIds.length ? Purchases.getProducts({ productIdentifiers: subscriptionIds, type: PRODUCT_CATEGORY.SUBSCRIPTION }) : { products: [] },
    products.bookingPack.length ? Purchases.getProducts({ productIdentifiers: products.bookingPack, type: PRODUCT_CATEGORY.NON_SUBSCRIPTION }) : { products: [] },
  ]);
  const plans: StoreOffer[] = [];
  for (const product of subs.products) {
    const plan: StorePlan | null = sameProduct(product, products.pro) ? 'pro' : sameProduct(product, products.plus) ? 'plus' : null;
    const interval = intervalOf(product);
    // One product a plan and interval: the first the store answers with.
    if (plan && !plans.some((offer) => offer.plan === plan && offer.interval === interval)) plans.push({ plan, interval, product });
  }
  return { plans, pack: packs.products.find((p) => sameProduct(p, products.bookingPack)) ?? null };
};

/** The server reads RevenueCat and writes the account; the app waits for it. */
export const syncStore = async (): Promise<void> => {
  await apiClient.post(`${globals.storeUrl}sync`, {}, { withCredentials: true });
};

export type PurchaseOutcome = 'done' | 'cancelled';

/** Google Play: a free trial the owner can take with this product (Play offers only the trials one is eligible for). */
export const hasFreeTrial = (product: PurchasesStoreProduct | undefined): boolean => !!product?.defaultOption?.freePhase;

/**
 * Buys a product. `replacing` is the store product id of the subscription it
 * takes the place of (Lightor+ up to Pro): on Google Play the old one is
 * named and Pro is charged in full today (LT-589, also inside a free trial);
 * on the App Store all the plans are in one subscription group, so the store
 * itself makes it an upgrade.
 */
export const buyStoreProduct = async (userId: string, product: PurchasesStoreProduct, replacing?: string): Promise<PurchaseOutcome> => {
  const { Purchases } = await ready(userId);
  try {
    if (replacing && nativePlatform() === 'android') {
      const { STORE_REPLACEMENT_MODE } = await plugin();
      await Purchases.purchaseStoreProduct({
        product,
        storeProductChangeInfo: { oldProductIdentifier: replacing.split(':')[0], replacementMode: STORE_REPLACEMENT_MODE.CHARGE_FULL_PRICE },
      });
    } else {
      await Purchases.purchaseStoreProduct({ product });
    }
  } catch (error) {
    if ((error as { userCancelled?: boolean | null })?.userCancelled) return 'cancelled';
    throw error;
  }
  await syncStore();
  return 'done';
};

/** "Restore purchases" (App Store rule 3.1.1): the store's purchases of this Apple ID / Google account back on the account. */
export const restoreStore = async (userId: string): Promise<void> => {
  const { Purchases } = await ready(userId);
  await Purchases.restorePurchases();
  await syncStore();
};

/** Where the owner changes or cancels a store subscription: the store's own page. */
export const manageStoreUrl = async (userId: string): Promise<string> => {
  const { Purchases } = await ready(userId);
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo.managementURL
    ?? (nativePlatform() === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions');
};
