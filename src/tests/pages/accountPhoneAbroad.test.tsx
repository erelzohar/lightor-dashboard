import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Account from '../../pages/Account';
import { sendPhoneCode, verifyPhoneCode } from '../../services/phoneCodeApi';
import { resetPhoneCountries, setOpenAbroad, setOwnerPhone } from '../../services/phoneCountries';
import type { User } from '../../types';

/**
 * LT-677: the owner's phone on the Account page, once a country is open
 * abroad: a number there is taken, proven by its code like any new number,
 * and saved in E.164. With no country open it is refused, as it always was.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../i18n/config', () => ({
  SUPPORTED_LANGUAGES: ['en', 'he', 'ar', 'fr', 'es'],
  default: { changeLanguage: vi.fn(), language: 'he' },
}));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ changeLanguage: vi.fn() }) }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) => selector({ webConfig: { data: null } }),
}));
vi.mock('../../components/account/BillingSection', () => ({ default: (): null => null }));
vi.mock('../../components/account/DangerZoneSection', () => ({ default: (): null => null }));
vi.mock('../../components/account/NotificationsCard', () => ({ default: (): null => null }));
vi.mock('../../services/phoneCodeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/phoneCodeApi')>()),
  sendPhoneCode: vi.fn(),
  verifyPhoneCode: vi.fn(),
}));

const { auth, updateUser } = vi.hoisted(() => ({ auth: { user: null as Partial<User> | null }, updateUser: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth, updateUser, updatePassword: vi.fn() }) }));

const jane = { _id: 'u1', name: 'Jane', email: 'jane@biz.com', phone: '+972501234567', defaultLanguage: 'en' };
const phoneInput = () => document.querySelector('input[name="phone"]') as HTMLInputElement;
const typePhone = (value: string) => fireEvent.change(phoneInput(), { target: { name: 'phone', value } });
const edit = () => fireEvent.click(screen.getByText('account.editDetails'));
const save = () => fireEvent.click(screen.getByText('account.saveChanges'));

beforeEach(() => {
  auth.user = { ...jane };
  updateUser.mockReset().mockResolvedValue(undefined);
  vi.mocked(sendPhoneCode).mockReset().mockResolvedValue(undefined);
  vi.mocked(verifyPhoneCode).mockReset().mockResolvedValue('phone-proof');
});

afterEach(() => resetPhoneCountries());

describe('Account page: a phone abroad (LT-677)', () => {
  beforeEach(() => setOpenAbroad(['US']));

  it('sends a code to a new number abroad, in E.164, and saves it only with the proof', async () => {
    render(<Account />);
    edit();
    // The owner's phone is Israeli: the chip starts there, and "+1" moves it.
    expect(screen.getByTestId('phone-country')).toHaveAttribute('data-country', 'IL');
    typePhone('+1 212 555 0123');
    expect(screen.getByTestId('phone-country')).toHaveAttribute('data-country', 'US');
    save();

    expect(await screen.findByTestId('account-phone-code')).toBeInTheDocument();
    expect(sendPhoneCode).toHaveBeenCalledTimes(1);
    expect(sendPhoneCode).toHaveBeenCalledWith('+12125550123', 'sms', 'en');
    expect(updateUser).not.toHaveBeenCalled();

    fireEvent.change(document.querySelector('input[name="phoneCode"]')!, { target: { value: '123456' } });
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ name: 'Jane', phone: '+12125550123', phoneToken: 'phone-proof' }));
    expect(verifyPhoneCode).toHaveBeenCalledWith('+12125550123', '123456');
  });

  it("shows an owner's number abroad under its own country, and saves it unchanged without a code", async () => {
    auth.user = { ...jane, phone: '+12125550123' };
    setOwnerPhone('+12125550123');
    render(<Account />);
    expect(screen.getByText('+1 212 555 0123')).toBeInTheDocument();
    edit();
    expect(screen.getByTestId('phone-country')).toHaveAttribute('data-country', 'US');
    expect(phoneInput()).toHaveValue('(212) 555-0123');

    fireEvent.change(document.querySelector('input[name="name"]') as HTMLInputElement, { target: { name: 'name', value: 'Jane Cohen' } });
    save();
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ name: 'Jane Cohen', phone: '+12125550123' }));
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });

  it('sends nothing to a Canadian number, or to an Israeli landline', async () => {
    render(<Account />);
    edit();
    typePhone('+1 416 555 0123');
    save();
    expect(await screen.findByText('phoneInput.invalidAbroad')).toBeInTheDocument();

    typePhone('+972 3 123 4567');
    save();
    expect(await screen.findByText('phoneInput.invalidMobile')).toBeInTheDocument();
    expect(sendPhoneCode).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe('Account page: a number abroad while only Israel is offered (as before LT-677)', () => {
  it('sends nothing, in the words it always had', async () => {
    render(<Account />);
    edit();
    expect(screen.queryByTestId('phone-country')).toBeNull();
    typePhone('+1 212 555 0123');
    save();
    expect(await screen.findByText('phoneInput.invalidMobile')).toBeInTheDocument();
    expect(sendPhoneCode).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
