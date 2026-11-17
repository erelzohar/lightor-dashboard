import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiClient from '../../services/apiClient';
import globals from '../../services/globals';
import { CodeFrameError, closeCodeFrame } from '../../services/codeFrame';
import { phoneCodeErrorKey, sendPhoneCode, verifyPhoneCode } from '../../services/phoneCodeApi';
import { resetPhoneCountries, setOpenAbroad } from '../../services/phoneCountries';
import { FRAME_ORIGIN, frameRoot, frameSays, settle, watchFrame } from '../helpers/codeFrame';
import en from '../../i18n/locales/en.json';
import he from '../../i18n/locales/he.json';
import ar from '../../i18n/locales/ar.json';
import fr from '../../i18n/locales/fr.json';
import es from '../../i18n/locales/es.json';

/**
 * LT-677: a phone code goes by the number's country, never by the page. An
 * Israeli number: `POST /otp/send` and `/otp/verify`, as ever. A number of a
 * country opened abroad: the frame on lightor.app sends and checks it, and
 * `POST /otp/firebase { idToken }` answers with the same `phoneToken`.
 */
const US = '+12125550123';
const IL = '+972541234567';
const otpUrl = (path: string) => `${globals.messagingUrl}otp/${path}`;
const refusal = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(String(status)), { isAxiosError: true, response: { status, data } });

/** The clock the 30 seconds between codes abroad is read from: each test starts well past the last one's code. */
let now = Date.UTC(2026, 10, 17);
let post: ReturnType<typeof vi.spyOn>;

/** A send abroad, the frame playing along up to "sent". */
const sendAbroad = async (phone = US, lang = 'en') => {
  const sending = sendPhoneCode(phone, 'sms', lang);
  sending.catch(() => {});
  const posted = watchFrame();
  frameSays({ type: 'lt-code-ready' });
  await settle();
  frameSays({ type: 'lt-code-sent' });
  await sending;
  return posted;
};

beforeEach(() => {
  now += 60 * 60_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, phoneToken: 'il-proof' } } as never);
});

afterEach(() => {
  closeCodeFrame();
  resetPhoneCountries();
  vi.restoreAllMocks();
});

describe('a code while only Israel is offered (as before LT-677)', () => {
  it('sends and checks an Israeli number through the API, and makes no frame', async () => {
    await sendPhoneCode(IL, 'whatsapp', 'he');
    expect(post).toHaveBeenCalledWith(otpUrl('send'), { phoneNumber: IL, channelType: 'whatsapp', languageCode: 'he' });
    await expect(verifyPhoneCode(IL, '123456')).resolves.toBe('il-proof');
    expect(post).toHaveBeenLastCalledWith(otpUrl('verify'), { phoneNumber: IL, otp: '123456' });
    expect(frameRoot()).toBeNull();
  });

  it('sends a number abroad to the API too, whose refusal reads as it always did', async () => {
    post.mockRejectedValue(refusal(400, { code: 'PHONE_INVALID' }));
    const failure = await sendPhoneCode(US, 'sms', 'en').catch((error) => error);
    expect(post).toHaveBeenCalledWith(otpUrl('send'), { phoneNumber: US, channelType: 'sms', languageCode: 'en' });
    expect(frameRoot()).toBeNull();
    expect(phoneCodeErrorKey(failure)).toBe('account.phoneCode.israelOnly');
    expect(phoneCodeErrorKey(refusal(400, { code: 'CONTACT_PHONE_INVALID' }))).toBe('phoneInput.invalidAny');
  });
});

