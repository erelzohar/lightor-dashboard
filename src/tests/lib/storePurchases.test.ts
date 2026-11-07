import { describe, it, expect, vi } from 'vitest';

const getProducts = vi.hoisted(() => vi.fn());
vi.mock('@revenuecat/purchases-capacitor', () => ({
  PRODUCT_CATEGORY: { SUBSCRIPTION: 'SUBSCRIPTION', NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' },
  // A Capacitor plugin answers every name, `then` too: a promise resolved with it never settles (LT-604).
  Purchases: { configure: vi.fn(async () => {}), logIn: vi.fn(async () => {}), getProducts, then: () => new Promise(() => {}) },
}));
vi.mock('../../lib/platform', () => ({ isNativeApp: () => true, nativePlatform: () => 'android' }));

import { intervalOf, loadStoreOffers, offerFor } from '../../lib/storePurchases';

const product = (identifier: string, subscriptionPeriod: string | null) => ({ identifier, subscriptionPeriod }) as never;

/** LT-602: the plans' monthly and yearly products, told apart by the store's own period. */
describe('the store offers (LT-602)', () => {
  it('reads a year from P1Y or P12M, and a month otherwise', () => {
    expect(intervalOf(product('a', 'P1Y'))).toBe('year');
    expect(intervalOf(product('a', 'P12M'))).toBe('year');
    expect(intervalOf(product('a', 'P1M'))).toBe('month');
    expect(intervalOf(product('a', null))).toBe('month');
  });

  it('files each product under its plan and period, the first one for each (and settles, though the plugin answers `then`)', async () => {
    getProducts.mockImplementation(async ({ type }: { type: string }) => ({
      products: type === 'SUBSCRIPTION'
        ? [product('plus:monthly', 'P1M'), product('plus_y:yearly', 'P1Y'), product('pro:monthly', 'P1M'), product('pro_y:yearly', 'P1Y'), product('pro_other', 'P1M'), product('stray', 'P1M')]
        : [product('pack_100', null)],
    }));
    const offers = await loadStoreOffers('u1', { plus: ['plus', 'plus_y'], pro: ['pro', 'pro_y', 'pro_other'], bookingPack: ['pack_100'] });
    expect(offers.plans.map((o) => `${o.plan}/${o.interval}/${o.product.identifier}`)).toEqual([
      'plus/month/plus:monthly', 'plus/year/plus_y:yearly', 'pro/month/pro:monthly', 'pro/year/pro_y:yearly',
    ]);
    expect(offerFor(offers, 'pro', 'year')?.identifier).toBe('pro_y:yearly');
    expect(offers.pack?.identifier).toBe('pack_100');
  });
});
