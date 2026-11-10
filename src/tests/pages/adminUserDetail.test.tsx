import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminUserDetail from '../../pages/admin/AdminUserDetail';
import { fetchUser, AdminUserDetail as Detail } from '../../services/adminApi';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { _id: 'admin1' } } }) }));
vi.mock('../../components/admin/BillingCard', () => ({ default: (): null => null }));
vi.mock('../../components/admin/UserFormModal', () => ({ default: (): null => null }));
vi.mock('../../services/adminApi', () => ({
  fetchUser: vi.fn(),
  verifyUserEmail: vi.fn(),
  changeUserRole: vi.fn(),
  cancelUserSubscription: vi.fn(),
  resumeUserSubscription: vi.fn(),
  deleteUser: vi.fn(),
}));

const detail = (over: { conversion?: 'book' | 'lead'; monthlyLeads?: number | null } = {}): Detail =>
  ({
    user: {
      _id: 'u9', name: 'Dana', email: 'dana@biz.co', role: 'user', isVerified: true, boardingStatus: 'active',
      subscription: { status: 'free' }, defaultLanguage: 'he', createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    webConfig: { businessName: 'Dana Renovations', subDomain: 'dana', createdAt: '2026-09-01T00:00:00.000Z', conversion: over.conversion },
    plan: 'free',
    limits: {
      monthlyAppointments: 30, maxServices: 3, hourlyReminder: false, aiGenerationsPerMonth: 3, aiEditsPerMonth: 10,
      aiTokensPerMonth: null, showBranding: true, customerInsights: false, customerExport: false,
      monthlyLeads: over.monthlyLeads === undefined ? 15 : over.monthlyLeads,
    },
    usage: { appointmentsThisMonth: 0, servicesCount: 2, aiGenerationsThisMonth: 1, aiTokensThisMonth: 0, leadsThisMonth: 3 },
    counts: { appointmentsTotal: 0, lastBookedAt: null, leadsTotal: 12 },
    recentAppointments: [],
  }) as Detail;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/users/u9']}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetail />} />
      </Routes>
    </MemoryRouter>
  );

/** The usage row whose label is `label`, as "used / limit". */
const usageRow = (label: string) => screen.getByText(label).parentElement as HTMLElement;

/** Admin → user (LT-199): what the site converts to, and its leads against the cap. */
describe('Admin user detail: site mode and leads', () => {
  beforeEach(() => vi.mocked(fetchUser).mockReset());

  it('shows a leads site, its leads total, and this month’s leads against the cap', async () => {
    vi.mocked(fetchUser).mockResolvedValue(detail({ conversion: 'lead' }));
    renderPage();

    const mode = await screen.findByTestId('site-mode');
    // LT-647: the site's kind as the panel's own chip.
    expect(within(mode).getByText('admin.siteKind.lead')).toBeInTheDocument();
    expect(screen.getByTestId('leads-total')).toHaveTextContent('12');
    expect(within(usageRow('admin.userDetail.usage.leads')).getByText('3 / 15')).toBeInTheDocument();
  });

  it("shows the owner's initial in a round avatar (LT-369)", async () => {
    vi.mocked(fetchUser).mockResolvedValue(detail({}));
    renderPage();
    expect(await screen.findByText('D', { exact: true })).toHaveClass('rounded-full');
  });

  it('reads a config without a mode as a booking site, and an uncapped plan as unlimited', async () => {
    vi.mocked(fetchUser).mockResolvedValue(detail({ monthlyLeads: null }));
    renderPage();

    const mode = await screen.findByTestId('site-mode');
    expect(within(mode).getByText('admin.siteKind.book')).toBeInTheDocument();
    expect(within(usageRow('admin.userDetail.usage.leads')).getByText('3 / ∞')).toBeInTheDocument();
  });

  it('a products site shows its inquiries, products, posts and plan, not an empty bookings list (LT-647)', async () => {
    vi.mocked(fetchUser).mockResolvedValue({
      ...detail({ conversion: 'lead' }),
      siteKind: 'products',
      planStanding: 'freeDays',
      counts: { appointmentsTotal: 0, lastBookedAt: null, leadsTotal: 12, lastInquiryAt: '2026-11-09T10:00:00.000Z', productsTotal: 7, postsPublished: 2 },
      recentLeads: [{ _id: 'l1', name: 'Noa', phone: '+972501234567', status: 'new', createdAt: '2026-11-09T10:00:00.000Z' }],
    } as Detail);
    renderPage();

    const mode = await screen.findByTestId('site-mode');
    expect(within(mode).getByText('admin.siteKind.products')).toBeInTheDocument();
    expect(screen.getByTestId('plan-freeDays')).toHaveTextContent('admin.planStanding.freeDays');
    expect(screen.getByTestId('products-total')).toHaveTextContent('7');
    expect(screen.getByTestId('posts-published')).toHaveTextContent('2');
    expect(screen.getByText('admin.userDetail.identity.lastInquiry')).toBeInTheDocument();
    expect(screen.queryByText('admin.userDetail.identity.lastBooked')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('recent-leads')).getByText('Noa')).toBeInTheDocument();
    // No bookings on a products site: no empty bookings card.
    expect(screen.queryByText('admin.userDetail.appointments.none')).not.toBeInTheDocument();
  });
});