describe('a code once a country is open abroad (LT-677)', () => {
  beforeEach(() => setOpenAbroad(['US']));

  it('still sends an Israeli number through the API, on the channel asked for', async () => {
    await sendPhoneCode(IL, 'whatsapp', 'he');
    expect(post).toHaveBeenCalledWith(otpUrl('send'), { phoneNumber: IL, channelType: 'whatsapp', languageCode: 'he' });
    await verifyPhoneCode(IL, '123456');
    expect(post).toHaveBeenLastCalledWith(otpUrl('verify'), { phoneNumber: IL, otp: '123456' });
    expect(frameRoot()).toBeNull();
  });

  it('sends a number abroad through the frame, in E.164, and never through the API', async () => {
    // Written the long way, and asked for on WhatsApp: abroad it is E.164 and an SMS all the same.
    const sending = sendPhoneCode('+1 (212) 555-0123', 'whatsapp', 'en');
    const posted = watchFrame();
    frameSays({ type: 'lt-code-ready' });
    await settle();
    expect(posted).toHaveBeenCalledWith({ type: 'lt-code-send', phone: US, lang: 'en' }, FRAME_ORIGIN);
    frameSays({ type: 'lt-code-sent' });
    await expect(sending).resolves.toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });

  it("checks the code in the frame and trades Firebase's token for the phone proof", async () => {
    const posted = await sendAbroad();
    post.mockResolvedValue({ data: { success: true, phone: US, phoneToken: 'us-proof' } } as never);
    const checking = verifyPhoneCode(US, '123456');
    expect(posted).toHaveBeenLastCalledWith({ type: 'lt-code-confirm', code: '123456' }, FRAME_ORIGIN);
    expect(post).not.toHaveBeenCalled();
    frameSays({ type: 'lt-code-verified', idToken: 'firebase-id-token' });
    await expect(checking).resolves.toBe('us-proof');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(otpUrl('firebase'), { idToken: 'firebase-id-token' });
    expect(frameRoot()).toBeNull();
  });

  it('sends a Canadian number to the API, which refuses it: only the open country goes to the frame', async () => {
    post.mockRejectedValue(refusal(400, { code: 'PHONE_INVALID' }));
    const failure = await sendPhoneCode('+14165550123', 'sms', 'en').catch((error) => error);
    expect(frameRoot()).toBeNull();
    expect(phoneCodeErrorKey(failure)).toBe('account.phoneCode.offeredOnly');
  });

  describe('the 30 seconds between codes', () => {
    it('refuses a second code within 30 seconds without asking the frame, and sends one after', async () => {
      const posted = await sendAbroad();
      expect(posted).toHaveBeenCalledTimes(1);

      now += 29_000;
      const early = await sendPhoneCode(US, 'sms', 'en').catch((error) => error);
      expect(early).toBeInstanceOf(CodeFrameError);
      expect(early).toMatchObject({ code: 'lt/wait' });
      expect(phoneCodeErrorKey(early)).toBe('account.phoneCode.wait');
      await settle();
      expect(posted).toHaveBeenCalledTimes(1);

      now += 1_000;
      const again = sendPhoneCode(US, 'sms', 'en');
      await settle();
      expect(posted).toHaveBeenCalledTimes(2);
      frameSays({ type: 'lt-code-sent' });
      await expect(again).resolves.toBeUndefined();
    });

    it('counts a send the frame refused too, and holds another number as well', async () => {
      const sending = sendPhoneCode(US, 'sms', 'en');
      sending.catch(() => {});
      const posted = watchFrame();
      frameSays({ type: 'lt-code-ready' });
      await settle();
      frameSays({ type: 'lt-code-error', stage: 'send', code: 'auth/captcha-check-failed' });
      await expect(sending).rejects.toMatchObject({ code: 'auth/captcha-check-failed' });
      // Refused, and nothing tried again by itself.
      await settle();
      expect(posted).toHaveBeenCalledTimes(1);

      now += 5_000;
      await expect(sendPhoneCode('+13105550123', 'sms', 'en')).rejects.toMatchObject({ code: 'lt/wait' });
      expect(frameRoot()).toBeNull();
    });

    it('does not count a frame that never loaded', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const sending = sendPhoneCode(US, 'sms', 'en');
        const failed = expect(sending).rejects.toMatchObject({ code: 'lt/frame' });
        await vi.advanceTimersByTimeAsync(20_000);
        await failed;
      } finally {
        vi.useRealTimers();
      }
      // The frame was never asked: the next tap may ask at once.
      const posted = await sendAbroad();
      expect(posted).toHaveBeenCalledTimes(1);
    });
  });

  it('does not ask for the code twice when the API was out of reach after Firebase took it', async () => {
    const posted = await sendAbroad();
    post.mockRejectedValueOnce(new Error('Network Error'));
    const first = verifyPhoneCode(US, '123456');
    first.catch(() => {});
    frameSays({ type: 'lt-code-verified', idToken: 'firebase-id-token' });
    await expect(first).rejects.toThrow('Network Error');

    post.mockResolvedValue({ data: { success: true, phone: US, phoneToken: 'us-proof' } } as never);
    await expect(verifyPhoneCode(US, '123456')).resolves.toBe('us-proof');
    // One check in the frame, the same token up twice.
    expect(posted.mock.calls.filter(([message]) => (message as { type: string }).type === 'lt-code-confirm')).toHaveLength(1);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(otpUrl('firebase'), { idToken: 'firebase-id-token' });
  });

  it("lets go of a proof the API refused: the next check is the frame's to answer", async () => {
    await sendAbroad();
    post.mockRejectedValue(refusal(400, { code: 'PHONE_PROOF_INVALID' }));
    const first = verifyPhoneCode(US, '123456');
    first.catch(() => {});
    frameSays({ type: 'lt-code-verified', idToken: 'firebase-id-token' });
    const failure = await first.catch((error) => error);
    expect(phoneCodeErrorKey(failure)).toBe('account.phoneCode.failed');

    const second = await verifyPhoneCode(US, '123456').catch((error) => error);
    expect(second).toMatchObject({ code: 'lt/no-code-sent' });
    expect(phoneCodeErrorKey(second)).toBe('account.phoneCode.expired');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['auth/invalid-verification-code', 'confirm', 'account.phoneCode.wrong'],
    ['auth/code-expired', 'confirm', 'account.phoneCode.expired'],
    ['lt/no-code-sent', 'confirm', 'account.phoneCode.expired'],
    ['auth/invalid-phone-number', 'send', 'account.phoneCode.offeredOnly'],
    ['lt/home-number', 'send', 'account.phoneCode.offeredOnly'],
    ['auth/too-many-requests', 'send', 'account.phoneCode.sendFailed'],
    ['auth/captcha-check-failed', 'send', 'account.phoneCode.sendFailed'],
    // A code the server's gate refused arrives as a send error with some other code.
    ['auth/internal-error', 'send', 'account.phoneCode.sendFailed'],
    ['lt/frame', 'send', 'account.phoneCode.sendFailed'],
    ['lt/timeout', 'send', 'account.phoneCode.sendFailed'],
    ['lt/cancelled', 'send', 'account.phoneCode.sendFailed'],
    ['lt/wait', 'send', 'account.phoneCode.wait'],
    ['auth/too-many-requests', 'confirm', 'account.phoneCode.failed'],
  ] as const)("words the frame's %s at the %s", (code, stage, key) => {
    expect(phoneCodeErrorKey(new CodeFrameError(code, stage))).toBe(key);
  });

  it("words the server's refusals for more countries than Israel", () => {
    expect(phoneCodeErrorKey(refusal(400, { code: 'PHONE_INVALID' }))).toBe('account.phoneCode.offeredOnly');
    expect(phoneCodeErrorKey(refusal(400, { code: 'CONTACT_PHONE_INVALID' }))).toBe('phoneInput.invalidOffered');
    expect(phoneCodeErrorKey(refusal(404))).toBe('account.phoneCode.failed');
  });
});

