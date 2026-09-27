import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { fetchLeads } from '../../services/leadsApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', darkMode: false, toggleDarkMode: vi.fn() }),
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (): unknown => undefined,
}));
vi.mock('../../services/leadsApi', () => ({ fetchLeads: vi.fn() }));

/** The Leads entry (LT-197): in the manage group, with the count of new leads. */
describe('Sidebar leads link', () => {
  it('shows Leads with a badge for the new ones', async () => {
    vi.mocked(useAuth).mockReturnValue({
      logout: vi.fn(),
      auth: { user: { _id: 'u1', name: 'Erel', role: 'user' }, isAuthenticated: true, isLoading: false },
    } as never);
    vi.mocked(fetchLeads).mockResolvedValue({
      success: true, data: [], pagination: { total: 3, page: 1, limit: 1, pages: 3 },
      counts: { new: 3, contacted: 0, closed: 0 },
    });

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getAllByText('common.leads').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByTestId('nav-badge')).toHaveTextContent('3'));
    expect(fetchLeads).toHaveBeenCalledWith({ limit: 1 });
  });
});
