import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import toast from 'react-hot-toast';
import CustomerDetailDrawer from '../../components/customers/CustomerDetailDrawer';
import { deleteCustomer, fetchCustomer, type CustomerDetail } from '../../services/customersApi';

/**
 * LT-645 (Erel 2026-11-10): the customer card deletes a customer. It asks
 * first and says what stays (past bookings, without the person); a booking
 * still ahead holds the delete, in the card and when the server refuses.
 */
const { t } = vi.hoisted(() => ({
  t: (key: string, opts?: Record<string, unknown>) => (opts?.count !== undefined ? `${key}:${opts.count}` : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
const state = vi.hoisted(() => ({ webConfig: { data: null as null | { conversion?: string } } }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
vi.mock('../../services/customersApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/customersApi')>()),
  fetchCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
}));

const record: CustomerDetail['customer'] = {
  _id: 'c1', name: 'Rona', phone: '0547654321', phoneNormalized: '+972547654321', isBlocked: false, blockedAt: null,
  blockReason: null, notes: '', source: 'booking', firstSeenAt: '2026-09-01T09:00:00Z', lastSeenAt: '2026-10-01T09:00:00Z',
  createdAt: '2026-09-01T09:00:00Z',
};
const stats = (upcoming: number): CustomerDetail['stats'] =>
  ({ visits: 2, cancelled: 0, upcoming, revenue: 0, lastVisit: null, nextVisit: null });

const onClose = vi.fn();
const onChanged = vi.fn();
const openCard = async (detail: CustomerDetail) => {
  vi.mocked(fetchCustomer).mockResolvedValue(detail);
  render(
    <MemoryRouter>
      <CustomerDetailDrawer customerId="c1" onClose={onClose} onChanged={onChanged} />
    </MemoryRouter>
  );
  return screen.findByRole('dialog', { name: 'customers.detail.title' });
};

describe('deleting a customer from their card (LT-645)', () => {
  beforeEach(() => {
    state.webConfig.data = null;
    onClose.mockClear();
    onChanged.mockClear();
    vi.mocked(deleteCustomer).mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it('asks first, then deletes, tells the list and closes the card', async () => {
    vi.mocked(deleteCustomer).mockResolvedValue({ anonymized: 2 });
    const card = await openCard({ customer: record, stats: stats(0), history: [] });

    fireEvent.click(await within(card).findByTestId('customer-delete'));
    expect(deleteCustomer).not.toHaveBeenCalled();
    expect(await screen.findByText('customers.delete.message')).toBeInTheDocument();
    expect(screen.queryByText('customers.delete.blockedNote')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'customers.delete.confirm' }));

    await waitFor(() => expect(deleteCustomer).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onChanged).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('customers.delete.done');
  });

  it('cancelling the question deletes nothing', async () => {
    const card = await openCard({ customer: record, stats: stats(0), history: [] });
    fireEvent.click(await within(card).findByTestId('customer-delete'));
    fireEvent.click(await screen.findByRole('button', { name: 'customers.block.cancel' }));
    expect(deleteCustomer).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a booking still ahead holds the delete: no question, a message with the count', async () => {
    const card = await openCard({ customer: record, stats: stats(3), history: [] });
    fireEvent.click(await within(card).findByTestId('customer-delete'));
    expect(toast.error).toHaveBeenCalledWith('customers.delete.hasUpcoming:3');
    expect(screen.queryByText('customers.delete.message')).toBeNull();
    expect(deleteCustomer).not.toHaveBeenCalled();
  });

  it('says the same when the server refuses for a booking made since the card opened', async () => {
    vi.mocked(deleteCustomer).mockRejectedValue({
      response: { status: 409, data: { code: 'CUSTOMER_HAS_UPCOMING', details: { upcoming: 1 } } },
    });
    const card = await openCard({ customer: record, stats: stats(0), history: [] });
    fireEvent.click(await within(card).findByTestId('customer-delete'));
    fireEvent.click(await screen.findByRole('button', { name: 'customers.delete.confirm' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('customers.delete.hasUpcoming:1'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a blocked customer: the question says the block goes too; a leads site speaks of inquiries', async () => {
    state.webConfig.data = { conversion: 'lead' };
    const card = await openCard({
      customer: { ...record, isBlocked: true }, stats: stats(0), history: [],
      leadStats: { inquiries: 0, lastInquiry: null }, leads: [],
    });
    fireEvent.click(await within(card).findByTestId('customer-delete'));
    expect(await screen.findByText('customers.delete.messageLeads')).toBeInTheDocument();
    expect(screen.getByText('customers.delete.blockedNote')).toBeInTheDocument();
  });
});
