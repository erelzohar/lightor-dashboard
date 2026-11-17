import axios from 'axios';
import apiClient from './apiClient';
import globals from './globals';
import { CodeFrameError, confirmFrameCode, sendFrameCode } from './codeFrame';
import { getPhoneCountries } from './phoneCountries';
import { openAbroadE164 } from '../utils/phone';

/**
 * A code sent to the owner's phone (LT-360): a changed phone is proven by it,
 * as at signup, and the `phoneToken` it returns rides with the update.
 *
 * LT-677: the way goes by the number's country, never by the page. An
 * Israeli number: the API's own routes, as ever. A number of a country
 * opened abroad: Firebase sends and checks the code in the frame on
 * lightor.app (services/codeFrame), and the API turns its `idToken` into the
 * same `phoneToken`. The callers are the same either way.
 */

/** A code abroad may be asked for again after this long (the API's own routes keep their limits on the server). */
const ABROAD_RESEND_MS = 30_000;
let lastAbroadAsk = 0;
/** Firebase's proof for a number abroad that the API has not been reached with yet. */
let heldProof: { phone: string; idToken: string } | null = null;

/** The number in E.164 when it is of a country opened abroad, else null. */
const abroadNumber = (phoneNumber: string): string | null => openAbroadE164(phoneNumber, getPhoneCountries().abroad);

/**
 * Sends a code. Only ever called from a tap on a send button: nothing here
 * sends by itself or tries again. Abroad the code is always an SMS
 * (`channelType` is Israel's choice).
 */
export const sendPhoneCode = async (phoneNumber: string, channelType: 'sms' | 'whatsapp', languageCode: string): Promise<void> => {
  const abroad = abroadNumber(phoneNumber);
  if (abroad) {
    if (Date.now() - lastAbroadAsk < ABROAD_RESEND_MS) throw new CodeFrameError('lt/wait', 'send');
    heldProof = null;
    await sendFrameCode(abroad, languageCode, () => {
      lastAbroadAsk = Date.now();
    });
    return;
  }
  await apiClient.post(`${globals.messagingUrl}otp/send`, { phoneNumber, channelType, languageCode });
};

export const verifyPhoneCode = async (phoneNumber: string, otp: string): Promise<string> => {
  const abroad = abroadNumber(phoneNumber);
  if (abroad) {
    // The code is spent once Firebase took it: if the API was not reached
    // after that, the same proof goes up again instead of a second check.
    const idToken = heldProof?.phone === abroad ? heldProof.idToken : await confirmFrameCode(otp);
    heldProof = { phone: abroad, idToken };
    try {
      const { data } = await apiClient.post(`${globals.messagingUrl}otp/firebase`, { idToken });
      heldProof = null;
      return data.phoneToken as string;
    } catch (error) {
      // The API answered and refused: this proof is no good to it.
      if (axios.isAxiosError(error) && error.response) heldProof = null;
      throw error;
    }
  }
  const { data } = await apiClient.post(`${globals.messagingUrl}otp/verify`, { phoneNumber, otp });
  return data.phoneToken as string;
};

/** The frame's refusal (LT-677), in the owner's words. */
const frameErrorKey = ({ code, stage }: CodeFrameError): string => {
  if (code === 'lt/wait' || code === 'lt/busy') return 'account.phoneCode.wait';
  if (code === 'auth/invalid-verification-code' || code === 'auth/missing-verification-code') return 'account.phoneCode.wrong';
  if (code === 'auth/code-expired' || code === 'auth/session-expired' || code === 'lt/no-code-sent') return 'account.phoneCode.expired';
  if (code === 'auth/invalid-phone-number' || code === 'auth/missing-phone-number' || code === 'lt/home-number') {
    return 'account.phoneCode.offeredOnly';
  }
  // Anything else at the send (too many requests, Google's check, the server's gate, no answer): try later.
  return stage === 'send' ? 'account.phoneCode.sendFailed' : 'account.phoneCode.failed';
};

/** The translation key for a failed send or check. */
export const phoneCodeErrorKey = (error: unknown): string => {
  if (error instanceof CodeFrameError) return frameErrorKey(error);
  // The save's refusal, not the code's (LT-515): userApi hands on its code alone.
  if ((error as { code?: string } | null)?.code === 'PHONE_ACCOUNT_LIMIT') return 'phoneInput.accountLimit';
  if (!axios.isAxiosError(error) || !error.response) return 'account.phoneCode.failed';
  const { status } = error.response;
  const data = (error.response.data ?? {}) as { code?: string; error?: string; message?: string };
  const text = `${data.error ?? ''} ${data.message ?? ''}`;
  // Israel alone is today's wording; with a country open abroad the list is wider (LT-677).
  const abroadOpen = getPhoneCountries().abroad.length > 0;
  if (data.code === 'PHONE_INVALID') return abroadOpen ? 'account.phoneCode.offeredOnly' : 'account.phoneCode.israelOnly';
  // The business phone's save (LT-404): the server read the number, or its proof, differently.
  if (data.code === 'CONTACT_PHONE_INVALID') return abroadOpen ? 'phoneInput.invalidOffered' : 'phoneInput.invalidAny';
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
