import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosInstance, AxiosResponse } from 'axios';

const toastMock = vi.hoisted(() => vi.fn());
vi.mock('react-hot-toast', () => ({ default: toastMock }));
vi.mock('i18next', () => ({ default: { t: (key: string) => key } }));

import { installCustomerTextsNotice, untoldReason } from '../../services/customerTextsNotice';

// Captures the success handler passed to interceptors.response.use.
function mockInstance() {
  let onFulfilled: ((r: AxiosResponse) => unknown) | undefined;
  const instance = {
    interceptors: { response: { use: (ok: (r: AxiosResponse) => unknown) => { onFulfilled = ok; } } },
  } as unknown as AxiosInstance;
  return { instance, answer: (data: unknown) => onFulfilled!({ data } as AxiosResponse) };
}

/**
 * LT-464: the owner's changes text customers from one daily budget, and none
 * while the payment has failed; a change saved without a text tells the owner.
 */
describe('customerTextsNotice', () => {
  beforeEach(() => toastMock.mockClear());

  it('reads why a customer was not told', () => {
    expect(untoldReason({ customerNotified: false, notNotifiedReason: 'dailyTexts' })).toBe('dailyTexts');
    expect(untoldReason({ customerNotified: false, notNotifiedReason: 'paymentFailed' })).toBe('paymentFailed');
    expect(untoldReason({ customersNotNotified: ['a'], notNotifiedReason: 'dailyTexts' })).toBe('dailyTexts');
    expect(untoldReason({ customerNotified: false })).toBe('dailyTexts');
    expect(untoldReason({ success: true, data: {} })).toBeNull();
    expect(untoldReason({ customersNotNotified: [] })).toBeNull();
    expect(untoldReason(undefined)).toBeNull();
  });

  it('shows one notice for an untold change and passes the response on', () => {
    const { instance, answer } = mockInstance();
    installCustomerTextsNotice(instance);

    const data = { success: true, customerNotified: false, notNotifiedReason: 'paymentFailed' };
    expect(answer(data)).toEqual({ data });
    expect(toastMock).toHaveBeenCalledWith('appointments.notNotified.paymentFailed', expect.objectContaining({ id: 'customer-not-notified' }));

    answer({ success: true });
    expect(toastMock).toHaveBeenCalledTimes(1);
  });
});
