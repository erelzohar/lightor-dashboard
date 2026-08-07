import { initializePaddle, type Paddle } from '@paddle/paddle-js';

/**
 * Paddle checkout for upgrading off the free tier (LT-004).
 *
 * The flow is deliberately one-directional: this module opens a checkout and
 * *nothing more*. The outcome travels Paddle → backend webhook → Mongo; the
 * dashboard never tells the backend "I paid", it only re-reads the user and
 * finds the subscription changed. A browser that lies gets nothing.
 */

let paddleInstance: Paddle | undefined;

export async function getPaddle(): Promise<Paddle | undefined> {
  if (paddleInstance) return paddleInstance;

  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
  if (!token) return undefined;

  const env = (import.meta.env.VITE_PADDLE_ENV as string | undefined) ?? 'sandbox';

  paddleInstance = await initializePaddle({
    environment: env === 'production' ? 'production' : 'sandbox',
    token,
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
}): Promise<boolean> {
  const paddle = await getPaddle();
  if (!paddle) return false;

  paddle.Checkout.open({
    items: [{ priceId: opts.priceId, quantity: 1 }],
    ...(opts.email ? { customer: { email: opts.email } } : {}),
    customData: { userId: opts.userId },
  });
  return true;
}
