import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import Dashboard from '../../pages/Dashboard';
import OnboardingWelcome from '../../components/onboarding/OnboardingWelcome';
import { fetchLeads } from '../../services/leadsApi';
import { fetchAppointments } from '../../store/slices/appointmentsSlice';

// Stable across renders (pages memoise on `t`); interpolation values are
// spelled out so the checklist's done/total can be read back.
const { t } = vi.hoisted(() => ({
  t: (key: string, opts?: Record<string, unknown>) =>
    opts && 'done' in opts ? `${key} ${opts.done}/${opts.total}` : key,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/authApi', () => ({ resendVerification: vi.fn() }));
vi.mock('../../services/entitlementsApi', () => ({
  fetchMyEntitlements: vi.fn(() =>
    Promise.resolve({
      plan: 'plus',
      limits: { monthlyLeads: null },
      usage: { leadsThisMonth: 7 },
      pilot: null,
    })
  ),
}));
vi.mock('../../services/leadsApi', () => ({ fetchLeads: vi.fn() }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', language: 'en', darkMode: false }),
}));
const updateUser = vi.hoisted(() => vi.fn());
const user = vi.hoisted(() => ({
  _id: 'u1', name: 'Dana', isVerified: true, boardingStatus: 'active',
  subscription: { status: 'free' }, webConfig_id: 'wc1',
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user, isAuthenticated: true, isLoading: false }, updateUser }),
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
const dispatchMock = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatchMock }));
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

/** Every setup detail filled in: only services decide the checklist. */
const completeConfig = (conversion: 'book' | 'lead') => ({
  _id: 'wc1',
  businessName: 'Biz',
  conversion,
  contact: { phone: '0501234567', mail: 'a@b.co' },
  address: { city: 'Haifa', street: 'Herzl 1' },
  workingDays: ['09:00-17:00', null, null, null, null, null, null],
  logoImageName: 'logo.webp',
});

const appointment = {
  _id: 'a1', name: 'Dana', phone: '0501234567', status: 'scheduled', user_id: 'u1',
  timestamp: String(Date.now() + 3_600_000),
  type: { _id: 's1', name: 'Massage', price: '100', durationMS: '3600000', webConfig_id: 'wc1' },
};

const lead = (id: string, name: string) => ({
  _id: id, name, phone: '0584006014', status: 'new', message: 'Kitchen renovation',
  createdAt: '2026-09-27T10:00:00.000Z', updatedAt: '2026-09-27T10:00:00.000Z',
});
const leadsPage = (data: unknown[], counts: { new: number; contacted: number; closed: number }) => ({
  success: true, data, pagination: { total: data.length, page: 1, limit: 5, pages: 1 }, counts,
});

beforeEach(() => {
  dispatchMock.mockReset().mockImplementation(() => Promise.resolve({}));
  vi.mocked(fetchAppointments).mockClear();
  vi.mocked(fetchLeads).mockReset().mockResolvedValue(leadsPage([], { new: 0, contacted: 0, closed: 0 }) as never);
  updateUser.mockReset().mockResolvedValue(undefined);
  user.boardingStatus = 'active';
  state.appointments.appointments = [appointment];
  state.appointments.appointmentTypes = [];
});

/**
 * The home by what the site does (LT-199): a booking site keeps its income,
 * graph, donut and appointments list and the 4-minute poll; a leads site's
 * home is the leads summary, and nothing polls the appointments.
 */
