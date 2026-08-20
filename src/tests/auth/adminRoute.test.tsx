import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminRoute from '../../components/auth/AdminRoute';
import { useAuth } from '../../contexts/AuthContext';
import type { AuthState } from '../../types';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

/**
 * The admin panel's route guard (LT-058).
 *
 * UX-only by design — the real boundary is authorize('admin') on the API —
 * but the guard must still route every non-operator away so they never see
 * a broken admin shell.
 */
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
  ({ _id: 'u1', email: 'erel@lightor.app', isVerified: true, role: 'user', ...overrides }) as never;

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/dashboard" element={<div>owner-dashboard</div>} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div>admin-panel</div>
            </AdminRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('AdminRoute', () => {
  it('shows a spinner while auth is loading', () => {
    mockAuth({ isLoading: true });
    const { container } = renderRoute();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('admin-panel')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to login', () => {
    mockAuth({ isAuthenticated: false });
    renderRoute();
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('redirects a business owner to their own dashboard', () => {
    mockAuth({ isAuthenticated: true, user: user({ role: 'user' }) });
    renderRoute();
    expect(screen.getByText('owner-dashboard')).toBeInTheDocument();
    expect(screen.queryByText('admin-panel')).not.toBeInTheDocument();
  });

  it('renders the panel for an admin', () => {
    mockAuth({ isAuthenticated: true, user: user({ role: 'admin' }) });
    renderRoute();
    expect(screen.getByText('admin-panel')).toBeInTheDocument();
  });

  it('does not block an unverified admin (no grace gate on the operator)', () => {
    mockAuth({
      isAuthenticated: true,
      user: user({ role: 'admin', isVerified: false, createdAt: '2020-01-01T00:00:00.000Z' }),
    });
    renderRoute();
    expect(screen.getByText('admin-panel')).toBeInTheDocument();
  });
});
