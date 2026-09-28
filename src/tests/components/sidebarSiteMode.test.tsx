import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { fetchLeads } from '../../services/leadsApi';

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
const state = vi.hoisted(() => ({
  webConfig: { data: { businessName: 'Biz', conversion: 'book' as 'book' | 'lead' } },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
vi.mock('../../services/leadsApi', () => ({ fetchLeads: vi.fn() }));

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

/** The sidebar's own links, group by group (the phone tab bar is left out). */
const groupHrefs = (name: string) =>
  within(screen.getByRole('group', { name }))
    .getAllByRole('link')
    .map((a) => a.getAttribute('href'));

/**
 * Navigation by what the site does (LT-199). A booking site keeps today's
 * sidebar; a leads site has no calendar, so no Appointments and no Customers,
 * its leads move into the first group, and its hours are "Opening hours".
 */
describe('Sidebar by site mode', () => {
  beforeEach(() => {
    vi.mocked(fetchLeads).mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 4, page: 1, limit: 1, pages: 4 },
      counts: { new: 4, contacted: 0, closed: 0 },
    });
  });

  it('keeps the booking sidebar on a booking site', () => {
    state.webConfig.data.conversion = 'book';
    renderSidebar();

    expect(groupHrefs('sidebar.navigation')).toEqual(['/', '/ai', '/appointments']);
    expect(groupHrefs('sidebar.manage')).toEqual([
      '/customers', '/leads', '/schedule-vacations', '/appointment-types', '/portfolio', '/settings',
    ]);
    expect(within(screen.getByRole('group', { name: 'sidebar.manage' })).getByText('common.scheduleVacations')).toBeInTheDocument();
  });

  it('drops Appointments and Customers and brings Leads up on a leads site', async () => {
    state.webConfig.data.conversion = 'lead';
    renderSidebar();

    expect(groupHrefs('sidebar.navigation')).toEqual(['/', '/ai', '/leads']);
    expect(groupHrefs('sidebar.manage')).toEqual(['/schedule-vacations', '/appointment-types', '/portfolio', '/settings']);
    const manage = within(screen.getByRole('group', { name: 'sidebar.manage' }));
    expect(manage.getByText('common.openingHours')).toBeInTheDocument();
    expect(manage.queryByText('common.scheduleVacations')).not.toBeInTheDocument();
    // The badge travels with the link.
    const navigation = within(screen.getByRole('group', { name: 'sidebar.navigation' }));
    await waitFor(() => expect(navigation.getByTestId('nav-badge')).toHaveTextContent('4'));
  });
});
