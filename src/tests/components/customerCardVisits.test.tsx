import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import CustomerDetailDrawer from '../../components/customers/CustomerDetailDrawer';
import { fetchCustomer, type CustomerDetail, type CustomerHistoryRow } from '../../services/customersApi';
import { firstVisitOf, historyStatus, pastVisits } from '../../utils/customerVisits';

/**
 * LT-315 — the customer card: statuses in the owner's language, "visits"
 * that took place (an upcoming booking is not one yet), and the first
 * visit's date rather than the day the record was made.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('../../hooks/useAppSelector', () => ({ useAppSelector: (selector: (s: unknown) => unknown) => selector({ webConfig: { data: null } }) }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
vi.mock('../../services/customersApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/customersApi')>()),
  fetchCustomer: vi.fn(),
}));

const DAY = 86_400_000;
const visit = (id: string, startMs: number, status: CustomerHistoryRow['status']): CustomerHistoryRow => ({
  _id: id, name: 'Dana', phone: '0501234567', timestamp: String(startMs), scheduledAt: new Date(startMs).toISOString(),
  status, createdAt: '2026-01-01T00:00:00Z', type_id: 't1', typeName: `Gel ${id}`, typeDurationMS: '3600000',
});

describe('customer visits (LT-315)', () => {
  it('counts only visits that took place', () => {
    expect(pastVisits({ visits: 1, upcoming: 1 })).toBe(0);
    expect(pastVisits({ visits: 3, upcoming: 1 })).toBe(2);
  });

  it('dates the first visit by the first booking that was not cancelled', () => {
    const now = Date.now();
    const history = [visit('a', now + DAY, 'scheduled'), visit('b', now - 10 * DAY, 'completed'), visit('c', now - 30 * DAY, 'cancelled')];
    expect(firstVisitOf(history)).toBe(new Date(now - 10 * DAY).toISOString());
    expect(firstVisitOf([visit('c', now, 'cancelled')])).toBeNull();
  });

  it('shows a booking that is over as completed, as the calendar does', () => {
    const now = Date.now();
    expect(historyStatus(visit('a', now - DAY, 'scheduled'), now)).toBe('completed');
    expect(historyStatus(visit('b', now + DAY, 'scheduled'), now)).toBe('scheduled');
    expect(historyStatus(visit('c', now - DAY, 'cancelled'), now)).toBe('cancelled');
  });

  it('the card: translated statuses, past visits, the first visit', async () => {
    const now = Date.now();
    const firstSeen = '2025-01-01T09:00:00Z'; // when the record was made, not a visit
    vi.mocked(fetchCustomer).mockResolvedValue({
      customer: {
        _id: 'c1', name: 'Dana', phone: '0501234567', phoneNormalized: '+972501234567', isBlocked: false, blockedAt: null,
        blockReason: null, notes: '', source: 'booking', firstSeenAt: firstSeen, lastSeenAt: firstSeen, createdAt: firstSeen,
      },
      // As the API counts them: the upcoming booking is among the "visits".
      stats: { visits: 1, cancelled: 1, upcoming: 1, revenue: 0, lastVisit: null, nextVisit: new Date(now + DAY).toISOString() },
      history: [visit('up', now + DAY, 'scheduled'), visit('old', now - 5 * DAY, 'cancelled')],
    } as CustomerDetail);

    render(<CustomerDetailDrawer customerId="c1" onClose={vi.fn()} onChanged={vi.fn()} />);

    const visitsTile = (await screen.findByText('customers.columns.visits')).parentElement as HTMLElement;
    expect(within(visitsTile).getByText('0')).toBeInTheDocument();
    expect(screen.getByText('admin.appointmentStatus.scheduled')).toBeInTheDocument();
    expect(screen.getByText('admin.appointmentStatus.cancelled')).toBeInTheDocument();
    expect(screen.queryByText('scheduled')).not.toBeInTheDocument();

    const firstVisit = screen.getByText('customers.detail.firstSeen').parentElement as HTMLElement;
    const expected = new Date(now + DAY).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    expect(firstVisit).toHaveTextContent(expected);
  });
});

beforeEach(() => vi.mocked(fetchCustomer).mockReset());
