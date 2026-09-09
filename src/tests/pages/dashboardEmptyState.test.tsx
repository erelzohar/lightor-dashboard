import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from '../../pages/Dashboard';

/**
 * A brand-new account on the Dashboard (LT-144): Lighty greets first, the
 * verify-email and upgrade notices share one row beneath, and there is no
 * empty appointments card — it said nothing.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/authApi', () => ({ resendVerification: vi.fn() }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', language: 'en', darkMode: false }),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: {
      user: {
        _id: 'u1', name: 'Dana', isVerified: false, boardingStatus: 'active',
        subscription: { status: 'free' }, webConfig_id: 'wc1',
      },
      isAuthenticated: true, isLoading: false,
    },
    updateUser: vi.fn(),
  }),
}));
interface MockState {
  webConfig: { data: { businessName: string; workingDays: (string | null)[]; contact: Record<string, string>; address: Record<string, string> } | null; loading: boolean };
  appointments: { appointments: unknown[]; appointmentTypes: unknown[]; loading: boolean };
}
const state: MockState = {
  webConfig: { data: { businessName: 'Biz', workingDays: [], contact: {}, address: {} }, loading: false },
  appointments: { appointments: [], appointmentTypes: [], loading: false },
};
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: MockState) => unknown): unknown => selector(state),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: (): (() => void) => vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  fetchAppointments: vi.fn(() => ({ type: 'a' })), fetchAppointmentTypes: vi.fn(() => ({ type: 'b' })),
}));
vi.mock('../../store/slices/webConfigSlice', () => ({ fetchWebConfig: vi.fn(() => ({ type: 'c' })) }));
vi.mock('../../components/dashboard/DashboardAppointmentsList', () => ({
  default: () => <div data-testid="appointments-list" />,
}));
vi.mock('../../components/dashboard/IncomeStats', () => ({ default: () => <div data-testid="income" /> }));
vi.mock('../../components/dashboard/AppointmentsGraph', () => ({ default: () => <div data-testid="graph" /> }));
vi.mock('../../components/dashboard/DashboardDonutChart', () => ({ default: () => <div data-testid="donut" /> }));
vi.mock('../../components/appointments/AppointmentDetails', () => ({ default: (): null => null }));

describe('Dashboard — new account with no bookings', () => {
  it('shows Lighty first, both notices in one row, and no appointments list', () => {
    render(<Dashboard />);

    const lighty = screen.getByAltText('Welcome');
    expect(lighty).toHaveAttribute('src', '/lighty-welcome.png');
    expect(screen.getByText('dashboard.emptyTitle')).toBeInTheDocument();

    expect(screen.queryByTestId('appointments-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('income')).not.toBeInTheDocument();

    const verify = screen.getByText('common.notVerifiedTitle');
    const upgrade = screen.getByText('common.upgradePlanTitle');
    const row = verify.closest('.lg\\:flex-row');
    expect(row).not.toBeNull();
    expect(row).toContainElement(upgrade);

    // Lighty comes before the notices in document order.
    expect(lighty.compareDocumentPosition(verify) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
