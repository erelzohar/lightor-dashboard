import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from '../../pages/Settings';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import { sendPhoneCode, verifyPhoneCode } from '../../services/phoneCodeApi';
import type { WebConfig } from '../../types';

/**
 * LT-404: the business phone in Settings → Contact: any valid Israeli
 * number, stored in E.164. A landline, the owner's own mobile and the stored
 * number save at once; another mobile is proven by a code first, and the
 * save carries the proof as `contactPhoneToken`. The server's refusals read
 * in the owner's words.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../i18n/config', () => ({
  SUPPORTED_LANGUAGES: ['en', 'he'],
  default: { language: 'en', changeLanguage: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1', phone: '+972501234567', defaultLanguage: 'he' } } }),
}));
vi.mock('../../services/webConfigApi', () => ({ checkSubdomainAvailability: vi.fn() }));
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn() }));
vi.mock('../../services/phoneCodeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/phoneCodeApi')>()),
  sendPhoneCode: vi.fn(),
  verifyPhoneCode: vi.fn(),
}));
vi.mock('../../components/settings/CalendarFeedCard', () => ({ default: () => <div /> }));
vi.mock('../../components/settings/GoogleCalendarCard', () => ({ default: () => <div /> }));

const baseConfig = (): WebConfig =>
  ({
    _id: 'wc1',
    user_id: 'u1',
    businessName: 'Biz',
    logoImageName: '',
    vacations: [],
    appointmentTypes: [],
    subDomain: 'biz',
    minCancelTimeMS: 3_600_000,
    defaultLanguage: 'he',
    workingDays: [],
    // An older row: the number as it was typed.
    contact: { phone: '0541112222', mail: 'a@b.co' },
    social: { instagram: null, facebook: null, x: null, tiktok: null },
    pallete: {},
    components: { introPopup: { visible: false, value: '' } },
  }) as unknown as WebConfig;

const state = vi.hoisted(() => ({
  webConfig: { data: null as unknown, loading: false, error: null as string | null },
  appointments: { appointmentTypes: [] as unknown[] },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
vi.mock('../../store/slices/webConfigSlice', () => ({
  fetchWebConfig: vi.fn(() => ({ type: 'webConfig/fetch' })),
  updateWebConfig: Object.assign(
    vi.fn((payload: unknown) => ({ type: 'webConfig/update', payload })),
    { rejected: { match: (action: { type: string }) => action.type === 'webConfig/update/rejected' } }
  ),
}));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  fetchAppointmentTypes: vi.fn(() => ({ type: 'appointments/fetchTypes' })),
}));
const dispatchMock = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatchMock }));

/** The server's answer to the next save: stored, or refused with a code. */
let refuseWith: string | null = null;

const sentPayload = (call = 0) =>
  vi.mocked(updateWebConfig).mock.calls[call][0] as unknown as Partial<WebConfig> & { contactPhoneToken?: string };

const openContactTab = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /settings\.tabs\.contact/ }));
const phoneField = () => screen.getByLabelText('settings.phone') as HTMLInputElement;
const typePhone = (value: string) => fireEvent.change(phoneField(), { target: { value } });
const save = async () => fireEvent.click(await screen.findByText('common.save'));

beforeEach(() => {
  state.webConfig.data = baseConfig();
  refuseWith = null;
  vi.mocked(updateWebConfig).mockClear();
  vi.mocked(sendPhoneCode).mockReset().mockResolvedValue(undefined);
  vi.mocked(verifyPhoneCode).mockReset().mockResolvedValue('contact-proof');
  dispatchMock.mockReset().mockImplementation((action: { type: string; payload?: Partial<WebConfig> }) => {
    if (action.type === 'webConfig/update') {
      if (refuseWith) {
        return Promise.resolve({ type: 'webConfig/update/rejected', error: { message: '400', code: refuseWith } });
      }
      const answer = { ...(state.webConfig.data as WebConfig), ...action.payload } as WebConfig;
      state.webConfig.data = answer;
      return Promise.resolve({ type: 'webConfig/update/fulfilled', payload: answer });
    }
    return Promise.resolve(action);
  });
});

describe('Settings: the business phone (LT-404)', () => {
  it('shows the stored number nationally, as an unchanged form', () => {
    render(<Settings />);
    openContactTab();
    expect(phoneField()).toHaveValue('054-111-2222');
    expect(phoneField()).toHaveAttribute('type', 'tel');
    expect(screen.queryByText('common.save')).toBeNull();
  });

  it('saves a landline without a code, in E.164', async () => {
    render(<Settings />);
    openContactTab();
    typePhone('03-1234567');
    await save();

    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().contact?.phone).toBe('+97231234567');
    expect(sentPayload().contactPhoneToken).toBeUndefined();
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });

  it("saves the owner's own mobile without a code", async () => {
    render(<Settings />);
    openContactTab();
    typePhone('050-123-4567');
    await save();

    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().contact?.phone).toBe('+972501234567');
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });

  it('asks for a code for another mobile and sends its proof with the save', async () => {
    render(<Settings />);
    openContactTab();
    typePhone('0527654321');
    await save();

    expect(await screen.findByTestId('contact-phone-code')).toBeInTheDocument();
    expect(sendPhoneCode).toHaveBeenCalledWith('+972527654321', 'sms', 'he');
    expect(updateWebConfig).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('account.phoneCode.label'), { target: { value: '123456' } });

    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(verifyPhoneCode).toHaveBeenCalledWith('+972527654321', '123456');
    expect(sentPayload().contact?.phone).toBe('+972527654321');
    expect(sentPayload().contactPhoneToken).toBe('contact-proof');
    await waitFor(() => expect(screen.queryByTestId('contact-phone-code')).toBeNull());
  });

  it('keeps the save shut for a number that is no Israeli phone', async () => {
    render(<Settings />);
    openContactTab();
    typePhone('0501');
    await save();

    expect(await screen.findByText('phoneInput.invalidAny')).toBeInTheDocument();
    expect(updateWebConfig).not.toHaveBeenCalled();
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });

  it.each([
    ['CONTACT_PHONE_INVALID', 'phoneInput.invalidAny'],
    ['PHONE_NOT_VERIFIED', 'phoneInput.notVerified'],
    ['PHONE_MISMATCH', 'phoneInput.mismatch'],
  ])('says what the server meant by %s', async (code, message) => {
    refuseWith = code;
    render(<Settings />);
    openContactTab();
    typePhone('03-1234567');
    await save();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(phoneField()).toHaveAttribute('aria-invalid', 'true');
  });
});
