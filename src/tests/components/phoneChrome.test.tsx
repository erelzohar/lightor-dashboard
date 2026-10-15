import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    auth: { user: { _id: 'u1', name: 'Erel', role: 'user' }, isAuthenticated: true, isLoading: false },
  }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', darkMode: false, toggleDarkMode: vi.fn() }),
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({ webConfig: { data: { businessName: 'Biz', conversion: 'book' } } }),
}));
vi.mock('../../services/leadsApi', () => ({
  fetchLeads: vi.fn().mockResolvedValue({ success: true, data: [], counts: { new: 0 } }),
}));

/**
 * LT-210: the phone's top bar held nothing but a menu button, duplicating the
 * tab bar's "More" and taking a row of screen under the status bar. It is
 * gone; "More" is the one way into the full menu, which since LT-352 is a
 * sheet of tiles rising out of the bar, not a side drawer.
 */
describe('phone chrome', () => {
  it('has one menu button, the tab bar\'s "More", and it opens the menu', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    const openers = screen.getAllByRole('button', { name: 'sidebar.openMenu' });
    expect(openers).toHaveLength(1);
    expect(screen.getByTestId('bottom-tab-bar')).toContainElement(openers[0]);

    expect(screen.queryByRole('dialog', { name: 'sidebar.menu' })).toBeNull();
    fireEvent.click(openers[0]);
    expect(screen.getByRole('dialog', { name: 'sidebar.menu' })).toBeInTheDocument();
  });
});