describe('the words for phones abroad', () => {
  const at = (tree: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], tree);

  it.each([
    'account.phoneCode.offeredOnly',
    'account.phoneCode.sendFailed',
    'phoneInput.countryUS',
    'phoneInput.names.IL',
    'phoneInput.names.US',
    'phoneInput.chooseCountry',
    'phoneInput.invalidAbroad',
    'phoneInput.invalidWorldAbroad',
    'phoneInput.invalidOffered',
    'phoneInput.businessCodeHintAbroad',
    'phoneInput.checkTitle',
    'phoneInput.checkClose',
    'customers.add.phoneHintCountries',
  ])('has %s in every language, with no long dash', (key) => {
    for (const locale of [en, he, ar, fr, es]) {
      const text = at(locale, key);
      expect(typeof text).toBe('string');
      expect(text as string).not.toBe('');
      expect(text as string).not.toMatch(/[–—]/);
    }
  });

  it("keeps Israel's own wording as it was", () => {
    expect(en.account.phoneCode.israelOnly).toBe('An Israeli mobile number (05X) only');
    expect(en.phoneInput.invalidMobile).toBe('Enter a valid Israeli mobile number');
    expect(en.phoneInput.invalidAny).toBe('Enter a valid Israeli phone number');
    expect(en.phoneInput.country).toBe('Israel (+972)');
  });
});
