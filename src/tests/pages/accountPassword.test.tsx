import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Account from '../../pages/Account';
import { AuthRequestError } from '../../services/authApi';
import type { User } from '../../types';

/**
 * LT-315 — the account page: a wrong current password is a field error
 * (H6), and the profile form keeps what the owner is typing when the
 * account object is replaced underneath it (Low).
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
const { toastError, toastSuccess } = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: toastError } }));
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

const { auth, updateUser, updatePassword } = vi.hoisted(() => ({
  auth: { user: null as Partial<User> | null },
  updateUser: vi.fn(),
  updatePassword: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth, updateUser, updatePassword }),
}));

const jane = { _id: 'u1', name: 'Jane', email: 'jane@biz.com', phone: '0501234567', defaultLanguage: 'he' };

const fillPasswordForm = (current: string) => {
  fireEvent.click(screen.getAllByText('account.changePassword').find((el) => el.closest('button'))!);
  const inputs = document.querySelectorAll('input[type="password"]');
  fireEvent.change(inputs[0], { target: { name: 'currentPassword', value: current } });
  fireEvent.change(inputs[1], { target: { name: 'newPassword', value: 'abc12345' } });
  fireEvent.change(inputs[2], { target: { name: 'confirmPassword', value: 'abc12345' } });
  fireEvent.click(screen.getByText('account.updatePassword'));
};

describe('Account page (LT-315)', () => {
  beforeEach(() => {
    auth.user = { ...jane };
    updateUser.mockReset().mockResolvedValue(undefined);
    updatePassword.mockReset();
    toastError.mockReset();
  });

  it('shows a wrong current password (400 WRONG_PASSWORD) under the field', async () => {
    updatePassword.mockRejectedValue(new AuthRequestError('Current password is incorrect', 400, 'WRONG_PASSWORD'));
    render(<Account />);
    fillPasswordForm('typo');
    expect(await screen.findByText('account.passwordCurrentIncorrect')).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('does the same for the older 401 answer', async () => {
    updatePassword.mockRejectedValue(new AuthRequestError('Current password is incorrect', 401));
    render(<Account />);
    fillPasswordForm('typo');
    expect(await screen.findByText('account.passwordCurrentIncorrect')).toBeInTheDocument();
  });

  it('keeps an open profile edit when the account object is replaced', async () => {
    const { rerender } = render(<Account />);
    fireEvent.click(screen.getByText('account.editDetails'));
    const name = document.querySelector('input[name="name"]') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Jane Cohen' } });

    // A billing poll or a notifications toggle hands back a new user object.
    auth.user = { ...jane, channelType: 'sms' } as Partial<User>;
    rerender(<Account />);
    expect((document.querySelector('input[name="name"]') as HTMLInputElement).value).toBe('Jane Cohen');

    fireEvent.click(screen.getByText('account.saveChanges'));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ name: 'Jane Cohen', phone: '0501234567' }));
  });
});
