import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ForgotPassword from '../../pages/ForgotPassword';
import ResetPassword from '../../pages/ResetPassword';
import { SignInCard } from '../../components/ui/sign-in-card-2';
import { requestPasswordReset, resetPassword, AuthRequestError } from '../../services/authApi';
import { saveSession } from '../../services/nativeSession';
import { hasSessionHint } from '../../services/sessionHint';
import { passwordProblem } from '../../utils/passwordRules';
import { stubLocation } from '../helpers/location';

/**
 * LT-315 — the way back in without the password: "Forgot password?" on the
 * sign-in card, the request page (which never says whether an account
 * exists), and the emailed link's page, which signs the owner in.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { dir: () => 'rtl' } }) }));
vi.mock('../../services/authApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/authApi')>();
  return { ...actual, requestPasswordReset: vi.fn(), resetPassword: vi.fn() };
});
vi.mock('../../services/nativeSession', () => ({ saveSession: vi.fn(async () => undefined) }));

const Where = () => {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}|{JSON.stringify(location.state)}</p>;
};

const at = (path: string, state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/login" element={<SignInCard onSubmit={async () => {}} onGoogleLogin={() => {}} onFacebookLogin={() => {}} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

describe('password rules (LT-315)', () => {
  it('match the register form: 6+ printable ASCII with a letter and a digit', () => {
    expect(passwordProblem('ab1')).toBe('min');
    expect(passwordProblem('abcdef')).toBe('complex');
    expect(passwordProblem('123456')).toBe('complex');
    expect(passwordProblem('סיסמה123')).toBe('ascii');
    expect(passwordProblem('abc123')).toBeNull();
    expect(passwordProblem('a b!c 9')).toBeNull();
  });
});

describe('forgot password (LT-315)', () => {
  beforeEach(() => {
    vi.mocked(requestPasswordReset).mockReset();
  });

  it('the sign-in card links to it and hands over the typed email', () => {
    at('/login');
    fireEvent.change(screen.getByPlaceholderText('login.enterEmail'), { target: { value: 'jane@biz.com' } });
    fireEvent.click(screen.getByText('login.forgotPassword'));
    expect(screen.getByText('forgotPassword.title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('login.enterEmail')).toHaveValue('jane@biz.com');
  });

  it('sends the request and says the same thing whatever the answer', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined);
    at('/forgot-password');
    fireEvent.change(screen.getByPlaceholderText('login.enterEmail'), { target: { value: ' jane@biz.com ' } });
    fireEvent.click(screen.getByText('forgotPassword.submit'));

    expect(await screen.findByText('forgotPassword.sent')).toBeInTheDocument();
    expect(requestPasswordReset).toHaveBeenCalledWith('jane@biz.com');
    expect(screen.getByText('jane@biz.com')).toHaveAttribute('dir', 'ltr');
  });

  it('tells a rate-limited owner to wait', async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(new AuthRequestError('Too many', 429));
    at('/forgot-password');
    fireEvent.change(screen.getByPlaceholderText('login.enterEmail'), { target: { value: 'jane@biz.com' } });
    fireEvent.click(screen.getByText('forgotPassword.submit'));
    expect(await screen.findByText('forgotPassword.tooMany')).toBeInTheDocument();
    expect(screen.queryByText('forgotPassword.sent')).not.toBeInTheDocument();
  });

  it('leads back to sign in', () => {
    at('/forgot-password');
    expect(screen.getByText('forgotPassword.backToLogin').closest('a')).toHaveAttribute('href', '/login');
  });
});

describe('reset password (LT-315)', () => {
  beforeEach(() => {
    vi.mocked(resetPassword).mockReset();
    vi.mocked(saveSession).mockClear();
  });

  const fill = (password: string, confirm = password) => {
    fireEvent.change(screen.getByPlaceholderText('resetPassword.newPassword'), { target: { value: password } });
    fireEvent.change(screen.getByPlaceholderText('resetPassword.confirmPassword'), { target: { value: confirm } });
    fireEvent.click(screen.getByText('resetPassword.submit'));
  };

  it('holds a password the register form would refuse, or two that differ', () => {
    at('/reset-password/tok123');
    fill('abcdef');
    expect(screen.getByText('resetPassword.rule.complex')).toBeInTheDocument();
    fill('abc123', 'abc124');
    expect(screen.getByText('resetPassword.mismatch')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('sets the password, keeps the session and lands signed in', async () => {
    const { replace } = stubLocation('https://dashboard.lightor.app/reset-password/tok123');
    vi.mocked(resetPassword).mockResolvedValue({ token: 'jwt' });
    at('/reset-password/tok123');
    fill('newpass1');

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(resetPassword).toHaveBeenCalledWith('tok123', 'newpass1');
    expect(saveSession).toHaveBeenCalledWith('jwt');
    // Without the hint the next load would skip /auth/me and show the login page.
    expect(hasSessionHint()).toBe(true);
  });

  it('offers a new link when this one is invalid or expired', async () => {
    vi.mocked(resetPassword).mockRejectedValue(new AuthRequestError('Invalid or expired token', 400));
    at('/reset-password/old');
    fill('newpass1');

    expect(await screen.findByText('resetPassword.invalidLink')).toBeInTheDocument();
    fireEvent.click(screen.getByText('resetPassword.requestNew'));
    expect(screen.getByText('forgotPassword.title')).toBeInTheDocument();
  });

  it('keeps the form on any other failure', async () => {
    vi.mocked(resetPassword).mockRejectedValue(new AuthRequestError('boom', 500));
    at('/reset-password/tok');
    fill('newpass1');
    expect(await screen.findByText('resetPassword.failed')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('resetPassword.newPassword')).toBeInTheDocument();
  });
});
