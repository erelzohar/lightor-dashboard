import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializePaddle } from '@paddle/paddle-js';
import apiClient from '../../services/apiClient';
import globals from '../../services/globals';
import { closeCheckout, createCheckout, fetchPortalLinks, fetchUpgradePlans, onCheckoutEvent, openInlineCheckout } from '../../services/paddleApi';

const paddle = vi.hoisted(() => ({ Checkout: { open: vi.fn(), close: vi.fn() }, PricePreview: vi.fn() }));
vi.mock('@paddle/paddle-js', () => ({ initializePaddle: vi.fn(async () => paddle) }));

const transaction = { transactionId: 'txn_01', trialDays: 41, firstChargeAt: '2026-11-23T10:00:00.000Z' };
const answered = (data: unknown) => ({ data: { success: true, data } }) as never;

beforeEach(() => {
  vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', 'test_token');
  paddle.Checkout.open.mockClear();
  paddle.Checkout.close.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/**
 * The checkout (LT-265): the server prepares the transaction — whose it is,
 * and when its first charge comes. The browser no longer says whose
 * subscription it is.
 */
describe('createCheckout', () => {
  it('asks the server for the transaction of a price', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(answered(transaction));
    await expect(createCheckout('pri_month')).resolves.toEqual(transaction);
    expect(post).toHaveBeenCalledWith(
      `${globals.paddleUrl}checkout`,
      { priceId: 'pri_month' },
      expect.objectContaining({ withCredentials: true })
    );
  });

  it('throws the refusal through (409: subscribed already)', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(Object.assign(new Error('Conflict'), { response: { status: 409 } }));
    await expect(createCheckout('pri_month')).rejects.toMatchObject({ response: { status: 409 } });
  });
});

/**
 * LT-303 — the checkout drawn inside the account page, in Paddle's express
 * design (the one-tap ways to pay first, the card under "pay another way").
 */
