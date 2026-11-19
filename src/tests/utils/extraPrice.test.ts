import { describe, it, expect } from 'vitest';
import { checkoutCountry, meterExtraPrice, offerExtraPrice } from '../../utils/extraPrice';
import type { BookingsMeter } from '../../services/entitlementsApi';

const meter = (b: Partial<BookingsMeter>): BookingsMeter => ({
  kind: 'plus', used: 0, included: 500, periodStart: '2026-10-05T10:00:00.000Z', periodEnd: '2026-11-05T10:00:00.000Z',
  extraAgorot: null, ...b,
});

/** LT-695: an extra booking's price follows the currency it is charged in. */
describe('extra booking price (LT-695)', () => {
  it('a subscriber`s price is the subscription`s own', () => {
    expect(meterExtraPrice(meter({ extraPrice: { amount: 17, currency: 'USD', floor: 300 } }))).toEqual({ amount: 17, currency: 'USD', floor: 300 });
    expect(meterExtraPrice(meter({ extraAgorot: 35, extraPrice: { amount: 35, currency: 'ILS', floor: 1000 } }))).toEqual({ amount: 35, currency: 'ILS', floor: 1000 });
  });

  it('a server of before sends agorot only: shekels, with the ₪10 floor', () => {
    expect(meterExtraPrice(meter({ extraAgorot: 35 }))).toEqual({ amount: 35, currency: 'ILS', floor: 1000 });
  });

  it('no price where the server names none', () => {
    expect(meterExtraPrice(meter({ extraAgorot: null, extraPrice: null }))).toBeNull();
    expect(meterExtraPrice(meter({ extraAgorot: null }))).toBeNull();
    expect(meterExtraPrice(null)).toBeNull();
  });

  it('beside the plans: the price in the currency the plans are shown in', () => {
    const terms = { included: 500, extraAgorot: 35, extraPrices: { ILS: 35, USD: 17 } };
    expect(offerExtraPrice(terms, 'USD')).toEqual({ amount: 17, currency: 'USD' });
    expect(offerExtraPrice(terms, 'ILS')).toEqual({ amount: 35, currency: 'ILS' });
    expect(offerExtraPrice(terms, null)).toEqual({ amount: 35, currency: 'ILS' });
  });

  it('never a shekel price beside another currency', () => {
    expect(offerExtraPrice({ included: 500, extraAgorot: 35, extraPrices: { ILS: 35 } }, 'USD')).toBeNull();
    expect(offerExtraPrice({ included: 500, extraAgorot: 35 }, 'USD')).toBeNull();
    expect(offerExtraPrice({ included: 500, extraAgorot: 35, extraPrices: { ILS: 35, USD: 17 } }, 'EUR')).toBeNull();
  });

  it('a server of before names the shekel price only', () => {
    expect(offerExtraPrice({ included: 500, extraAgorot: 35 }, 'ILS')).toEqual({ amount: 35, currency: 'ILS' });
  });

  it('nothing while the charge is off', () => {
    expect(offerExtraPrice({ included: 500, extraAgorot: null, extraPrices: null }, 'ILS')).toBeNull();
    expect(offerExtraPrice(undefined, 'ILS')).toBeNull();
  });

  it('the checkout`s country is the business`s own only outside Israel', () => {
    expect(checkoutCountry('US')).toBe('US');
    expect(checkoutCountry('IL')).toBeNull();
    expect(checkoutCountry(null)).toBeNull();
    expect(checkoutCountry(undefined)).toBeNull();
  });
});
