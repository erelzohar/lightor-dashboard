import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OwnerBookingModal from '../../components/customers/OwnerBookingModal';
import { createAppointment } from '../../services/appointmentsApi';
import type { BookingField } from '../../types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  fetchAppointments: vi.fn(() => ({ type: 'noop' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('../../services/appointmentsApi', () => ({ createAppointment: vi.fn() }));
vi.mock('../../services/customersApi', () => ({ apiErrorStatus: (): undefined => undefined }));
// Opening hours are not under test: two slots, always in the future.
vi.mock('../../utils/bookingSlots', () => ({
  generateSlots: () => ['10:00', '11:00'],
  localDateKey: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  slotTimestamp: () => Date.now() + 86_400_000,
}));

const CATALOG: BookingField[] = [
  { key: 'address', label: 'Address', type: 'address', required: true, services: [] },
  { key: 'car', label: 'Car model', type: 'text', required: false, services: ['t1'] },
  { key: 'parking', label: 'I have parking', type: 'confirm', required: false, services: ['t2'] },
  { key: 'floor', label: 'Floor', type: 'choice', required: false, options: ['Ground', 'Upstairs'], services: ['t2'] },
];
const state = {
  appointments: {
    appointmentTypes: [
      { _id: 't1', name: 'Massage', webConfig_id: 'wc1', price: '100', durationMS: '3600000' },
      { _id: 't2', name: 'Home visit', webConfig_id: 'wc1', price: '200', durationMS: '3600000' },
    ],
  },
  webConfig: { data: { workingDays: [] as (string | null)[], bookingFields: CATALOG } },
};
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));

const renderModal = () =>
  render(
    <OwnerBookingModal
      open
      customer={{ name: 'Dana', phone: '0501234567' }}
      onClose={vi.fn()}
      onBooked={vi.fn()}
    />
  );

const serviceSelect = () => screen.getAllByRole('combobox')[0];
const sentBody = () => vi.mocked(createAppointment).mock.calls[0][0];

/**
 * The owner's manual booking asks the same questions a customer sees
 * (LT-178), or the owner's own walk-ins would arrive without the address.
 */
describe('OwnerBookingModal: booking questions', () => {
  beforeEach(() => {
    vi.mocked(createAppointment).mockReset().mockResolvedValue({} as never);
  });

  it('asks the questions in scope for the chosen service, with required marked', () => {
    renderModal();

    expect(screen.getByLabelText(/Address/)).toBeTruthy();
    expect(screen.getByLabelText(/Car model/)).toBeTruthy();
    expect(screen.queryByLabelText(/I have parking/)).toBeNull();
    // The required marker is shown; nothing is enforced (the server spares the owner).
    expect(screen.getByLabelText(/Address/).closest('div')?.parentElement?.textContent).toContain('*');
    expect(screen.getByLabelText(/Address/)).not.toBeRequired();
  });

  it('sends answers as key + value, re-scoped to the service picked, keeping what still applies', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/Address/), { target: { value: '  Herzl 12, Tel Aviv ' } });
    fireEvent.change(screen.getByLabelText(/Car model/), { target: { value: 'Mazda 3' } });

    // Switching service: the address stays, the car question leaves, parking arrives.
    fireEvent.change(serviceSelect(), { target: { value: 't2' } });
    expect((screen.getByLabelText(/Address/) as HTMLInputElement).value).toBe('  Herzl 12, Tel Aviv ');
    expect(screen.queryByLabelText(/Car model/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/I have parking/));
    fireEvent.change(screen.getByLabelText(/Floor/), { target: { value: 'Upstairs' } });

    fireEvent.change(screen.getByTestId('slot-select'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByText('customers.booking.submit'));

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody()).toMatchObject({ name: 'Dana', phone: '0501234567', type_id: 't2', user_id: 'u1' });
    expect(sentBody().answers).toEqual([
      { key: 'address', value: 'Herzl 12, Tel Aviv' },
      { key: 'parking', value: 'yes' },
      { key: 'floor', value: 'Upstairs' },
    ]);
  });

  it('does not block on a required question left blank, and omits an unticked confirm', async () => {
    renderModal();

    fireEvent.change(serviceSelect(), { target: { value: 't2' } });
    fireEvent.change(screen.getByTestId('slot-select'), { target: { value: '11:00' } });
    fireEvent.click(screen.getByText('customers.booking.submit'));

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody().answers).toEqual([]);
  });
});
