import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminOverview from '../../pages/admin/AdminOverview';
import { fetchOverview, fetchTimeseries, fetchTopBusinesses, AdminOverview as Overview } from '../../services/adminApi';

const { t } = vi.hoisted(() => ({
  t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${JSON.stringify(opts)}` : key),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { language: 'en' } }),
  // The error boundary's import chain reaches the i18n setup.
  initReactI18next: { type: '3rdParty', init: (): void => undefined },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ darkMode: false, direction: 'ltr' }) }));
vi.mock('../../components/admin/AppInstallsCard', () => ({ default: (): null => null }));
// The signups chart measures its box (ResizeObserver, absent in jsdom); not under test here.
vi.mock('recharts', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Nothing = (): null => null;
  return { ResponsiveContainer: Box, BarChart: Box, Bar: Nothing, XAxis: Nothing, YAxis: Nothing, Tooltip: Nothing };
});
// The widgets' error boundary reads the signed-in owner's language; not under test here.
vi.mock('../../components/ui/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../../services/adminApi', () => ({
  fetchOverview: vi.fn(),
  fetchTimeseries: vi.fn(),
  fetchTopBusinesses: vi.fn(),
}));

const overview = (over: Partial<Overview> = {}): Overview => ({
  totals: {
    businesses: 10,
    verified: 8,
    byBoardingStatus: { onboarded: 7, new: 3 },
    bySubscriptionStatus: { active: 3, free: 6, past_due: 1 },
    appointmentsTotal: 40,
    appointmentsThisMonth: 9,
  },
  sites: { book: 4, lead: 2, products: 1, none: 3 },
  activity: { bookingsThisMonth: 9, bookingsTotal: 40, inquiriesThisMonth: 5, inquiriesTotal: 21, products: 12, postsPublished: 4 },
  plans: { free: 4, freeDays: 3, plus: 2, pro: 1, sandbox: 0 },
  stores: { paddle: 1, apple: 1, google: 1 },
  funnel: { signedUp: 10, onboarded: 7, verified: 8, paying: 3 },
  mrr: { activeMonthly: 3, activeYearly: 0, mrrILS: 297, estimated: true },
  paddleEnv: 'production',
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminOverview />
    </MemoryRouter>
  );

/**
 * LT-647 (Erel 2026-11-10): the overview spoke of bookings alone. It counts
 * the sites by kind, the month's bookings AND inquiries, the plans by Lightor+
 * / Pro and by store, and ranks the businesses on both.
 */
describe('Admin overview for every kind of site (LT-647)', () => {
  beforeEach(() => {
    vi.mocked(fetchTimeseries).mockResolvedValue([]);
    vi.mocked(fetchTopBusinesses).mockResolvedValue([
      { userId: 'u1', bookings: 0, inquiries: 6, total: 6, siteKind: 'products', businessName: 'Ring Shop', subDomain: 'ring-shop' },
      { userId: 'u2', bookings: 4, inquiries: 1, total: 5, siteKind: 'book', businessName: 'Glow Nails', subDomain: 'glow' },
    ]);
  });

  it('shows the sites by kind, the activity, the plans by store and the busiest businesses', async () => {
    vi.mocked(fetchOverview).mockResolvedValue(overview());
    renderPage();

    // The month: bookings and inquiries together.
    expect(await screen.findByText('admin.overview.kpi.activityThisMonth')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('admin.overview.kpi.activitySplit {"bookings":9,"inquiries":5}')).toBeInTheDocument();
    // Paying = Lightor+ and Pro.
    expect(screen.getByText('admin.overview.kpi.payingSplit {"plus":2,"pro":1}')).toBeInTheDocument();

    const sites = screen.getByTestId('sites-by-kind');
    for (const kind of ['book', 'lead', 'products', 'none']) {
      expect(within(sites).getByText(`admin.overview.sites.${kind}`)).toBeInTheDocument();
    }
    expect(screen.getByText('admin.overview.sites.content {"products":12,"posts":4}')).toBeInTheDocument();

    expect(screen.getByText('admin.planStanding.freeDays')).toBeInTheDocument();
    expect(screen.getByTestId('plan-stores')).toHaveTextContent('"paddle":1');
    expect(screen.getByText('admin.overview.plans.billing {"pastDue":1,"canceled":0}')).toBeInTheDocument();

    // A products site ranks first on its inquiries, with its kind beside it.
    const shop = screen.getByRole('link', { name: 'Ring Shop' }).closest('li') as HTMLElement;
    expect(within(shop).getByTestId('site-kind-products')).toBeInTheDocument();
    expect(within(shop).getByText('admin.overview.topSplit {"bookings":0,"inquiries":6}')).toBeInTheDocument();
    expect(within(shop).getByText('6')).toBeInTheDocument();
  });

  it('an older API without the new numbers still shows the bookings', async () => {
    vi.mocked(fetchOverview).mockResolvedValue(overview({ sites: undefined, activity: undefined, plans: undefined, stores: undefined }));
    renderPage();

    expect(await screen.findByText('admin.overview.kpi.activitySplit {"bookings":9,"inquiries":0}')).toBeInTheDocument();
    expect(screen.queryByTestId('sites-by-kind')).toBeNull();
    expect(screen.queryByTestId('plan-stores')).toBeNull();
    expect(screen.getByText('admin.status.active')).toBeInTheDocument();
  });
});
