import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Account from '../../pages/Account';
import { sendPhoneCode, verifyPhoneCode } from '../../services/phoneCodeApi';
import type { User } from '../../types';

/**
 * LT-360 — a changed phone is proven by a code sent to it, and the save
 * carries the proof; an unchanged one saves at once. An account still
 * waiting for its free period is told how to get it.
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

const jane = { _id: 'u1', name: 'Jane', email: 'jane@biz.com', phone: '0501234567', defaultLanguage: 'he' };
const phoneInput = () => document.querySelector('input[name="phone"]') as HTMLInputElement;

describe('Account page: the phone (LT-360)', () => {
  beforeEach(() => {
    auth.user = { ...jane };
    updateUser.mockReset().mockResolvedValue(undefined);
    vi.mocked(sendPhoneCode).mockReset().mockResolvedValue(undefined);
    vi.mocked(verifyPhoneCode).mockReset().mockResolvedValue('phone-proof');
  });

  it('shows the initial in a round avatar (LT-369)', () => {
    render(<Account />);
    expect(screen.getByText('J', { exact: true })).toHaveClass('rounded-full');
  });

  it('saves an unchanged phone (written another way) without a code', async () => {
    render(<Account />);
    fireEvent.click(screen.getByText('account.editDetails'));
    fireEvent.change(phoneInput(), { target: { name: 'phone', value: '+972 50-123-4567' } });
    fireEvent.click(screen.getByText('account.saveChanges'));

    // Sent in E.164, the form it is stored in (LT-404).
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ name: 'Jane', phone: '+972501234567' }));
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });

  it('formats the number as it is typed and says a landline is no mobile (LT-404)', async () => {
    render(<Account />);
    fireEvent.click(screen.getByText('account.editDetails'));
    fireEvent.change(phoneInput(), { target: { name: 'phone', value: '0527654321' } });
    expect(phoneInput()).toHaveValue('052-765-4321');
    expect(phoneInput()).toHaveAttribute('type', 'tel');

    fireEvent.change(phoneInput(), { target: { name: 'phone', value: '03-1234567' } });
    fireEvent.click(screen.getByText('account.saveChanges'));

    expect(await screen.findByText('phoneInput.invalidMobile')).toBeInTheDocument();
    expect(phoneInput()).toHaveAttribute('aria-invalid', 'true');
    expect(sendPhoneCode).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('shows the stored phone nationally, whatever its shape', () => {
    auth.user = { ...jane, phone: '+972501234567' };
    render(<Account />);
    expect(screen.getByText('050-1234567')).toBeInTheDocument();
  });

  it('sends a code to a new number and saves it only with the proof', async () => {
    render(<Account />);
    fireEvent.click(screen.getByText('account.editDetails'));
    fireEvent.change(phoneInput(), { target: { name: 'phone', value: '0527654321' } });
    fireEvent.click(screen.getByText('account.saveChanges'));

    expect(await screen.findByTestId('account-phone-code')).toBeInTheDocument();
    // The code goes to the number in E.164, and the save sends that form (LT-404).
    expect(sendPhoneCode).toHaveBeenCalledWith('+972527654321', 'sms', 'he');
    expect(updateUser).not.toHaveBeenCalled();

    fireEvent.change(document.querySelector('input[name="phoneCode"]')!, { target: { value: '123456' } });

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ name: 'Jane', phone: '+972527654321', phoneToken: 'phone-proof' }));
    expect(verifyPhoneCode).toHaveBeenCalledWith('+972527654321', '123456');
  });

  it('says a wrong code is wrong and saves nothing', async () => {
    vi.mocked(verifyPhoneCode).mockRejectedValue(
      Object.assign(new Error('400'), { isAxiosError: true, response: { status: 400, data: { error: 'Invalid verification code' } } })
    );
    render(<Account />);
    fireEvent.click(screen.getByText('account.editDetails'));
    fireEvent.change(phoneInput(), { target: { name: 'phone', value: '0527654321' } });
    fireEvent.click(screen.getByText('account.saveChanges'));
    fireEvent.change(await screen.findByLabelText('account.phoneCode.label'), { target: { value: '000000' } });

    expect(await screen.findByText('account.phoneCode.wrong')).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('tells an account still waiting for its free period how to get it', () => {
    auth.user = { ...jane, phone: '', freePeriod: { state: 'pending' } };
    render(<Account />);
    expect(screen.getByTestId('free-period-pending')).toBeInTheDocument();
    fireEvent.click(screen.getByText('account.phoneCode.verifyNow'));
    expect(phoneInput()).toBeInTheDocument();
  });
});
