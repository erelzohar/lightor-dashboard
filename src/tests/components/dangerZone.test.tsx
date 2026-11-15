import { describe, it, expect, vi, beforeEach } from 'vitest';
import axe from 'axe-core';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DangerZoneSection from '../../components/account/DangerZoneSection';
import { deleteAccount, getDeletionPreview, AuthRequestError } from '../../services/authApi';
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
  return { ...actual, deleteAccount: vi.fn(), getDeletionPreview: vi.fn() };
});

const openDialog = () => {
  render(<DangerZoneSection />);
  fireEvent.click(screen.getByText('danger.deleteCta'));
};

describe('DangerZoneSection (LT-315)', () => {
  beforeEach(() => {
    vi.mocked(deleteAccount).mockReset();
    // An API that cannot say (older, offline): the dialog goes by the account it has.
    vi.mocked(getDeletionPreview).mockReset().mockResolvedValue(null);
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

/**
 * LT-663 (Erel 2026-11-15): a subscription bought in an app is not cancelled
 * by the delete, and the dialog says so; the bookings still ahead are counted.
 */
describe('DeleteAccountDialog: store subscriptions and upcoming bookings (LT-663)', () => {
  beforeEach(() => {
    vi.mocked(deleteAccount).mockReset().mockResolvedValue(undefined);
    vi.mocked(getDeletionPreview).mockReset().mockResolvedValue(null);
    logout.mockReset();
    navigate.mockReset();
  });

  const typePassword = () => fireEvent.change(screen.getByLabelText('danger.passwordLabel'), { target: { value: 'right1' } });
  const confirmButton = () => screen.getByText('danger.modalConfirm').closest('button') as HTMLButtonElement;

  it('keeps the "cancelled at once" line for a Paddle subscription and for none, with no store warning', async () => {
    authState.user = { email: 'jane@biz.com', hasPassword: true, subscription: { status: 'active', provider: 'paddle' } } as Partial<User>;
    vi.mocked(getDeletionPreview).mockResolvedValue({ futureBookings: 0, storeSubscription: null });
    openDialog();
    await waitFor(() => expect(getDeletionPreview).toHaveBeenCalled());
    expect(screen.getByText('danger.desc')).toBeInTheDocument();
    expect(screen.getByText('danger.consequenceSubscription')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-store-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-future-bookings')).not.toBeInTheDocument();
    typePassword();
    expect(confirmButton()).not.toBeDisabled();
  });

  it.each([
    ['apple', 'https://apps.apple.com/account/subscriptions'],
    ['google', 'https://play.google.com/store/account/subscriptions'],
  ] as const)('%s: says billing continues, links to the store, and waits for the tick', async (store, url) => {
    authState.user = { email: 'jane@biz.com', hasPassword: true, subscription: { status: 'active', provider: store } } as Partial<User>;
    vi.mocked(getDeletionPreview).mockResolvedValue({ futureBookings: 0, storeSubscription: store });
    openDialog();

    // The card and the dialog both drop the "cancels any active subscription" promise.
    expect(screen.getByText('danger.descStore')).toBeInTheDocument();
    expect(screen.queryByText('danger.desc')).not.toBeInTheDocument();
    expect(screen.queryByText('danger.consequenceSubscription')).not.toBeInTheDocument();
    expect(screen.getByText('danger.consequenceStore')).toBeInTheDocument();
    const link = screen.getByTestId('delete-store-manage');
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');

    typePassword();
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(screen.getByLabelText('danger.storeAck'));
    expect(confirmButton()).not.toBeDisabled();
    fireEvent.click(screen.getByLabelText('danger.storeAck'));
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(screen.getByLabelText('danger.storeAck'));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith({ password: 'right1' }));
  });

  it("takes the server's word over a stale account: a store the account did not know of", async () => {
    authState.user = { email: 'jane@biz.com', hasPassword: true, subscription: { status: 'free' } } as Partial<User>;
    vi.mocked(getDeletionPreview).mockResolvedValue({ futureBookings: 0, storeSubscription: 'apple' });
    openDialog();
    expect(await screen.findByTestId('delete-store-warning')).toBeInTheDocument();
    typePassword();
    expect(confirmButton()).toBeDisabled();
  });

  it('warns from the signed-in account when the server cannot say', async () => {
    authState.user = { email: 'jane@biz.com', hasPassword: true, subscription: { status: 'past_due', provider: 'google' } } as Partial<User>;
    openDialog();
    expect(screen.getByTestId('delete-store-warning')).toBeInTheDocument();
    typePassword();
    expect(confirmButton()).toBeDisabled();
  });

  it('gives no store warning for a store subscription that has ended', async () => {
    authState.user = { email: 'jane@biz.com', hasPassword: true, subscription: { status: 'canceled', provider: 'apple' } } as Partial<User>;
    openDialog();
    expect(screen.queryByTestId('delete-store-warning')).not.toBeInTheDocument();
    expect(screen.getByText('danger.consequenceSubscription')).toBeInTheDocument();
  });

  // The same rules as the repo's axe gate (tests/a11y/axe.test.tsx, LT-362).
  it.each(['ltr', 'rtl'] as const)('the store warning has no WCAG A/AA violation axe can see (%s)', async (dir) => {
    document.documentElement.dir = dir;
    document.documentElement.lang = dir === 'rtl' ? 'he' : 'en';
    try {
      authState.user = { email: 'jane@biz.com', hasPassword: true, subscription: { status: 'active', provider: 'apple' } } as Partial<User>;
      vi.mocked(getDeletionPreview).mockResolvedValue({ futureBookings: 4, storeSubscription: 'apple' });
      openDialog();
      await screen.findByTestId('delete-future-bookings');
      const { violations } = await axe.run(document.body, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    } finally {
      document.documentElement.removeAttribute('dir');
      document.documentElement.removeAttribute('lang');
    }
  });

  it('says how many bookings are still ahead, only when there are any', async () => {
    authState.user = { email: 'jane@biz.com', hasPassword: true };
    vi.mocked(getDeletionPreview).mockResolvedValue({ futureBookings: 7, storeSubscription: null });
    openDialog();
    expect(await screen.findByTestId('delete-future-bookings')).toHaveTextContent('danger.consequenceBookings');
  });
});
