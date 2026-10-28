import type { AxiosInstance, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
// The instance i18n/config initialises at startup; importing the config here
// would load react-i18next into every module that reaches apiClient.
import i18n from 'i18next';

/**
 * LT-464: the owner's own changes - a booking by hand, a move, a cancel, a
 * swap - text the customer from one daily budget, and none while the
 * subscription's payment has failed. Past it the server still saves the
 * change and says so (`customerNotified: false`, or `customersNotNotified`
 * for a swap, with `notNotifiedReason`). One place tells the owner, whatever
 * screen made the change, so they know to tell the customer themselves.
 */
type Reason = 'dailyTexts' | 'paymentFailed';

interface MaybeUntold {
  customerNotified?: boolean;
  customersNotNotified?: string[];
  notNotifiedReason?: Reason;
}

export const untoldReason = (data: unknown): Reason | null => {
  const body = (data ?? {}) as MaybeUntold;
  const untold = body.customerNotified === false || (body.customersNotNotified?.length ?? 0) > 0;
  if (!untold) return null;
  return body.notNotifiedReason === 'paymentFailed' ? 'paymentFailed' : 'dailyTexts';
};

export const installCustomerTextsNotice = (instance: AxiosInstance): void => {
  instance.interceptors.response.use((response: AxiosResponse) => {
    const reason = untoldReason(response.data);
    if (reason) toast(i18n.t(`appointments.notNotified.${reason}`), { id: 'customer-not-notified', duration: 6000 });
    return response;
  });
};
