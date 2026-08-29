import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';
import type { AuthState } from '../../types';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/auth/VerifyEmailGate', () => ({
  default: () => <div>verify-gate</div>,
}));

const mockAuth = (state: Partial<AuthState>) => {
  vi.mocked(useAuth).mockReturnValue({
    auth: {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      ...state,
    },
  } as never);
};

const user = (overrides: Record<string, unknown> = {}) =>
  ({ _id: 'u1', email: 'jane@biz.com', isVerified: false, ...overrides }) as never;

const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000).toISOString();

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<div>login-page</div>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>dashboard-content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

/**
 * The 48-hour verification grace window (LT-009).
 *
 * Two opposite failures matter here. Gating immediately walls off a signup
 * from the site they just built with the AI wizard — the worst possible first
 * minute. Never gating is what the old dismissible banner did, which made
 * "verify your email" a suggestion an account could ignore forever. The
 * window is the compromise, so both of its ends are pinned down.
 */
describe('ProtectedRoute', () => {
  it('waits rather than redirecting while the session resolves', () => {
    // /auth/me is in flight. Deciding "not authenticated" here bounces every
    // signed-in user to the login page on every hard refresh.
    mockAuth({ isLoading: true });

    renderRoute();

    expect(screen.queryByText('login-page')).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to login', () => {
    mockAuth({ isAuthenticated: false });

    renderRoute();

    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('lets a verified account through', () => {
    mockAuth({ isAuthenticated: true, user: user({ isVerified: true, createdAt: hoursAgo(500) }) });

    renderRoute();

    expect(screen.getByText('dashboard-content')).toBeInTheDocument();
  });

  it('lets a fresh unverified signup through', () => {
    mockAuth({ isAuthenticated: true, user: user({ createdAt: hoursAgo(1) }) });

    renderRoute();

    expect(screen.getByText('dashboard-content')).toBeInTheDocument();
  });

  it('still lets an unverified account through at 47 hours', () => {
    mockAuth({ isAuthenticated: true, user: user({ createdAt: hoursAgo(47) }) });

    renderRoute();

    expect(screen.getByText('dashboard-content')).toBeInTheDocument();
  });

  it('gates an unverified account past 49 hours', () => {
    mockAuth({ isAuthenticated: true, user: user({ createdAt: hoursAgo(49) }) });

    renderRoute();

    expect(screen.getByText('verify-gate')).toBeInTheDocument();
    expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
  });

  it('gates an unverified account with no creation timestamp', () => {
    // Fail toward the gate: an account whose age cannot be established must
    // not get an unbounded grace period.
    mockAuth({ isAuthenticated: true, user: user({ createdAt: undefined }) });

    renderRoute();

    expect(screen.getByText('verify-gate')).toBeInTheDocument();
  });

  it('never gates a verified account, however old', () => {
    // Social signups arrive verified and must never see this screen.
    mockAuth({ isAuthenticated: true, user: user({ isVerified: true, createdAt: hoursAgo(9000) }) });

    renderRoute();

    expect(screen.getByText('dashboard-content')).toBeInTheDocument();
  });
});