describe('Dashboard home by site mode', () => {
  it('shows the booking widgets and polls appointments on a booking site', async () => {
    state.webConfig.data = completeConfig('book');
    render(<Dashboard />);
    await act(async () => {});

    for (const id of ['income', 'graph', 'donut', 'appointments-list']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('leads-summary')).not.toBeInTheDocument();
    expect(fetchAppointments).toHaveBeenCalledWith({ user_id: 'u1', limit: 5000 });
    // Only the badge's count read — no summary fetch.
    expect(fetchLeads).not.toHaveBeenCalledWith({ limit: 5 });
  });

  it('shows the leads summary instead of every booking widget on a leads site, and no poll', async () => {
    state.webConfig.data = completeConfig('lead');
    vi.mocked(fetchLeads).mockResolvedValue(
      leadsPage([lead('l1', 'Dana Levi'), lead('l2', 'Moshe Cohen')], { new: 2, contacted: 3, closed: 1 }) as never
    );
    render(<Dashboard />);

    const summary = await screen.findByTestId('leads-summary');
    expect(fetchLeads).toHaveBeenCalledWith({ limit: 5 });
    expect(within(summary).getByTestId('leads-stat-new')).toHaveTextContent('2');
    expect(await within(summary).findByText('7')).toBeInTheDocument(); // this month, from the meter
    const rows = within(summary).getAllByTestId('leads-summary-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Dana Levi')).toBeInTheDocument();
    expect(within(rows[0]).getByText('0584006014').closest('a')).toHaveAttribute('href', 'tel:0584006014');
    expect(within(rows[0]).getByText('leads.whatsapp').closest('a')).toHaveAttribute('href', 'https://wa.me/972584006014');

    // The store still holds an appointment from before the switch: no widget shows it.
    for (const id of ['income', 'graph', 'donut', 'appointments-list']) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId('leads-home-card')).not.toBeInTheDocument();
    expect(fetchAppointments).not.toHaveBeenCalled();
  });

  it('greets a leads site with no inquiries yet in its own words', async () => {
    state.webConfig.data = completeConfig('lead');
    state.appointments.appointments = [];
    render(<Dashboard />);

    expect(await screen.findByText('dashboard.emptyDescLeads')).toBeInTheDocument();
    expect(screen.getByAltText('Welcome')).toBeInTheDocument();
    expect(screen.queryByText('dashboard.emptyDesc')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leads-summary')).not.toBeInTheDocument();
  });

  it('keeps the booking wording for a booking site with no bookings yet', async () => {
    state.webConfig.data = completeConfig('book');
    state.appointments.appointments = [];
    render(<Dashboard />);
    await act(async () => {});

    expect(screen.getByText('dashboard.emptyDesc')).toBeInTheDocument();
    expect(screen.queryByText('dashboard.emptyDescLeads')).not.toBeInTheDocument();
  });
});

/**
 * The onboarding checklist (LT-199). "All set" is the only way to
 * boardingStatus 'active', which the floating assistant waits for, so a leads
 * account — no services to price — must be able to finish it.
 */
describe('Onboarding checklist by site mode', () => {
  beforeEach(() => {
    user.boardingStatus = 'onboarded';
    state.appointments.appointments = [];
  });

  it('completes on a leads site with no services at all', async () => {
    state.webConfig.data = completeConfig('lead');
    render(<Dashboard />);
    await act(async () => {});

    expect(screen.queryByText('onboarding.step_serviceTypes')).not.toBeInTheDocument();
    expect(screen.getByText('onboarding.setupProgress 5/5')).toBeInTheDocument();
    fireEvent.click(screen.getByText('onboarding.allDoneBtn'));
    await act(async () => {});
    expect(updateUser).toHaveBeenCalledWith({ boardingStatus: 'active' });
  });

  it('still asks a booking site for priced services', async () => {
    state.webConfig.data = completeConfig('book');
    render(<Dashboard />);
    await act(async () => {});

    expect(screen.getByText('onboarding.step_serviceTypes')).toBeInTheDocument();
    expect(screen.getByText('onboarding.setupProgress 5/6')).toBeInTheDocument();
    expect(screen.queryByText('onboarding.allDoneBtn')).not.toBeInTheDocument();
  });

  it('completes on a booking site once its services are priced', async () => {
    state.webConfig.data = completeConfig('book');
    state.appointments.appointmentTypes = [{ _id: 's1', name: 'Massage', price: '100', durationMS: '3600000', webConfig_id: 'wc1' }];
    render(<Dashboard />);
    await act(async () => {});

    expect(screen.getByText('onboarding.setupProgress 6/6')).toBeInTheDocument();
    expect(screen.getByText('onboarding.allDoneBtn')).toBeInTheDocument();
  });

  it('shows a leads account the welcome checklist complete with no services', () => {
    state.webConfig.data = completeConfig('lead');
    render(<OnboardingWelcome userName="Dana Levi" onGetStarted={vi.fn()} isLoading={false} />);

    expect(screen.getByText('onboarding.allStepsComplete')).toBeInTheDocument();
    expect(screen.getByText('onboarding.setupProgress 5/5')).toBeInTheDocument();
    // Nothing to fetch for a checklist that does not ask about services.
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('lists services as missing in a booking account’s welcome checklist', () => {
    state.webConfig.data = completeConfig('book');
    render(<OnboardingWelcome userName="Dana Levi" onGetStarted={vi.fn()} isLoading={false} />);

    expect(screen.getByText('onboarding.step_serviceTypes')).toBeInTheDocument();
    expect(screen.getByText('onboarding.setupProgress 5/6')).toBeInTheDocument();
  });
});
