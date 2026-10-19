import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import Dashboard from '../../pages/Dashboard';
import { fetchLeads, fetchLeadStats, LeadStats } from '../../services/leadsApi';

// Stable across renders (pages memoise on `t`); interpolation values are
// spelled out so the numbers' wording can be read back.
const { t } = vi.hoisted(() => ({
  t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}(${Object.values(opts).join(',')})` : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/authApi', () => ({ resendVerification: vi.fn() }));
vi.mock('../../services/entitlementsApi', () => ({
  fetchMyEntitlements: vi.fn(() =>
    Promise.resolve({ plan: 'plus', limits: { monthlyLeads: null }, usage: { leadsThisMonth: 12 }, pilot: null })
  ),
}));
vi.mock('../../services/leadsApi', () => ({ fetchLeads: vi.fn(), fetchLeadStats: vi.fn() }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', language: 'en', darkMode: false }),
}));
const user = vi.hoisted(() => ({
  _id: 'u1', name: 'Dana', isVerified: true, phoneVerifiedAt: undefined as string | undefined, boardingStatus: 'active',
  subscription: { status: 'free' }, webConfig_id: 'wc1',
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user, isAuthenticated: true, isLoading: false }, updateUser: vi.fn() }),
}));

interface MockState {
  webConfig: { data: Record<string, unknown>; loading: boolean };
  appointments: { appointments: unknown[]; appointmentTypes: unknown[]; loading: boolean };
}
const state = vi.hoisted<MockState>(() => ({
  webConfig: { data: {}, loading: false },
  appointments: { appointments: [], appointmentTypes: [], loading: false },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: MockState) => unknown): unknown => selector(state),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn(() => Promise.resolve({})) }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  fetchAppointments: vi.fn(() => ({ type: 'appointments/fetch' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'appointments/fetchTypes' })),
}));
vi.mock('../../store/slices/webConfigSlice', () => ({ fetchWebConfig: vi.fn(() => ({ type: 'webConfig/fetch' })) }));
vi.mock('../../components/dashboard/DashboardAppointmentsList', () => ({
  default: () => <div data-testid="appointments-list" />,
}));
vi.mock('../../components/dashboard/IncomeStats', () => ({ default: () => <div data-testid="income" /> }));
vi.mock('../../components/dashboard/AppointmentsGraph', () => ({ default: () => <div data-testid="graph" /> }));
vi.mock('../../components/dashboard/DashboardDonutChart', () => ({ default: () => <div data-testid="donut" /> }));
vi.mock('../../components/appointments/AppointmentDetails', () => ({ default: (): null => null }));

const config = (conversion: 'book' | 'lead', subDomain = 'dana') => ({
  _id: 'wc1', businessName: 'Dana Renovations', subDomain, conversion,
  contact: { phone: '0501234567' }, address: { city: 'Haifa', street: 'Herzl 1' },
  workingDays: ['09:00-17:00', null, null, null, null, null, null], logoImageName: 'logo.webp',
});

const lead = (id: string) => ({
  _id: id, name: `Lead ${id}`, phone: '0584006014', status: 'new',
  createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:00:00.000Z',
});
const leadsPage = (total: number) => ({
  success: true,
  data: Array.from({ length: Math.min(total, 5) }, (_, i) => lead(`l${i}`)),
  pagination: { total, page: 1, limit: 5, pages: 1 },
  counts: { new: Math.min(total, 3), contacted: Math.max(0, total - 3), closed: 0 },
});

// 30 Israel days ending today; every third one had two inquiries, today three.
const day = (i: number) => new Date(Date.UTC(2026, 8, 14 + i)).toISOString().slice(0, 10);
const perDay = Array.from({ length: 30 }, (_, i) => ({ date: day(i), count: i === 29 ? 3 : i % 3 === 0 ? 2 : 0 }));
const stats = (over: Partial<LeadStats> = {}): LeadStats => ({
  thisMonth: 12,
  lastMonth: 8,
  waiting: 3,
  last30: { total: 12, handled: 9 },
  avgResponseMs: 2.5 * 3_600_000,
  perDay,
  topic: null,
  ...over,
});

const appointment = {
  _id: 'a1', name: 'Dana', phone: '0501234567', status: 'scheduled', user_id: 'u1',
  timestamp: String(Date.now() + 3_600_000),
  type: { _id: 's1', name: 'Massage', price: '100', durationMS: '3600000', webConfig_id: 'wc1' },
};

beforeEach(() => {
  navigate.mockReset();
  user.isVerified = true;
  user.phoneVerifiedAt = undefined;
  state.webConfig.data = config('lead');
  state.appointments.appointments = [];
  vi.mocked(fetchLeads).mockReset().mockResolvedValue(leadsPage(12) as never);
  vi.mocked(fetchLeadStats).mockReset().mockResolvedValue(stats());
});

/**
 * A leads site's home (LT-274): four numbers on the bookings home's stats
 * widgets, the last 30 days by day and by topic, the latest inquiries, and a
 * card for sharing the site.
 */
describe('Leads home - the four numbers', () => {
  it('compares the month with last month up to the same day (LT-281)', async () => {
    vi.mocked(fetchLeadStats).mockResolvedValue(stats({ lastMonthToDate: 6 }));
    render(<Dashboard />);

    const month = await screen.findByTestId('leads-stat-month');
    expect(within(month).getByText('100%')).toBeInTheDocument(); // 12 against 6, not against all 8
    expect(within(month).getByText('dashboard.leadsStats.lastMonth(6)')).toBeInTheDocument();
  });

  it('shows this month against last month, the waiting inquiries in amber, the response time and the handled share', async () => {
    render(<Dashboard />);

    const month = await screen.findByTestId('leads-stat-month');
    expect(within(month).getByText('12')).toBeInTheDocument();
    expect(within(month).getByText('50%')).toBeInTheDocument(); // 12 against 8
    expect(within(month).getByText('dashboard.leadsStats.lastMonth(8)')).toBeInTheDocument();
    expect(month.querySelector('svg')).not.toBeNull(); // the 30 days as its sparkline

    const waiting = screen.getByTestId('leads-stat-waiting');
    expect(within(waiting).getByText('3')).toBeInTheDocument();
    expect(within(waiting).getByTestId('stats-widget')).toHaveClass('glass-tint-amber');
    expect(within(waiting).getByText('dashboard.leadsStats.waitingCta')).toBeInTheDocument();
    expect(waiting.querySelector('svg')).toBeNull();

    const response = screen.getByTestId('leads-stat-response');
    expect(within(response).getByText('dashboard.leadsStats.hours(2.5)')).toBeInTheDocument();
    expect(within(response).getByText('dashboard.leadsStats.last30')).toBeInTheDocument();

    const handled = screen.getByTestId('leads-stat-handled');
    expect(within(handled).getByText('75%')).toBeInTheDocument(); // 9 of 12
    expect(within(handled).getByText('dashboard.leadsStats.handledOf(9,12)')).toBeInTheDocument();
  });

  it('drops the percentage when last month had none, and reads dashes before anything is measured', async () => {
    vi.mocked(fetchLeadStats).mockResolvedValue(
      stats({ thisMonth: 4, lastMonth: 0, waiting: 0, avgResponseMs: null, last30: { total: 0, handled: 0 } })
    );
    render(<Dashboard />);

    const month = await screen.findByTestId('leads-stat-month');
    expect(within(month).getByText('4')).toBeInTheDocument();
    expect(month.textContent).not.toContain('%');

    const waiting = screen.getByTestId('leads-stat-waiting');
    expect(within(waiting).getByTestId('stats-widget')).not.toHaveClass('glass-tint-amber');
    expect(within(waiting).getByText('dashboard.leadsStats.waitingNone')).toBeInTheDocument();

    const response = screen.getByTestId('leads-stat-response');
    expect(within(response).getByText('-')).toBeInTheDocument();
    expect(within(response).getByText('dashboard.leadsStats.responseNotYet')).toBeInTheDocument();

    const handled = screen.getByTestId('leads-stat-handled');
    expect(within(handled).getByText('-')).toBeInTheDocument();
  });

  it('opens the new leads from the waiting card (LT-288)', async () => {
    render(<Dashboard />);
    const waiting = await screen.findByTestId('leads-stat-waiting');
    fireEvent.click(within(waiting).getByRole('button'));
    expect(navigate).toHaveBeenCalledWith('/leads?status=new');
  });

  it('leaves the numbers out quietly when they cannot be read, keeping the list and the share card', async () => {
    vi.mocked(fetchLeadStats).mockRejectedValue(new Error('500'));
    render(<Dashboard />);

    expect(await screen.findByTestId('leads-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('leads-stats')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leads-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leads-topics')).not.toBeInTheDocument();
    expect(screen.getByTestId('share-site-card')).toBeInTheDocument();
  });
});

describe('Leads home - the last 30 days', () => {
  it('draws one bar per day with today’s emphasised, and reads a day out on tap', async () => {
    render(<Dashboard />);

    const bars = await screen.findAllByTestId('leads-chart-bar');
    expect(bars).toHaveLength(30);
    expect(bars.filter((bar) => bar.dataset.today === 'true')).toEqual([bars[29]]);
    expect((bars[29].firstElementChild as HTMLElement).style.height).toBe('100%'); // 3 of 3
    expect((bars[0].firstElementChild as HTMLElement).style.height).toMatch(/^66\.66/); // 2 of 3
    expect((bars[1].firstElementChild as HTMLElement).style.height).toBe('2px'); // an empty day's stub
    expect(bars[29].firstElementChild).toHaveClass('opacity-100');
    expect(bars[0].firstElementChild).toHaveClass('opacity-30');

    const readout = screen.getByTestId('leads-chart-readout');
    expect(readout).toHaveTextContent('appointments.today · dashboard.leadsChart.dayCount(3)');
    fireEvent.click(bars[0]);
    expect(readout).toHaveTextContent('dashboard.leadsChart.dayCount(2)');
    expect(readout).not.toHaveTextContent('appointments.today');
  });

  it('hides the topics when the form has no multiple-choice question, and the chart takes the row', async () => {
    render(<Dashboard />);

    const chart = await screen.findByTestId('leads-chart');
    expect(screen.queryByTestId('leads-topics')).not.toBeInTheDocument();
    expect(chart.parentElement).toHaveClass('lg:col-span-3');
  });

  it('lists what people ask about, most asked first and "other" last', async () => {
    vi.mocked(fetchLeadStats).mockResolvedValue(
      stats({
        topic: {
          label: 'Type of work',
          items: [{ value: 'Bathroom', count: 3 }, { value: 'Kitchen', count: 5 }, { value: 'Garden', count: 0 }],
          other: 2,
        },
      })
    );
    render(<Dashboard />);

    const topics = await screen.findByTestId('leads-topics');
    expect(within(topics).getByText('Type of work')).toBeInTheDocument();
    const rows = within(topics).getAllByTestId('leads-topic-row');
    expect(rows.map((row) => row.textContent)).toEqual(['Kitchen5', 'Bathroom3', 'dashboard.leadsTopics.other2']);
    expect((rows[1].querySelector('[style]') as HTMLElement).style.width).toBe('60%'); // 3 of 5
    // Beside the chart on wide screens, like the bookings graph and donut.
    expect(screen.getByTestId('leads-chart').parentElement).toHaveClass('lg:col-span-2');
  });

  it('hides the topics when no answer came in', async () => {
    vi.mocked(fetchLeadStats).mockResolvedValue(
      stats({ topic: { label: 'Type of work', items: [{ value: 'Kitchen', count: 0 }], other: 0 } })
    );
    render(<Dashboard />);

    expect(await screen.findByTestId('leads-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('leads-topics')).not.toBeInTheDocument();
  });

  it('skips the chart after 30 days without an inquiry', async () => {
    vi.mocked(fetchLeadStats).mockResolvedValue(stats({ perDay: perDay.map((d) => ({ ...d, count: 0 })) }));
    render(<Dashboard />);

    expect(await screen.findByTestId('leads-stats')).toBeInTheDocument();
    expect(screen.queryByTestId('leads-chart')).not.toBeInTheDocument();
  });
});

describe('Leads home - no inquiries yet', () => {
  it('keeps Lighty’s welcome, skips the numbers and the chart, and asks for the first inquiry', async () => {
    vi.mocked(fetchLeads).mockResolvedValue(leadsPage(0) as never);
    render(<Dashboard />);

    expect(await screen.findByText('dashboard.emptyDescLeads')).toBeInTheDocument();
    await act(async () => {});
    expect(screen.queryByTestId('leads-stats')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leads-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leads-summary')).not.toBeInTheDocument();

    const card = screen.getByTestId('share-site-card');
    expect(card).toHaveClass('glass-tint-primary');
    expect(within(card).getByText('dashboard.share.firstLeads')).toBeInTheDocument();
  });
});

/**
 * The share card (LT-274) is on both homes, at the foot of the page, but only
 * once the site is live: the owner's email verified and an address to share.
 */
describe('Share card on the home page', () => {
  it('sits under the latest inquiries on a leads site', async () => {
    render(<Dashboard />);

    const summary = await screen.findByTestId('leads-summary');
    const card = screen.getByTestId('share-site-card');
    expect(within(card).getByText('dashboard.share.titleLeads')).toBeInTheDocument();
    expect(card).not.toHaveClass('glass-tint-primary');
    expect(summary.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sits under the appointments on a booking site', async () => {
    state.webConfig.data = config('book');
    state.appointments.appointments = [appointment];
    render(<Dashboard />);
    await act(async () => {});

    const card = screen.getByTestId('share-site-card');
    expect(within(card).getByText('dashboard.share.titleBookings')).toBeInTheDocument();
    const list = screen.getByTestId('appointments-list');
    expect(list.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fetchLeadStats).not.toHaveBeenCalled();
  });

  it('asks a booking site with no bookings yet for its first one', async () => {
    state.webConfig.data = config('book');
    render(<Dashboard />);
    await act(async () => {});

    expect(within(screen.getByTestId('share-site-card')).getByText('dashboard.share.firstBookings')).toBeInTheDocument();
  });

  it.each(['lead', 'book'] as const)('is hidden from an owner who has not verified the email (%s site)', async (conversion) => {
    user.isVerified = false;
    state.webConfig.data = config(conversion);
    state.appointments.appointments = [appointment];
    render(<Dashboard />);
    await act(async () => {});

    expect(screen.getByText('common.notVerifiedTitle')).toBeInTheDocument();
    expect(screen.queryByTestId('share-site-card')).not.toBeInTheDocument();
  });

  // LT-410: the phone code at signup makes the site live; the email can wait.
  it('shows for an owner who proved the phone though not the email yet, with the softer banner', async () => {
    user.isVerified = false;
    user.phoneVerifiedAt = '2026-10-19T09:00:00.000Z';
    state.webConfig.data = config('book');
    state.appointments.appointments = [appointment];
    render(<Dashboard />);
    await act(async () => {});

    expect(screen.getByText('common.notVerifiedLiveAlert')).toBeInTheDocument();
    expect(screen.queryByText('common.notVerifiedAlert')).not.toBeInTheDocument();
    expect(screen.getByTestId('share-site-card')).toBeInTheDocument();
  });

  it('is hidden while the site has no address', async () => {
    state.webConfig.data = config('lead', '');
    render(<Dashboard />);

    expect(await screen.findByTestId('leads-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('share-site-card')).not.toBeInTheDocument();
  });
});
