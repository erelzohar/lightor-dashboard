import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Customers from '../../pages/Customers';
import { fetchCustomers, fetchCustomerStats, exportCustomersCsv } from '../../services/customersApi';

// `t` must be referentially stable across renders, as the real react-i18next
// one is: the page memoises its loader on `t`, and a fresh function per render
// would re-fire the fetch effect forever (skeleton never resolves).
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { language: 'en' } }),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', darkMode: false, language: 'en' }),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }),
}));
vi.mock('../../hooks/useAppSelector', () => ({ useAppSelector: () => [] }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../services/customersApi', () => ({
  fetchCustomers: vi.fn(),
  fetchCustomerStats: vi.fn(),
  fetchCustomer: vi.fn(),
  exportCustomersCsv: vi.fn(),
  createCustomer: vi.fn(),
  setCustomerBlock: vi.fn(),
  setCustomerNotes: vi.fn(),
  isApiErrorCode: () => false,
  apiErrorStatus: () => undefined,
}));

const row = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  _id: id,
  name,
  phone: '0584006014',
  phoneNormalized: '+972584006014',
  isBlocked: false,
  blockedAt: null,
  source: 'booking',
  firstSeenAt: '2026-01-01T00:00:00.000Z',
  lastSeenAt: '2026-06-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  visits: 3,
  cancelled: 0,
  upcoming: 1,
  revenue: 300,
  lastVisit: '2026-06-01T00:00:00.000Z',
  nextVisit: null,
  ...extra,
});

/** The Customers page (LT-122): list + stats from the API, export through it. */
describe('Customers page', () => {
  beforeEach(() => {
    vi.mocked(fetchCustomers).mockResolvedValue({
      success: true,
      count: 2,
      pagination: { total: 2, page: 1, limit: 20, pages: 1 },
      data: [row('c1', 'Dana Levi'), row('c2', 'Moshe Cohen', { isBlocked: true, visits: 1 })],
    } as never);
    vi.mocked(fetchCustomerStats).mockResolvedValue({
      totals: { customers: 2, blocked: 1, newThisMonth: 1, returning: 1 },
      top: {
        byVisits: [{ customerId: 'c1', name: 'Dana Levi', phone: '0584006014', visits: 3, revenue: 300, isBlocked: false }],
        byRevenue: [],
      },
    } as never);
    vi.mocked(exportCustomersCsv).mockResolvedValue(undefined);
  });

  it('renders the rows, the totals and the top list from the API', async () => {
    render(<Customers />);

    expect(await screen.findByText('Moshe Cohen')).toBeInTheDocument();
    expect(screen.getAllByText('Dana Levi').length).toBeGreaterThan(0); // table row + top list
    expect(screen.getByText('customers.status.blocked')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('customers.stats.blocked').parentElement).toHaveTextContent('1'));

    expect(fetchCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, sort: 'lastSeenAt', order: 'desc' })
    );
  });

  it('exports with the active filter through the API client', async () => {
    render(<Customers />);
    await screen.findByText('Moshe Cohen');

    fireEvent.click(screen.getByText('customers.export.button'));

    await waitFor(() => expect(exportCustomersCsv).toHaveBeenCalledWith({ search: undefined, blocked: undefined }));
  });
});
