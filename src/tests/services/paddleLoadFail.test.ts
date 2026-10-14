import { describe, it, expect, vi, afterEach } from 'vitest';
import { initializePaddle } from '@paddle/paddle-js';

/**
 * LT-315 (M6) — Paddle.js failing to load (an ad blocker, the network, the
 * CDN) rejects initializePaddle. getPaddle answers "no Paddle" then, so
 * every caller shows its unavailable state, and the next call tries again.
 */
const paddle = vi.hoisted(() => ({ Checkout: { open: vi.fn(), close: vi.fn() }, PricePreview: vi.fn() }));
vi.mock('@paddle/paddle-js', () => ({ initializePaddle: vi.fn() }));

afterEach(() => vi.unstubAllEnvs());

describe('getPaddle when Paddle.js does not load', () => {
  it('answers undefined, so the plans read as unavailable, and retries next time', async () => {
    vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', 'test_token');
    vi.stubEnv('VITE_PADDLE_PRICE_ID_BASIC', 'pri_month');
    vi.mocked(initializePaddle).mockRejectedValueOnce(new Error('Failed to load Paddle.js'));
    const { getPaddle, fetchUpgradePlans, openInlineCheckout } = await import('../../services/paddleApi');

    await expect(fetchUpgradePlans()).resolves.toEqual([]);
    await expect(openInlineCheckout({ transactionId: 't', frameTarget: 'f', theme: 'light' })).resolves.toBe(false);

    vi.mocked(initializePaddle).mockResolvedValue(paddle as never);
    await expect(getPaddle()).resolves.toBe(paddle);
  });
});
