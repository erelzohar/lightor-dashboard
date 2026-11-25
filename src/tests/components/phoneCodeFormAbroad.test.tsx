import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhoneCodeForm from '../../components/onboarding/PhoneCodeForm';
import apiClient from '../../services/apiClient';
import globals from '../../services/globals';
import { closeCodeFrame } from '../../services/codeFrame';
import { resetPhoneCountries, setOpenAbroad } from '../../services/phoneCountries';
import { FRAME_ORIGIN, frameRoot, frameSays, settle, watchFrame } from '../helpers/codeFrame';

/**
 * LT-677: the phone step for an owner abroad (since LT-724 the body of the
 * two-free-months offer), on the real code routes with
 * the frame faked: the number goes to the frame only on a tap, its code is
 * an SMS only (no WhatsApp choice), another one waits 30 seconds, and the
 * save carries the proof the API gave for Firebase's token.
 */
const { t, updateUser } = vi.hoisted(() => ({
  t: (key: string) => key,
  updateUser: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en' }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ updateUser, auth: { user: { email: 'owner@example.com', googleId: 'g-1' } } }),
}));

const US = '+12125550123';
let now = Date.UTC(2026, 10, 17);
let post: ReturnType<typeof vi.spyOn>;

const phoneField = () => screen.getByLabelText(/onboarding\.phoneGate\.label/) as HTMLInputElement;
const typePhone = (value: string) => fireEvent.change(phoneField(), { target: { value } });
const tapSend = () => fireEvent.click(screen.getByText('onboarding.phoneGate.send'));

/** The frame answers a send: ready (the first time), then sent. */
const frameSends = async (posted: ReturnType<typeof watchFrame>, calls: number) => {
  await act(async () => {
    frameSays({ type: 'lt-code-ready' });
    await settle();
  });
  expect(posted).toHaveBeenCalledTimes(calls);
  await act(async () => {
    frameSays({ type: 'lt-code-sent' });
    await settle();
  });
};

const toCodeStep = async (phone = '2125550123') => {
  typePhone(phone);
  tapSend();
  const posted = watchFrame();
  await frameSends(posted, 1);
  // Read at once, with no waiting: some tests here hold the clock.
  expect(screen.getByLabelText('account.phoneCode.label')).toBeInTheDocument();
  return posted;
};

/** The gate's own 30 seconds, a second at a time. */
const passSeconds = async (seconds: number) => {
  for (let i = 0; i < seconds; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  now += 60 * 60_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, phone: US, phoneToken: 'us-proof' } } as never);
  updateUser.mockResolvedValue(undefined);
  // The device is in the United States, by its clock (deviceCountry reads the time zone).
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ timeZone: 'America/New_York' }) } as unknown as Intl.DateTimeFormat);
  setOpenAbroad(['US']);
});

