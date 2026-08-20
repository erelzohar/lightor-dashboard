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
 * The sidebar's admin entry (LT-058): visible only to role 'admin'. This is
 * the first place the app ever reads auth.user.role — display logic only,
 * the API refuses non-admins regardless.
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
      <Sidebar isOpen toggleSidebar={vi.fn()} />
    </MemoryRouter>
  );

describe('Sidebar admin link', () => {
  it('shows the admin section for an admin', () => {
    mockAuthWithRole('admin');
    renderSidebar();
    expect(screen.getByText('common.adminPanel')).toBeInTheDocument();
  });

  it('hides the admin section from a business owner', () => {
    mockAuthWithRole('user');
    renderSidebar();
    expect(screen.queryByText('common.adminPanel')).not.toBeInTheDocument();
  });
});
