import type { BookingsMeter, MyEntitlements } from '../services/entitlementsApi';

/**
 * LT-695: what one extra booking costs, in whole minor units (agorot, cents)
 * of its currency, and the smallest total charged (a smaller one rides on to
 * the next month). A business in the United States pays in dollars; the
 * amounts are the server's, never this app's.
 */
export interface ExtraPrice {
  amount: number;
  currency: string;
  floor?: number;
}

/** A shekel total under ₪10 rides on; said by a server from before LT-695, which sent no floor. */
const SHEKEL_FLOOR = 1000;

/**
 * A subscriber's own price: the subscription's currency decides it. An older
 * server sends only `extraAgorot`, which is shekels.
 */
export const meterExtraPrice = (bookings: BookingsMeter | null | undefined): ExtraPrice | null => {
  if (!bookings) return null;
  if (bookings.extraPrice) return bookings.extraPrice;
  if (bookings.extraPrice === undefined && bookings.extraAgorot != null) {
    return { amount: bookings.extraAgorot, currency: 'ILS', floor: SHEKEL_FLOOR };
  }
  return null;
};

/**
 * The price beside the plans on offer: the one in the currency the plans'
 * own prices are shown in, so the two never disagree. With no plan prices to
 * go by (the app, Paddle away) the offer is in shekels, as it always was. A
 * currency with no price gives null: extra bookings are not sold in it.
 */
export const offerExtraPrice = (
  terms: MyEntitlements['bookingTerms'] | null | undefined,
  plansCurrency: string | null | undefined
): ExtraPrice | null => {
  if (!terms || terms.extraAgorot == null) return null;
  const currency = plansCurrency || 'ILS';
  if (terms.extraPrices) {
    const amount = terms.extraPrices[currency];
    return typeof amount === 'number' ? { amount, currency } : null;
  }
  return currency === 'ILS' ? { amount: terms.extraAgorot, currency: 'ILS' } : null;
};

/**
 * LT-695: the country the plans' prices are asked for: the business's own
 * when it is outside Israel (the server sells that business the same
 * country's price). An Israeli business, or one with no business phone yet,
 * names none, and Paddle goes by where the browser is, exactly as before.
 */
export const checkoutCountry = (billingCountry: string | null | undefined): string | null =>
  billingCountry && billingCountry !== 'IL' ? billingCountry : null;