describe('openInlineCheckout', () => {
  const frame = { frameTarget: 'paddle-checkout-frame', theme: 'dark' as const };

  it('draws the express checkout into the page, for the owner, in the dashboard language', async () => {
    await expect(
      openInlineCheckout({ transactionId: 'txn_01', email: 'owner@biz.co', language: 'fr', ...frame })
    ).resolves.toBe(true);
    expect(paddle.Checkout.open).toHaveBeenCalledWith({
      transactionId: 'txn_01',
      customer: { email: 'owner@biz.co' },
      settings: expect.objectContaining({
        displayMode: 'inline',
        variant: 'express',
        frameTarget: 'paddle-checkout-frame',
        theme: 'dark',
        locale: 'fr',
      }),
    });
    expect(paddle.Checkout.open.mock.calls[0][0]).not.toHaveProperty('customData');
  });

  it('leaves the language to the browser for Hebrew, which Paddle does not speak', async () => {
    await openInlineCheckout({ transactionId: 'txn_01', language: 'he', ...frame });
    expect(paddle.Checkout.open.mock.calls[0][0].settings).not.toHaveProperty('locale');
  });

  it('reports a completed checkout and hands every event to its listeners', async () => {
    const onCompleted = vi.fn();
    const heard = vi.fn();
    const off = onCheckoutEvent(heard);
    await openInlineCheckout({ transactionId: 'txn_01', onCompleted, ...frame });
    const { eventCallback } = vi.mocked(initializePaddle).mock.calls[0][0] as { eventCallback: (e: { name: string }) => void };

    eventCallback({ name: 'checkout.loaded' });
    expect(onCompleted).not.toHaveBeenCalled();
    eventCallback({ name: 'checkout.completed' });
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls.map(([e]) => e.name)).toEqual(['checkout.loaded', 'checkout.completed']);

    off();
    eventCallback({ name: 'checkout.updated' });
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('closes the checkout and forgets its completion', async () => {
    const onCompleted = vi.fn();
    await openInlineCheckout({ transactionId: 'txn_01', onCompleted, ...frame });
    closeCheckout();
    expect(paddle.Checkout.close).toHaveBeenCalledTimes(1);
    const { eventCallback } = vi.mocked(initializePaddle).mock.calls[0][0] as { eventCallback: (e: { name: string }) => void };
    eventCallback({ name: 'checkout.completed' });
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('draws nothing when Paddle.js is not set up in this build', async () => {
    vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', '');
    // A fresh module: the one above keeps the Paddle instance it made.
    vi.resetModules();
    const fresh = await import('../../services/paddleApi');
    await expect(fresh.openInlineCheckout({ transactionId: 'txn_01', ...frame })).resolves.toBe(false);
  });
});

/** Paddle's customer portal (LT-265): a fresh session from the server per visit. */
describe('fetchPortalLinks', () => {
  it('asks the server for a portal session', async () => {
    const links = { overview: 'https://customer-portal.paddle.com/cpl_1', updatePaymentMethod: 'https://customer-portal.paddle.com/cpl_1/pm' };
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(answered(links));

    await expect(fetchPortalLinks()).resolves.toEqual(links);
    expect(post).toHaveBeenCalledWith(`${globals.paddleUrl}portal`, {}, expect.objectContaining({ withCredentials: true }));
  });

  it('throws the refusal through (400: no Paddle customer yet)', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(Object.assign(new Error('Bad Request'), { response: { status: 400 } }));

    await expect(fetchPortalLinks()).rejects.toMatchObject({ response: { status: 400 } });
  });
});

/**
 * LT-695: a business outside Israel is shown, and sold, its own country's
 * price: Paddle is asked for that country, wherever the owner's browser is.
 */
describe('prices and the checkout for a country (LT-695)', () => {
  const frame = { frameTarget: 'paddle-checkout-frame', theme: 'light' as const };
  const preview = (currencyCode: string, total: string, formatted: string) => ({
    data: {
      currencyCode,
      details: {
        lineItems: [
          { price: { id: 'pri_pro_m', billingCycle: { interval: 'month' } }, product: { name: 'Pro' }, unitTotals: { total }, formattedUnitTotals: { total: formatted } },
        ],
      },
    },
  });

  beforeEach(() => {
    vi.stubEnv('VITE_PADDLE_PRICE_ID_BASIC', 'pri_pro_m');
    paddle.PricePreview.mockReset();
  });

  it('asks for the United States price, and reports it in dollars', async () => {
    paddle.PricePreview.mockResolvedValue(preview('USD', '4900', '$49.00'));
    const plans = await fetchUpgradePlans('US');
    expect(paddle.PricePreview).toHaveBeenCalledWith(expect.objectContaining({ address: { countryCode: 'US' } }));
    expect(plans).toEqual([expect.objectContaining({ plan: 'pro', priceId: 'pri_pro_m', formatted: '$49.00', amount: 49, currency: 'USD', interval: 'month' })]);
  });

  it('names no country when none is given: Paddle goes by the browser, as before', async () => {
    paddle.PricePreview.mockResolvedValue(preview('ILS', '11900', '₪119.00'));
    await fetchUpgradePlans();
    await fetchUpgradePlans(null);
    for (const [request] of paddle.PricePreview.mock.calls) expect(request).not.toHaveProperty('address');
  });

  it('opens the checkout on the country, beside the owner`s email', async () => {
    await openInlineCheckout({ transactionId: 'txn_01', email: 'owner@biz.co', country: 'US', ...frame });
    expect(paddle.Checkout.open.mock.calls[0][0].customer).toEqual({ email: 'owner@biz.co', address: { countryCode: 'US' } });
  });

  it('leaves the customer as it was with no country, and sends no country without an email', async () => {
    await openInlineCheckout({ transactionId: 'txn_01', email: 'owner@biz.co', country: null, ...frame });
    expect(paddle.Checkout.open.mock.calls[0][0].customer).toEqual({ email: 'owner@biz.co' });
    await openInlineCheckout({ transactionId: 'txn_01', country: 'US', ...frame });
    expect(paddle.Checkout.open.mock.calls[1][0]).not.toHaveProperty('customer');
  });
});
