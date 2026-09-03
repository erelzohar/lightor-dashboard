import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', darkMode: false, toggleDarkMode: vi.fn() }),
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: () => undefined,
}));

/**
 * The sidebar's admin section (LT-058): visible only to role 'admin'. This is
 * the first place the app ever reads auth.user.role — display logic only,
 * the API refuses non-admins regardless. Since the admin panel merged into
 * the owner layout, the section carries the admin pages directly.
 */
const mockAuthWithRole = (role: string) => {
  vi.mocked(useAuth).mockReturnValue({
    logout: vi.fn(),
    auth: {
      user: { _id: 'u1', name: 'Erel', role, subscription: { status: 'free' } },
      isAuthenticated: true,
      isLoading: false,
    },
  } as never);
};

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

const ADMIN_LINKS = [
  'admin.nav.overview',
  'admin.nav.users',
  'admin.nav.appointments',
  'admin.nav.subscriptions',
  'admin.nav.costs',
];

describe('Sidebar admin section', () => {
  it('shows the admin links for an admin', () => {
    mockAuthWithRole('admin');
    renderSidebar();
    for (const key of ADMIN_LINKS) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  it('hides the admin links from a business owner', () => {
    mockAuthWithRole('user');
    renderSidebar();
    for (const key of ADMIN_LINKS) {
      expect(screen.queryByText(key)).not.toBeInTheDocument();
    }
  });
});
