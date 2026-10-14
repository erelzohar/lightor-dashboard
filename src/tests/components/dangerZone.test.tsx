import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DangerZoneSection from '../../components/account/DangerZoneSection';
import { deleteAccount, AuthRequestError } from '../../services/authApi';
import type { User } from '../../types';

/**
 * LT-315 (H6) — account deletion picks its proof from `hasPassword`, and a
 * wrong or missing password is the dialog's field error, never a logout.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
const { navigate, logout, authState } = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  authState: { user: null as Partial<User> | null },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: authState.user }, logout }),
}));
vi.mock('../../services/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/authApi')>();
  return { ...actual, deleteAccount: vi.fn() };
});

const openDialog = () => {
  render(<DangerZoneSection />);
  fireEvent.click(screen.getByText('danger.deleteCta'));
};

describe('DangerZoneSection (LT-315)', () => {
  beforeEach(() => {
    vi.mocked(deleteAccount).mockReset();
    logout.mockReset();
    navigate.mockReset();
  });

  it('asks a Google-linked account that has a password for the password', () => {
    authState.user = { email: 'jane@biz.com', googleId: 'g1', hasPassword: true };
    openDialog();
    expect(screen.getByLabelText('danger.passwordLabel')).toBeInTheDocument();
  });

  it('asks a social account without a password for its email', () => {
    authState.user = { email: 'jane@biz.com', googleId: 'g1', hasPassword: false };
    openDialog();
    expect(screen.queryByLabelText('danger.passwordLabel')).not.toBeInTheDocument();
    expect(screen.getByLabelText('danger.confirmEmailLabel')).toBeInTheDocument();
  });

  it('falls back to guessing from the social ids on an API without hasPassword', () => {
    authState.user = { email: 'jane@biz.com', googleId: 'g1' };
    openDialog();
    expect(screen.getByLabelText('danger.confirmEmailLabel')).toBeInTheDocument();
  });

  it('shows a wrong password under the field and stays signed in', async () => {
    authState.user = { email: 'jane@biz.com', hasPassword: true };
    vi.mocked(deleteAccount).mockRejectedValue(new AuthRequestError('Incorrect password', 400, 'WRONG_PASSWORD'));
    openDialog();
    fireEvent.change(screen.getByLabelText('danger.passwordLabel'), { target: { value: 'typo' } });
    fireEvent.click(screen.getByText('danger.modalConfirm'));

    expect(await screen.findByText('danger.wrongPassword')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    // Typing again clears it.
    fireEvent.change(screen.getByLabelText('danger.passwordLabel'), { target: { value: 'typo2' } });
    expect(screen.queryByText('danger.wrongPassword')).not.toBeInTheDocument();
  });

  it('switches to the password when the server says one is required', async () => {
    authState.user = { email: 'jane@biz.com', googleId: 'g1' };
    vi.mocked(deleteAccount).mockRejectedValue(new AuthRequestError('Password is required to delete this account', 400, 'PASSWORD_REQUIRED'));
    openDialog();
    fireEvent.change(screen.getByLabelText('danger.confirmEmailLabel'), { target: { value: 'jane@biz.com' } });
    fireEvent.click(screen.getByText('danger.modalConfirm'));

    await waitFor(() => expect(screen.getByLabelText('danger.passwordLabel')).toBeInTheDocument());
    expect(screen.getByText('danger.passwordNeeded')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it('logs out and leaves once the account is deleted', async () => {
    authState.user = { email: 'jane@biz.com', hasPassword: true };
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    openDialog();
    fireEvent.change(screen.getByLabelText('danger.passwordLabel'), { target: { value: 'right1' } });
    fireEvent.click(screen.getByText('danger.modalConfirm'));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(deleteAccount).toHaveBeenCalledWith({ password: 'right1' });
  });

  it('says under the field when the typed email is not the account\'s (400 EMAIL_MISMATCH)', async () => {
    authState.user = { email: 'jane@biz.com', googleId: 'g1', hasPassword: false };
    vi.mocked(deleteAccount).mockRejectedValue(new AuthRequestError('Confirmation email does not match', 400, 'EMAIL_MISMATCH'));
    openDialog();
    // Case and spaces pass the button; the server has the last word.
    fireEvent.change(screen.getByLabelText('danger.confirmEmailLabel'), { target: { value: 'JANE@biz.com' } });
    fireEvent.click(screen.getByText('danger.modalConfirm'));
    expect(await screen.findByText('danger.emailMismatch')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });
});