afterEach(() => {
  vi.useRealTimers();
  closeCodeFrame();
  resetPhoneCountries();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PhoneCodeForm for a number abroad (LT-677)', () => {
  it("starts on the device's country when it is offered, and asks nothing of anyone by itself", async () => {
    render(<PhoneCodeForm />);
    expect(screen.getByTestId('phone-country')).toHaveAttribute('data-country', 'US');
    expect(phoneField()).toHaveAttribute('placeholder', '(212) 555-0123');
    typePhone('2125550123');
    await settle();
    // A whole valid number in the field, and still nothing sent: only the tap sends.
    expect(frameRoot()).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('starts on Israel on a device from elsewhere', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ timeZone: 'Asia/Jerusalem' }) } as unknown as Intl.DateTimeFormat);
    render(<PhoneCodeForm />);
    expect(screen.getByTestId('phone-country')).toHaveAttribute('data-country', 'IL');
  });

  it('sends the code through the frame on the tap, once, and saves the phone with its proof', async () => {
    render(<PhoneCodeForm />);
    const posted = await toCodeStep();
    expect(posted).toHaveBeenCalledWith({ type: 'lt-code-send', phone: US, lang: 'en' }, FRAME_ORIGIN);
    // Israel's own route was never asked.
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText('account.phoneCode.sent')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('account.phoneCode.label'), { target: { value: '123456' } });
    expect(posted).toHaveBeenLastCalledWith({ type: 'lt-code-confirm', code: '123456' }, FRAME_ORIGIN);
    await act(async () => {
      frameSays({ type: 'lt-code-verified', idToken: 'firebase-id-token' });
      await settle();
    });

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ phone: US, phoneToken: 'us-proof' }));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(`${globals.messagingUrl}otp/firebase`, { idToken: 'firebase-id-token' });
    // One send and one confirm: nothing was asked twice.
    expect(posted).toHaveBeenCalledTimes(2);
    expect(frameRoot()).toBeNull();
  });

  it('offers no WhatsApp code abroad, and another SMS only after 30 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(<PhoneCodeForm />);
    const posted = await toCodeStep();
    expect(screen.getByText('onboarding.phoneGate.resendIn')).toBeInTheDocument();
    expect(screen.queryByText('onboarding.phoneGate.resend')).toBeNull();

    now += 30_000;
    await passSeconds(30);
    expect(screen.getByText('onboarding.phoneGate.resend')).toBeInTheDocument();
    expect(screen.queryByText('onboarding.phoneGate.whatsapp')).toBeNull();
    // The 30 seconds passing sent nothing by themselves.
    expect(posted).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('onboarding.phoneGate.resend'));
    // A second tap while the first is on its way asks for nothing more.
    fireEvent.click(screen.getByText('onboarding.phoneGate.resend'));
    await act(async () => {
      await settle();
    });
    expect(posted).toHaveBeenCalledTimes(2);
    await act(async () => {
      frameSays({ type: 'lt-code-sent' });
      await settle();
    });
    expect(screen.getByText('onboarding.phoneGate.sentAgain')).toBeInTheDocument();
    expect(screen.getByText('onboarding.phoneGate.resendIn')).toBeInTheDocument();
  });

  it('keeps the WhatsApp choice for an Israeli number', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    post.mockResolvedValue({ data: { success: true } } as never);
    render(<PhoneCodeForm />);
    typePhone('+972541234567');
    expect(screen.getByTestId('phone-country')).toHaveAttribute('data-country', 'IL');
    tapSend();
    await act(async () => {
      await settle();
    });
    expect(post).toHaveBeenCalledWith(`${globals.messagingUrl}otp/send`, { phoneNumber: '+972541234567', channelType: 'sms', languageCode: 'en' });
    expect(frameRoot()).toBeNull();
    await passSeconds(30);
    expect(screen.getByText('onboarding.phoneGate.whatsapp')).toBeInTheDocument();
  });

  it("says the frame's refusal in the owner's words, and does not try again", async () => {
    render(<PhoneCodeForm />);
    typePhone('2125550123');
    tapSend();
    const posted = watchFrame();
    await act(async () => {
      frameSays({ type: 'lt-code-ready' });
      await settle();
      frameSays({ type: 'lt-code-error', stage: 'send', code: 'auth/too-many-requests' });
      await settle();
    });
    expect(await screen.findByText('account.phoneCode.sendFailed')).toBeInTheDocument();
    expect(screen.queryByLabelText('account.phoneCode.label')).toBeNull();
    expect(posted).toHaveBeenCalledTimes(1);
    expect(frameRoot()).toBeNull();

    // A tap right after is told to wait: the frame is not asked again.
    tapSend();
    expect(await screen.findByText('account.phoneCode.wait')).toBeInTheDocument();
    expect(frameRoot()).toBeNull();
  });

  it('says a wrong code is wrong, and lets it be typed again', async () => {
    render(<PhoneCodeForm />);
    const posted = await toCodeStep();
    const input = screen.getByLabelText('account.phoneCode.label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '000000' } });
    await act(async () => {
      frameSays({ type: 'lt-code-error', stage: 'confirm', code: 'auth/invalid-verification-code' });
      await settle();
    });
    expect(await screen.findByText('account.phoneCode.wrong')).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: '123456' } });
    expect(posted).toHaveBeenLastCalledWith({ type: 'lt-code-confirm', code: '123456' }, FRAME_ORIGIN);
  });

  it('refuses a Canadian number before anything is sent', async () => {
    render(<PhoneCodeForm />);
    typePhone('4165550123');
    tapSend();
    await waitFor(() => expect(phoneField().getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByText('phoneInput.invalidAbroad')).toBeInTheDocument();
    expect(frameRoot()).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });
});
