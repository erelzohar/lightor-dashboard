import apiClient from './apiClient';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import globals from './globals';

/**
 * Paddle checkout for upgrading off the free tier (LT-004).
 *
 * The flow is deliberately one-directional: this module opens a checkout and
 * *nothing more*. The outcome travels Paddle → backend webhook → Mongo; the
 * dashboard never tells the backend "I paid", it only re-reads the user and
 * finds the subscription changed. A browser that lies gets nothing.
 */

let paddleInstance: Paddle | undefined;

// Paddle only accepts an eventCallback at initialisation, so completion is
// routed through this module-level slot — set per checkout, cleared on fire.
let pendingCompletedCallback: (() => void) | null = null;

export async function getPaddle(): Promise<Paddle | undefined> {
  if (paddleInstance) return paddleInstance;

  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
  if (!token) return undefined;

  const env = (import.meta.env.VITE_PADDLE_ENV as string | undefined) ?? 'sandbox';

  paddleInstance = await initializePaddle({
    environment: env === 'production' ? 'production' : 'sandbox',
    token,
    eventCallback(event) {
      if (event.name === 'checkout.completed' && pendingCompletedCallback) {
        pendingCompletedCallback();
        pendingCompletedCallback = null;
      }
    },
  });

  return paddleInstance;
}

export interface UpgradePlan {
  priceId: string;
  /** Pre-formatted by Paddle — currency, symbol and decimals included. */
  formatted: string;
  productName: string;
  interval?: string;
}

/**
 * Live prices for the configured plans; empty when Paddle is unreachable.
 * No trial is read off the price (LT-265): when the first charge comes is the
 * server's to say, per checkout — see `createCheckout`.
 */
export async function fetchUpgradePlans(): Promise<UpgradePlan[]> {
  const priceIds = [
    import.meta.env.VITE_PADDLE_PRICE_ID_BASIC as string | undefined,
    import.meta.env.VITE_PADDLE_PRICE_ID_ANNUAL as string | undefined,
  ].filter((id): id is string => Boolean(id));

  const paddle = await getPaddle();
  if (!paddle || priceIds.length === 0) return [];

  try {
    const response = await paddle.PricePreview({
      items: priceIds.map((priceId) => ({ priceId, quantity: 1 })),
    });

    return response.data.details.lineItems.map((li) => ({
      priceId: li.price.id,
      formatted: li.formattedUnitTotals.total,
      productName: li.product.name,
      interval: li.price.billingCycle?.interval,
    }));
  } catch {
    // "Price unknown" renders as unavailable; never substitute a number
    // Paddle would not actually charge.
    return [];
  }
}

// LT-009: the cookie authenticates; the Bearer is a pre-cookie shim (2027-02).
const paddlePost = (path: string, body: object = {}) => {
  const token = localStorage.getItem('lightor');
  return apiClient.post(
    `${globals.paddleUrl}${path}`,
    body,
    { withCredentials: true, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) }
  );
};

/** The transaction the server prepared for a checkout (LT-265). */
export interface CheckoutTransaction {
  transactionId: string;
  /** Days before the first charge: what is left of the free Plus period, 0 once it is over. */
  trialDays: number;
  /** When the first charge comes; null when it comes at checkout. */
  firstChargeAt: string | null;
}

/**
 * The server prepares each checkout's transaction (LT-265). It plants
 * custom_data.userId itself — the webhook, which receives events with no
 * session attached, knows whose subscription to activate by it — and while
 * the account's free Plus period lasts it puts the first charge at its end.
 * Throws the axios error when refused: 409 when the account already has a
 * subscription, 502/503 when Paddle or billing is unavailable.
 */
export async function createCheckout(priceId: string): Promise<CheckoutTransaction> {
  const response = await paddlePost('checkout', { priceId });
  const data = response.data?.data;
  if (!response.data?.success || !data?.transactionId) throw new Error('Checkout failed');
  return {
    transactionId: data.transactionId,
    trialDays: data.trialDays ?? 0,
    firstChargeAt: data.firstChargeAt ?? null,
  };
}

// The dashboard's languages that Paddle's checkout speaks. Hebrew is not one
// of them, so a Hebrew dashboard leaves the checkout's language to the browser.
const CHECKOUT_LOCALES = ['en', 'ar', 'fr', 'es'];

/**
 * Open the checkout overlay for one price, on a transaction the server
 * prepared. Null when Paddle.js is not set up in this build; a transaction
 * the server refuses throws (see `createCheckout`).
 */
export async function openUpgradeCheckout(opts: {
  priceId: string;
  email?: string;
  /** The dashboard's language — the checkout's too, when Paddle speaks it. */
  language?: string;
  /**
   * Fires when the buyer finishes Paddle's form — the earliest honest moment
   * for any "payment is processing" messaging. Opening the overlay proves
   * nothing; most opens are window-shopping.
   */
  onCompleted?: () => void;
}): Promise<CheckoutTransaction | null> {
  const paddle = await getPaddle();
  if (!paddle) return null;

  const transaction = await createCheckout(opts.priceId);
  const locale = opts.language?.split('-')[0];
  pendingCompletedCallback = opts.onCompleted ?? null;
  paddle.Checkout.open({
    transactionId: transaction.transactionId,
    ...(opts.email ? { customer: { email: opts.email } } : {}),
    ...(locale && CHECKOUT_LOCALES.includes(locale) ? { settings: { locale } } : {}),
  });
  return transaction;
}

/** Links into Paddle's customer portal — fresh and short-lived, never kept. */
export interface PortalLinks {
  overview: string;
  updatePaymentMethod?: string;
  cancel?: string;
}

/**
 * A new customer-portal session (LT-265): the payment method, invoices and
 * the subscription, on Paddle's own pages. Throws the axios error when
 * refused — 400 when Paddle has no customer for this account yet.
 */
export async function fetchPortalLinks(): Promise<PortalLinks> {
  const response = await paddlePost('portal');
  const data = response.data?.data;
  if (!response.data?.success || !data?.overview) throw new Error('Portal unavailable');
  return data as PortalLinks;
}

/**
 * Ask the backend to cancel the subscription at the end of the paid period
 * (LT-031). Same one-directional shape as the checkout: the server talks to
 * Paddle, Paddle answers through the webhook, and this client learns the new
 * state by re-reading /auth/me. The returned `activeUntil` is display data
 * for the confirmation toast only.
 */
export async function cancelSubscription(): Promise<{ activeUntil: string | null }> {
  const response = await paddlePost('subscription/cancel');
  if (!response.data?.success) throw new Error('Cancellation failed');
  return { activeUntil: response.data.data?.activeUntil ?? null };
}

/**
 * Undo a scheduled cancellation while the plan is still active. A 409 means
 * the subscription already ended — the caller should send the user to a
 * fresh checkout instead.
 */
export async function resumeSubscription(): Promise<void> {
  const response = await paddlePost('subscription/resume');
  if (!response.data?.success) throw new Error('Resume failed');
}
