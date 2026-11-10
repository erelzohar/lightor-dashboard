import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { PhoneMenu } from '../../components/layout/PhoneMenu';
import { fetchLeads } from '../../services/leadsApi';
import { Wallet } from 'lucide-react';

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
  webConfig: { data: { businessName: 'Biz', conversion: 'book' as 'book' | 'lead', catalog: false, appointmentTypes: [] as unknown[], components: { portfolio: { items: [] as unknown[] } } } },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
vi.mock('../../services/leadsApi', () => ({ fetchLeads: vi.fn() }));
vi.mock('../../services/postsApi', () => ({ hasBlog: () => Promise.resolve(true) }));

const renderSidebar = (isRestricted = false) =>
  render(
    <MemoryRouter>
      <Sidebar isRestricted={isRestricted} />
    </MemoryRouter>
  );

/**
 * LT-646 (Erel 2026-11-10): "Payments & orders" - one day the card
 * processing, the products' orders and the refunds. For now only its place in
 * the menu, marked "soon", and not a link.
 */
describe('Payments & orders: a "soon" item in the menu (LT-646)', () => {
  beforeEach(() => {
    vi.mocked(fetchLeads).mockResolvedValue({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, limit: 1, pages: 0 },
      counts: { new: 0, contacted: 0, closed: 0 },
    });
  });

  it.each([
    ['a booking site', 'book' as const, false],
    ['a leads site', 'lead' as const, false],
    ['a products site', 'lead' as const, true],
  ])('sits in Manage on %s, says "soon", and links nowhere', (_name, conversion, catalog) => {
    state.webConfig.data.conversion = conversion;
    state.webConfig.data.catalog = catalog;
    renderSidebar();

    const manage = screen.getByRole('group', { name: 'sidebar.manage' });
    const item = within(manage).getByTestId('nav-soon-item');
    expect(item).toHaveTextContent('common.paymentsOrders');
    expect(within(item).getByTestId('nav-soon')).toHaveTextContent('sidebar.soon');
    // A screen reader hears the name and "soon" even with the rail folded.
    expect(within(item).getByText('common.paymentsOrders (sidebar.soon)')).toHaveClass('sr-only');
    // Not a link: nothing to open yet.
    expect(item.closest('a')).toBeNull();
    expect(within(manage).queryByRole('link', { name: /common\.paymentsOrders/ })).toBeNull();
    // Just before Settings.
    const links = within(manage).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links[links.length - 1]).toBe('/settings');
    expect(item.nextElementSibling?.getAttribute('href')).toBe('/settings');
  });

  it('stays out of a restricted account, as the other pages do', () => {
    state.webConfig.data.conversion = 'book';
    state.webConfig.data.catalog = false;
    renderSidebar(true);
    expect(screen.queryByTestId('nav-soon-item')).toBeNull();
  });

  it('the phone menu shows it as a dimmed tile with its "soon" pill, not a link', () => {
    render(
      <MemoryRouter>
        <PhoneMenu
          sections={[{ id: 'pages', label: '', items: [{ path: '/payments', Icon: Wallet, name: 'Payments & orders', soon: 'Soon' }] }]}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );
    const tile = screen.getByTestId('menu-soon-item');
    expect(within(tile).getByTestId('menu-soon')).toHaveTextContent('Soon');
    expect(within(tile).getByText('Payments & orders (Soon)')).toHaveClass('sr-only');
    expect(tile.closest('a')).toBeNull();
    expect(screen.queryByRole('link', { name: /Payments/ })).toBeNull();
  });
});
