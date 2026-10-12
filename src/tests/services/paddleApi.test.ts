import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializePaddle } from '@paddle/paddle-js';
import apiClient from '../../services/apiClient';
import globals from '../../services/globals';
import { fetchPortalLinks, openUpgradeCheckout } from '../../services/paddleApi';

const paddle = vi.hoisted(() => ({ Checkout: { open: vi.fn() }, PricePreview: vi.fn() }));
vi.mock('@paddle/paddle-js', () => ({ initializePaddle: vi.fn(async () => paddle) }));

const transaction = { transactionId: 'txn_01', trialDays: 41, firstChargeAt: '2026-11-23T10:00:00.000Z' };
const answered = (data: unknown) => ({ data: { success: true, data } }) as never;

beforeEach(() => {
  vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', 'test_token');
  paddle.Checkout.open.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/**
 * The checkout (LT-265): the server prepares the transaction — whose it is,
 * and when its first charge comes — and Paddle.js opens on it. The browser
 * no longer says whose subscription it is.
 */
describe('openUpgradeCheckout', () => {
  it('asks the server for the transaction, then opens Paddle on it', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(answered(transaction));

    const result = await openUpgradeCheckout({ priceId: 'pri_month', email: 'owner@biz.co', language: 'fr' });

    expect(post).toHaveBeenCalledWith(
      `${globals.paddleUrl}checkout`,
      { priceId: 'pri_month' },
      expect.objectContaining({ withCredentials: true })
    );
    expect(paddle.Checkout.open).toHaveBeenCalledWith({
      transactionId: 'txn_01',
      customer: { email: 'owner@biz.co' },
      settings: { locale: 'fr' },
    });
    expect(paddle.Checkout.open.mock.calls[0][0]).not.toHaveProperty('customData');
    expect(post.mock.invocationCallOrder[0]).toBeLessThan(paddle.Checkout.open.mock.invocationCallOrder[0]);
    expect(result).toEqual(transaction);
  });

  it('leaves the language to the browser for Hebrew, which Paddle does not speak', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue(answered(transaction));

    await openUpgradeCheckout({ priceId: 'pri_month', email: 'owner@biz.co', language: 'he' });

    expect(paddle.Checkout.open).toHaveBeenCalledWith({ transactionId: 'txn_01', customer: { email: 'owner@biz.co' } });
  });

  it('opens nothing when the server refuses the checkout', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(Object.assign(new Error('Conflict'), { response: { status: 409 } }));

    await expect(openUpgradeCheckout({ priceId: 'pri_month' })).rejects.toMatchObject({ response: { status: 409 } });
    expect(paddle.Checkout.open).not.toHaveBeenCalled();
  });

  it('asks the server nothing when Paddle.js is not set up in this build', async () => {
    vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', '');
    // A fresh module: the one above keeps the Paddle instance it made.
    vi.resetModules();
    const { default: freshClient } = await import('../../services/apiClient');
    const fresh = await import('../../services/paddleApi');
    const post = vi.spyOn(freshClient, 'post');

    await expect(fresh.openUpgradeCheckout({ priceId: 'pri_month' })).resolves.toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('still reports a completed checkout, for the page to wait for the webhook', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue(answered(transaction));
    const onCompleted = vi.fn();

    await openUpgradeCheckout({ priceId: 'pri_month', onCompleted });
    const { eventCallback } = vi.mocked(initializePaddle).mock.calls[0][0] as { eventCallback: (e: { name: string }) => void };
    eventCallback({ name: 'checkout.loaded' });
    expect(onCompleted).not.toHaveBeenCalled();
    eventCallback({ name: 'checkout.completed' });
    expect(onCompleted).toHaveBeenCalledTimes(1);
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
