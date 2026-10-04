import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportAppointmentsButton from '../../components/appointments/ExportAppointmentsButton';
import CustomerDetailDrawer from '../../components/customers/CustomerDetailDrawer';
import { exportAppointmentsCsv } from '../../services/appointmentsApi';
import { fetchMyEntitlements, MyEntitlements } from '../../services/entitlementsApi';
import { fetchCustomer, CustomerDetail } from '../../services/customersApi';
import { canOfferPurchases } from '../../lib/platform';
import toast from 'react-hot-toast';

const navigate = vi.fn();
const booking = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-hot-toast', () => {
  const fn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { default: fn };
});
vi.mock('../../services/appointmentsApi', () => ({ exportAppointmentsCsv: vi.fn() }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn() }));
vi.mock('../../lib/platform', () => ({ canOfferPurchases: vi.fn(() => true), isNativeApp: () => false }));
vi.mock('../../services/customersApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/customersApi')>()),
  fetchCustomer: vi.fn(),
  setCustomerBlock: vi.fn(),
  setCustomerNotes: vi.fn(),
}));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({
      webConfig: {
        data: {
          bookingFields: [
            { key: 'address', label: 'Address', type: 'address', required: true, services: [], remember: true },
            { key: 'parking', label: 'Parking', type: 'confirm', required: false, services: [] },
          ],
        },
      },
    }),
}));
// The booking window has its own suite; here only what the drawer hands it.
vi.mock('../../components/customers/OwnerBookingModal', () => ({
  default: (props: Record<string, unknown>): null => {
    booking.props = props;
    return null;
  },
}));

const plan = (customerExport: boolean) =>
  ({ plan: customerExport ? 'plus' : 'free', limits: { customerExport }, usage: {} }) as unknown as MyEntitlements;

/** LT-217: the appointments of a range, a column per question — Plus. */
describe('ExportAppointmentsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canOfferPurchases).mockReturnValue(true);
  });

  it('downloads the chosen range, this month by default', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(plan(true));
    vi.mocked(exportAppointmentsCsv).mockResolvedValue();
    render(<ExportAppointmentsButton />);
    await waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('export-appointments'));
    const from = screen.getByTestId('export-from') as HTMLInputElement;
    expect(from.value).toMatch(/^\d{4}-\d{2}-01$/);
    fireEvent.change(from, { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByTestId('export-to'), { target: { value: '2026-09-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'appointments.export.download' }));

    await waitFor(() => expect(exportAppointmentsCsv).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-09-30' }));
  });

  it('says so when the range is refused', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(plan(true));
    vi.mocked(exportAppointmentsCsv).mockRejectedValue(new Error('RANGE_INVALID'));
    render(<ExportAppointmentsButton />);
    await waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('export-appointments'));
    fireEvent.click(screen.getByRole('button', { name: 'appointments.export.download' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('appointments.export.rangeInvalid'));
  });

  it('on the free plan points at the plans on the web, and is absent in the app', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(plan(false));
    const { unmount } = render(<ExportAppointmentsButton />);
    await waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalled());

    fireEvent.click(await screen.findByTestId('export-appointments'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/account'));
    expect(screen.queryByTestId('export-from')).toBeNull();
    expect(exportAppointmentsCsv).not.toHaveBeenCalled();
    unmount();

    vi.mocked(canOfferPurchases).mockReturnValue(false);
    render(<ExportAppointmentsButton />);
    await waitFor(() => expect(screen.queryByTestId('export-appointments')).toBeNull());
  });
});

/** LT-217: the customer card shows each visit's answers and what is kept. */
describe('CustomerDetailDrawer: booking answers', () => {
  const address = { key: 'address', label: 'Address', value: 'Herzl 12, Tel Aviv', placeId: 'ChIJ_herzl', lat: 32.06, lng: 34.77 };
  const detail = {
    customer: {
      _id: 'c1', name: 'Dana', phone: '0501234567', phoneNormalized: '+972501234567', isBlocked: false,
      blockedAt: null, blockReason: null, notes: '', source: 'booking', firstSeenAt: '2026-09-01T10:00:00Z',
      lastSeenAt: '2026-10-01T10:00:00Z', createdAt: '2026-09-01T10:00:00Z', answers: [address],
    },
    stats: { visits: 2, cancelled: 0, upcoming: 1, revenue: 200, lastVisit: null, nextVisit: null },
    history: [
      {
        _id: 'a1', name: 'Dana', phone: '0501234567', timestamp: '1790000000000', scheduledAt: '2026-10-04T10:00:00Z',
        status: 'scheduled', channelType: 'sms', createdAt: '2026-10-01T10:00:00Z', type_id: 't1', typeName: 'Massage',
        answers: [address, { key: 'parking', label: 'Parking', value: 'yes' }],
      },
    ],
  } as unknown as CustomerDetail;

  beforeEach(() => {
    vi.clearAllMocks();
    booking.props = null;
    vi.mocked(fetchCustomer).mockResolvedValue(detail);
  });

  it('lists what was answered, and what is kept for next time — and hands it to the booking window', async () => {
    render(<CustomerDetailDrawer customerId="c1" onClose={vi.fn()} onChanged={vi.fn()} />);

    expect(await screen.findByTestId('customer-saved-details')).toBeTruthy();
    expect(screen.getByText('customers.detail.savedDetails')).toBeTruthy();
    // Once kept, once on the visit.
    expect(screen.getAllByText('Herzl 12, Tel Aviv')).toHaveLength(2);
    expect(screen.getByText('Parking')).toBeTruthy();
    expect((booking.props?.customer as { answers?: unknown })?.answers).toEqual([address]);
  });
});
