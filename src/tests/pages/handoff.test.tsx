import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import Handoff from '../../pages/Handoff';
import { currentAccount, handoffAccount, handoffLogin } from '../../services/authApi';
import { fireEvent } from '@testing-library/react';
import { stubLocation } from '../helpers/location';
import { hasSessionHint } from '../../services/sessionHint';

vi.mock('../../services/authApi', () => ({ handoffLogin: vi.fn(), currentAccount: vi.fn(), handoffAccount: vi.fn() }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue ?? key,
  }),
}));

/**
 * The signup handoff landing (LT-030).
 *
 * register.lightor.app sends a brand new account here with a two-minute token
 * in the URL fragment. Everything that can go wrong here is silent: a token
 * read from the query instead of the fragment leaks into server logs, a
 * failed exchange that still navigates drops the user into whatever stale
 * session the browser held — which is the original bug, a tester landing in
 * someone else's account — and a double exchange under StrictMode burns the
 * single-use token before the first attempt returns.
 */
describe('Handoff', () => {
  beforeEach(() => {
    vi.mocked(handoffLogin).mockReset();
    vi.mocked(currentAccount).mockReset().mockResolvedValue(null);
    vi.mocked(handoffAccount).mockReset();
  });

  // LT-635 (LT-631 M4): a link that would replace another account signed in here asks first.
  it('asks before a link replaces another account signed in here', async () => {
    const { replace } = stubLocation('https://dashboard.lightor.app/handoff#t=ho_other');
    vi.mocked(currentAccount).mockResolvedValue({ _id: 'me', email: 'me@example.com' });
    vi.mocked(handoffAccount).mockResolvedValue({ _id: 'them', email: 'them@example.com' });
    vi.mocked(handoffLogin).mockResolvedValue({ token: 'jwt', user: { _id: 'them' } as never });

    render(<Handoff />);

    await waitFor(() => expect(screen.getByTestId('handoff-switch')).toBeTruthy());
    expect(handoffLogin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Stay in my account'));
    expect(replace).toHaveBeenCalledWith('/');
    expect(handoffLogin).not.toHaveBeenCalled();
  });

  it('switches when the owner says so', async () => {
    const { replace } = stubLocation('https://dashboard.lightor.app/handoff#t=ho_other');
    vi.mocked(currentAccount).mockResolvedValue({ _id: 'me', email: 'me@example.com' });
    vi.mocked(handoffAccount).mockResolvedValue({ _id: 'them', email: 'them@example.com' });
    vi.mocked(handoffLogin).mockResolvedValue({ token: 'jwt', user: { _id: 'them' } as never });

    render(<Handoff />);

    await waitFor(() => expect(screen.getByTestId('handoff-switch')).toBeTruthy());
    fireEvent.click(screen.getByText('Switch to the new account'));
    await waitFor(() => expect(handoffLogin).toHaveBeenCalledWith('ho_other'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('goes straight through for the account already signed in', async () => {
    const { replace } = stubLocation('https://dashboard.lightor.app/handoff#t=ho_same');
    vi.mocked(currentAccount).mockResolvedValue({ _id: 'me', email: 'me@example.com' });
    vi.mocked(handoffAccount).mockResolvedValue({ _id: 'me', email: 'me@example.com' });
    vi.mocked(handoffLogin).mockResolvedValue({ token: 'jwt', user: { _id: 'me' } as never });

    render(<Handoff />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByTestId('handoff-switch')).toBeNull();
  });

  it('exchanges the token from the URL fragment', async () => {
    stubLocation('https://dashboard.lightor.app/handoff#t=ho_abc123');
    vi.mocked(handoffLogin).mockResolvedValue({ token: 'jwt', user: { _id: 'u1' } as never });

    render(<Handoff />);

    await waitFor(() => expect(handoffLogin).toHaveBeenCalledWith('ho_abc123'));
  });

  it('lands on the dashboard with a full page load', async () => {
    // Not client-side routing: the exchange set the HttpOnly cookie, and only
    // a fresh load makes AuthContext initialise from it.
    const { replace } = stubLocation('https://dashboard.lightor.app/handoff#t=ho_abc123');
    vi.mocked(handoffLogin).mockResolvedValue({ token: 'jwt', user: { _id: 'u1' } as never });

    render(<Handoff />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('marks the browser as signed in, so the next load asks /auth/me (LT-315)', async () => {
    // Without the LT-164 hint a browser that never signed in skips the probe,
    // and a brand new signup landed on the login page instead of its account.
    const { replace } = stubLocation('https://dashboard.lightor.app/handoff#t=ho_abc123');
    vi.mocked(handoffLogin).mockResolvedValue({ token: 'jwt', user: { _id: 'u1' } as never });
    expect(hasSessionHint()).toBe(false);

    render(<Handoff />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(hasSessionHint()).toBe(true);
  });

  it('reads a token that is not the first fragment parameter', async () => {
    stubLocation('https://dashboard.lightor.app/handoff#lang=he&t=ho_second');
    vi.mocked(handoffLogin).mockResolvedValue({ token: 'jwt', user: { _id: 'u1' } as never });

    render(<Handoff />);

    await waitFor(() => expect(handoffLogin).toHaveBeenCalledWith('ho_second'));
  });

  it('stops at the token boundary', async () => {
    stubLocation('https://dashboard.lightor.app/handoff#t=ho_abc123&lang=he');
    vi.mocked(handoffLogin).mockResolvedValue({ token: 'jwt', user: { _id: 'u1' } as never });

    render(<Handoff />);

    await waitFor(() => expect(handoffLogin).toHaveBeenCalledWith('ho_abc123'));
  });

  it('exchanges once even when StrictMode mounts twice', async () => {
    // The token is single-use; a second exchange races the first and the loser
    // shows an expired-link error on a signup that actually worked.
    stubLocation('https://dashboard.lightor.app/handoff#t=ho_abc123');
    vi.mocked(handoffLogin).mockResolvedValue({ token: 'jwt', user: { _id: 'u1' } as never });

    render(
      <StrictMode>
        <Handoff />
      </StrictMode>
    );

    await waitFor(() => expect(handoffLogin).toHaveBeenCalledTimes(1));
  });

  it('shows the expired-link state when the fragment carries no token', async () => {
    const { replace } = stubLocation('https://dashboard.lightor.app/handoff');

    render(<Handoff />);

    expect(await screen.findByText('The sign-in link has expired')).toBeInTheDocument();
    expect(handoffLogin).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('never navigates on a failed exchange', async () => {
    // The whole point of the handoff is that it overwrites the browser's
    // existing session. If the exchange failed, that session is untouched —
    // navigating anyway is what silently drops a new signup into an old
    // account.
    const { replace } = stubLocation('https://dashboard.lightor.app/handoff#t=ho_expired');
    vi.mocked(handoffLogin).mockRejectedValue(new Error('Handoff failed'));

    render(<Handoff />);

    expect(await screen.findByText('The sign-in link has expired')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('offers a way out of the failed state', async () => {
    stubLocation('https://dashboard.lightor.app/handoff');

    render(<Handoff />);

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows progress while the exchange is in flight', () => {
    stubLocation('https://dashboard.lightor.app/handoff#t=ho_abc123');
    vi.mocked(handoffLogin).mockReturnValue(new Promise(() => {}));

    render(<Handoff />);

    expect(screen.getByText('Signing you in to your account...')).toBeInTheDocument();
  });
});
