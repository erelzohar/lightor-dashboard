import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Customers from '../../pages/Customers';
import { fetchCustomers, fetchCustomerStats, type CustomerRow } from '../../services/customersApi';

/**
 * LT-376 — the Customers page on a leads site: the table counts what each
 * customer wrote, and the visit-only parts (returning, top customers,
 * revenue) are left out.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), Link: (): null => null }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr', darkMode: false, language: 'en' }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }) }));
const state = vi.hoisted(() => ({ webConfig: { data: { conversion: 'lead' } } }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: (): (() => void) => vi.fn() }));
vi.mock('../../services/customersApi', () => ({
  fetchCustomers: vi.fn(),
  fetchCustomerStats: vi.fn(),
  fetchCustomer: vi.fn(),
  exportCustomersCsv: vi.fn(),
  createCustomer: vi.fn(),
  setCustomerBlock: vi.fn(),
  setCustomerNotes: vi.fn(),
  isApiErrorCode: () => false,
  apiErrorStatus: (): undefined => undefined,
}));

const row: CustomerRow = {
  _id: 'c1', name: 'Rona', phone: '0547654321', phoneNormalized: '+972547654321', isBlocked: false, blockedAt: null,
  source: 'lead', firstSeenAt: '2026-09-01T00:00:00.000Z', lastSeenAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z',
  visits: 0, cancelled: 0, upcoming: 0, revenue: 0, lastVisit: null, nextVisit: null,
  inquiries: 3, lastInquiry: '2026-10-01T00:00:00.000Z',
};
const stats = {
  totals: { customers: 1, blocked: 0, newThisMonth: 1, returning: 0 },
  top: { byVisits: [] as unknown[], byRevenue: [] as unknown[] },
  entitlements: { insights: false, export: true },
};

describe('Customers page on a leads site (LT-376)', () => {
  beforeEach(() => {
    vi.mocked(fetchCustomerStats).mockResolvedValue(stats as never);
  });

  it('counts what each customer wrote, and leaves out visits, revenue, returning and the top lists', async () => {
    vi.mocked(fetchCustomers).mockResolvedValue({
      success: true, count: 1, pagination: { total: 1, page: 1, limit: 20, pages: 1 }, data: [row],
    } as never);
    render(<Customers />);

    expect(await screen.findByText('Rona')).toBeInTheDocument();
    expect(screen.getByText('customers.columns.inquiries')).toBeInTheDocument();
    expect(screen.getByText('customers.columns.lastInquiry')).toBeInTheDocument();
    expect(screen.getByText('Rona').closest('tr')).toHaveTextContent('3');
    expect(screen.queryByText('customers.columns.visits')).toBeNull();
    expect(screen.queryByText('customers.columns.revenue')).toBeNull();
    expect(screen.queryByText('customers.stats.returning')).toBeNull();
    // Not even the Plus card for the top lists: they are about visits.
    expect(screen.queryByText('customers.upgrade.insightsTitle')).toBeNull();
    expect(screen.getByText('customers.stats.newThisMonth')).toBeInTheDocument();
  });

  it('an empty list waits for the first inquiry, not the first booking', async () => {
    vi.mocked(fetchCustomers).mockResolvedValue({
      success: true, count: 0, pagination: { total: 0, page: 1, limit: 20, pages: 0 }, data: [],
    } as never);
    render(<Customers />);
    expect(await screen.findByText('customers.emptyLeads')).toBeInTheDocument();
  });
});
