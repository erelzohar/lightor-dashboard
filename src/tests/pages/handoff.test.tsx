import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import Handoff from '../../pages/Handoff';
import { handoffLogin } from '../../services/authApi';
import { stubLocation } from '../helpers/location';

vi.mock('../../services/authApi', () => ({ handoffLogin: vi.fn() }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
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

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
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
