import axios from 'axios';
import apiClient from './apiClient';
import globals from './globals';

/**
 * A code sent to the owner's phone (LT-360): a changed phone is proven by it,
 * as at signup, and the `phoneToken` it returns rides with the update.
 */
export const sendPhoneCode = async (phoneNumber: string, channelType: 'sms' | 'whatsapp', languageCode: string): Promise<void> => {
  await apiClient.post(`${globals.messagingUrl}otp/send`, { phoneNumber, channelType, languageCode });
};

export const verifyPhoneCode = async (phoneNumber: string, otp: string): Promise<string> => {
  const { data } = await apiClient.post(`${globals.messagingUrl}otp/verify`, { phoneNumber, otp });
  return data.phoneToken as string;
};

/** The translation key for a failed send or check. */
export const phoneCodeErrorKey = (error: unknown): string => {
  if (!axios.isAxiosError(error) || !error.response) return 'account.phoneCode.failed';
  const { status } = error.response;
  const data = (error.response.data ?? {}) as { code?: string; error?: string; message?: string };
  const text = `${data.error ?? ''} ${data.message ?? ''}`;
  if (data.code === 'PHONE_INVALID') return 'account.phoneCode.israelOnly';
  // The business phone's save (LT-404): the server read the number, or its proof, differently.
  if (data.code === 'CONTACT_PHONE_INVALID') return 'phoneInput.invalidAny';
  if (data.code === 'PHONE_NOT_VERIFIED') return 'phoneInput.notVerified';
  if (data.code === 'PHONE_MISMATCH') return 'phoneInput.mismatch';
  if (data.code === 'OTP_NUMBER_CAP') return 'account.phoneCode.dailyCap';
  if (status === 429) return 'account.phoneCode.wait';
  if (status === 403 && /Too many failed attempts/i.test(text)) return 'account.phoneCode.tooManyTries';
  if (status === 400 && /expired|never requested/i.test(text)) return 'account.phoneCode.expired';
  if (status === 400 && /Invalid verification code/i.test(text)) return 'account.phoneCode.wrong';
  return 'account.phoneCode.failed';
};

/** Two ways of writing one number (dashes, spaces, +972 or 0) are one number (LT-404: read as E.164). */
export { samePhone } from '../utils/phone';
