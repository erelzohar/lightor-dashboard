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

const mockOwner = () => {
  vi.mocked(useAuth).mockReturnValue({
    logout: vi.fn(),
    auth: {
      user: { _id: 'u1', name: 'Erel', role: 'user', subscription: { status: 'free' } },
      isAuthenticated: true,
      isLoading: false,
    },
  } as never);
};

/** The Customers entry (LT-122) is a regular owner page — every plan, every role. */
describe('Sidebar customers link', () => {
  it('shows Customers to a business owner', () => {
    mockOwner();
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    // Twice since LT-127: the desktop rail and the phone tab bar both list it.
    expect(screen.getAllByText('common.customers').length).toBeGreaterThan(0);
  });

  it('hides it for a restricted (not-yet-onboarded) account, like the other manage links', () => {
    mockOwner();
    render(
      <MemoryRouter>
        <Sidebar isRestricted />
      </MemoryRouter>
    );
    expect(screen.queryAllByText('common.customers')).toHaveLength(0);
    expect(screen.getAllByText('common.dashboard').length).toBeGreaterThan(0);
  });
});
