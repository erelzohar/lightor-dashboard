import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from '../../pages/Settings';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import { sendPhoneCode, verifyPhoneCode } from '../../services/phoneCodeApi';
import { resetPhoneCountries, setOpenAbroad } from '../../services/phoneCountries';
import type { WebConfig } from '../../types';

/**
 * LT-677: the business phone in Settings, Contact, once a country is open
 * abroad. A number there is taken; nothing tells a mobile from a landline
 * abroad, so any such number that is neither the owner's own nor the one
 * stored is proven by a code first (`contactPhoneToken`). With no country
 * open a number abroad is refused, as it always was.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../i18n/config', () => ({
  SUPPORTED_LANGUAGES: ['en', 'he'],
  default: { language: 'en', changeLanguage: vi.fn() },
}));
const owner = vi.hoisted(() => ({ phone: '+12125550123' }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1', phone: owner.phone, defaultLanguage: 'en' } } }),
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
    defaultLanguage: 'en',
    workingDays: [],
    contact: { phone: '+13105550199', mail: 'a@b.co' },
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

let refuseWith: string | null = null;

const sentPayload = (call = 0) =>
  vi.mocked(updateWebConfig).mock.calls[call][0] as unknown as Partial<WebConfig> & { contactPhoneToken?: string };

const openContactTab = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /settings\.tabs\.contact/ }));
const phoneField = () => screen.getByLabelText('settings.phone') as HTMLInputElement;
const typePhone = (value: string) => fireEvent.change(phoneField(), { target: { value } });
const save = async () => fireEvent.click(await screen.findByText('common.save'));

beforeEach(() => {
  owner.phone = '+12125550123';
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

afterEach(() => resetPhoneCountries());

describe('Settings: a business phone abroad (LT-677)', () => {
  beforeEach(() => setOpenAbroad(['US']));

  it('shows the stored number nationally under its own country, as an unchanged form', () => {
    render(<Settings />);
    openContactTab();
    expect(phoneField()).toHaveValue('(310) 555-0199');
    expect(screen.getByTestId('phone-country')).toHaveAttribute('data-country', 'US');
    expect(screen.queryByText('common.save')).toBeNull();
  });

  it("saves the owner's own number without a code", async () => {
    render(<Settings />);
    openContactTab();
    typePhone('(212) 555-0123');
    await save();

    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().contact?.phone).toBe('+12125550123');
    expect(sentPayload().contactPhoneToken).toBeUndefined();
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });

  it('asks for a code for any other number there, a landline too, and sends its proof with the save', async () => {
    render(<Settings />);
    openContactTab();
    typePhone('(646) 555-0142');
    await save();

    expect(await screen.findByTestId('contact-phone-code')).toHaveTextContent('phoneInput.businessCodeHintAbroad');
    // In E.164, the only form the API takes a number abroad in.
    expect(sendPhoneCode).toHaveBeenCalledTimes(1);
    expect(sendPhoneCode).toHaveBeenCalledWith('+16465550142', 'sms', 'en');
    expect(updateWebConfig).not.toHaveBeenCalled();

    // A second Save while the code field waits asks for no second code.
    await save();
    expect(sendPhoneCode).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('account.phoneCode.label'), { target: { value: '123456' } });
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(verifyPhoneCode).toHaveBeenCalledWith('+16465550142', '123456');
    expect(sentPayload().contact?.phone).toBe('+16465550142');
    expect(sentPayload().contactPhoneToken).toBe('contact-proof');
    await waitFor(() => expect(screen.queryByTestId('contact-phone-code')).toBeNull());
  });

  it("keeps Israel's rules for an Israeli number: a landline at once, a mobile with a code", async () => {
    render(<Settings />);
    openContactTab();
    typePhone('+972 3 123 4567');
    await save();
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().contact?.phone).toBe('+97231234567');
    expect(sendPhoneCode).not.toHaveBeenCalled();

    typePhone('+972 52 765 4321');
    await save();
    expect(await screen.findByTestId('contact-phone-code')).toHaveTextContent('phoneInput.businessCodeHint');
    expect(sendPhoneCode).toHaveBeenCalledWith('+972527654321', 'sms', 'en');
  });

  it('keeps the save shut for a Canadian number, and for half a number', async () => {
    render(<Settings />);
    openContactTab();
    typePhone('(416) 555-0123');
    await save();
    expect(await screen.findByText('phoneInput.invalidAbroad')).toBeInTheDocument();
    expect(updateWebConfig).not.toHaveBeenCalled();

    // "21255501" alone would read as a Jerusalem landline: under the US chip it is half a number.
    typePhone('21255501');
    await save();
    expect(updateWebConfig).not.toHaveBeenCalled();
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });

  it('says a number the server refused is not of an offered country', async () => {
    refuseWith = 'CONTACT_PHONE_INVALID';
    render(<Settings />);
    openContactTab();
    typePhone('+972 3 123 4567');
    await save();
    expect(await screen.findByText('phoneInput.invalidOffered')).toBeInTheDocument();
  });
});

describe('Settings: a number abroad while only Israel is offered (as before LT-677)', () => {
  it('keeps the save shut, in the words it always had', async () => {
    const config = baseConfig();
    state.webConfig.data = { ...config, contact: { ...config.contact, phone: '0541112222' } };
    render(<Settings />);
    openContactTab();
    expect(screen.queryByTestId('phone-country')).toBeNull();
    typePhone('+1 646 555 0142');
    await save();

    expect(await screen.findByText('phoneInput.invalidAny')).toBeInTheDocument();
    expect(updateWebConfig).not.toHaveBeenCalled();
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });
});
