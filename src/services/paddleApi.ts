import axios from 'axios';
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
  /** Only set when Paddle actually grants a trial on this price. */
  trialDays?: number;
}

const DAYS_PER_INTERVAL: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

/** Live prices for the configured plans; empty when Paddle is unreachable. */
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

    return response.data.details.lineItems.map((li) => {
      const trial = li.price.trialPeriod;
      return {
        priceId: li.price.id,
        formatted: li.formattedUnitTotals.total,
        productName: li.product.name,
        interval: li.price.billingCycle?.interval,
        // Undefined when Paddle has no trial on this price — never invent one.
        trialDays: trial ? trial.frequency * (DAYS_PER_INTERVAL[trial.interval] ?? 1) : undefined,
      };
    });
  } catch {
    // "Price unknown" renders as unavailable; never substitute a number
    // Paddle would not actually charge.
    return [];
  }
}

/**
 * Open the checkout overlay for one price.
 *
 * `userId` rides along as customData — it is how the webhook, which receives
 * events with no session attached, knows whose subscription to activate.
 */
export async function openUpgradeCheckout(opts: {
  priceId: string;
  userId: string;
  email?: string;
  /**
   * Fires when the buyer finishes Paddle's form — the earliest honest moment
   * for any "payment is processing" messaging. Opening the overlay proves
   * nothing; most opens are window-shopping.
   */
  onCompleted?: () => void;
}): Promise<boolean> {
  const paddle = await getPaddle();
  if (!paddle) return false;

  pendingCompletedCallback = opts.onCompleted ?? null;
  paddle.Checkout.open({
    items: [{ priceId: opts.priceId, quantity: 1 }],
    ...(opts.email ? { customer: { email: opts.email } } : {}),
    customData: { userId: opts.userId },
  });
  return true;
}

/**
 * Ask the backend to cancel the subscription at the end of the paid period
 * (LT-031). Same one-directional shape as the checkout: the server talks to
 * Paddle, Paddle answers through the webhook, and this client learns the new
 * state by re-reading /auth/me. The returned `activeUntil` is display data
 * for the confirmation toast only.
 */
export async function cancelSubscription(): Promise<{ activeUntil: string | null }> {
  // LT-009: the cookie authenticates; the Bearer is a pre-cookie shim (2027-02).
  const token = localStorage.getItem('lightor');
  const response = await axios.post(
    `${globals.paddleUrl}subscription/cancel`,
    {},
    { withCredentials: true, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) }
  );
  if (!response.data?.success) throw new Error('Cancellation failed');
  return { activeUntil: response.data.data?.activeUntil ?? null };
}

/**
 * Undo a scheduled cancellation while the plan is still active. A 409 means
 * the subscription already ended — the caller should send the user to a
 * fresh checkout instead.
 */
export async function resumeSubscription(): Promise<void> {
  // LT-009: the cookie authenticates; the Bearer is a pre-cookie shim (2027-02).
  const token = localStorage.getItem('lightor');
  const response = await axios.post(
    `${globals.paddleUrl}subscription/resume`,
    {},
    { withCredentials: true, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) }
  );
  if (!response.data?.success) throw new Error('Resume failed');
}
