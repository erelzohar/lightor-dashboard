import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomerDetailDrawer from '../../components/customers/CustomerDetailDrawer';
import { fetchCustomer, type CustomerDetail } from '../../services/customersApi';
import { removeLeadFromCustomer } from '../../services/leadsApi';

/**
 * LT-376, LT-382 — a customer's leads in their card. On a leads site the
 * card shows what they wrote instead of visits, has no booking button, and
 * blocking speaks of messages; on a booking site what they wrote joins the
 * visits when there is any. A lead the owner added from another number can
 * be taken off.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
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
}));
vi.mock('../../services/leadsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/leadsApi')>()),
  removeLeadFromCustomer: vi.fn().mockResolvedValue(undefined),
}));

const record: CustomerDetail['customer'] = {
  _id: 'c1', name: 'Rona', phone: '0547654321', phoneNormalized: '+972547654321', isBlocked: false, blockedAt: null,
  blockReason: null, notes: '', source: 'lead', firstSeenAt: '2026-09-01T09:00:00Z', lastSeenAt: '2026-10-01T09:00:00Z',
  createdAt: '2026-09-01T09:00:00Z',
};
const noVisits: CustomerDetail['stats'] = { visits: 0, cancelled: 0, upcoming: 0, revenue: 0, lastVisit: null, nextVisit: null };
const wrote: NonNullable<CustomerDetail['leads']> = [
  { _id: 'l2', createdAt: '2026-10-01T09:00:00Z', status: 'contacted', message: 'Still interested', answers: [] },
  { _id: 'l1', createdAt: '2026-09-01T09:00:00Z', status: 'closed', message: 'How much is a kitchen?', answers: [{ key: 'area', label: 'Area', value: 'Haifa' }] },
];

const openCard = async (detail: CustomerDetail) => {
  vi.mocked(fetchCustomer).mockResolvedValue(detail);
  render(
    <MemoryRouter>
      <CustomerDetailDrawer customerId="c1" onClose={vi.fn()} onChanged={vi.fn()} />
    </MemoryRouter>
  );
  return screen.findByRole('dialog', { name: 'customers.detail.title' });
};

describe('the customer card and what they wrote (LT-376)', () => {
  beforeEach(() => {
    state.webConfig.data = null;
  });

  it('on a leads site: what they wrote instead of visits, no booking, blocking speaks of messages', async () => {
    state.webConfig.data = { conversion: 'lead' };
    const card = await openCard({
      customer: record, stats: noVisits, history: [],
      leadStats: { inquiries: 2, lastInquiry: '2026-10-01T09:00:00Z' }, leads: wrote,
    });

    const inquiries = await within(card).findByTestId('customer-inquiries');
    expect(within(inquiries).getByText('Still interested')).toBeInTheDocument();
    expect(within(inquiries).getByText('How much is a kitchen?')).toBeInTheDocument();
    expect(within(inquiries).getByText('Haifa')).toBeInTheDocument();
    expect(within(inquiries).getByText('leads.status.contacted')).toBeInTheDocument();
    expect(within(inquiries).getByText('customers.detail.allLeads').closest('a')).toHaveAttribute('href', '/leads');
    expect(within(card).getByText('customers.columns.inquiries').nextElementSibling).toHaveTextContent('2');
    expect(within(card).getByText('customers.source.lead')).toBeInTheDocument();
    expect(within(card).queryByText('customers.detail.schedule')).toBeNull();
    expect(within(card).queryByText('customers.detail.history')).toBeNull();
    expect(within(card).queryByText('customers.columns.revenue')).toBeNull();

    fireEvent.click(within(card).getByText('customers.block.title'));
    expect(await screen.findByText('customers.block.messageLeads')).toBeInTheDocument();
    expect(screen.queryByTestId('cancel-upcoming')).toBeNull();
  });

  it('on a leads site, someone added by hand who never wrote: says so', async () => {
    state.webConfig.data = { conversion: 'lead' };
    const card = await openCard({
      customer: { ...record, source: 'manual' }, stats: noVisits, history: [],
      leadStats: { inquiries: 0, lastInquiry: null }, leads: [],
    });
    expect(await within(card).findByText('customers.detail.noInquiries')).toBeInTheDocument();
    expect(within(card).queryByText('customers.detail.allLeads')).toBeNull();
  });

  it('on a booking site: the visits as before, and what they wrote below when there is any', async () => {
    const withLeads = await openCard({
      customer: { ...record, source: 'booking' }, stats: noVisits, history: [],
      leadStats: { inquiries: 2, lastInquiry: '2026-10-01T09:00:00Z' }, leads: wrote,
    });
    expect(await within(withLeads).findByTestId('customer-inquiries')).toBeInTheDocument();
    expect(within(withLeads).getByText('customers.detail.schedule')).toBeInTheDocument();
    expect(within(withLeads).getByText('customers.detail.history')).toBeInTheDocument();
  });

  it('on a booking site, with nothing written (or an older API): no section for it', async () => {
    const card = await openCard({ customer: { ...record, source: 'booking' }, stats: noVisits, history: [] });
    expect(await within(card).findByText('customers.detail.history')).toBeInTheDocument();
    expect(within(card).queryByTestId('customer-inquiries')).toBeNull();
  });

  it('takes off a lead the owner added from another number, and only that one (LT-382)', async () => {
    state.webConfig.data = { conversion: 'lead' };
    const card = await openCard({
      customer: record, stats: noVisits, history: [],
      leadStats: { inquiries: 2, lastInquiry: '2026-10-01T09:00:00Z' },
      leads: [{ ...wrote[0], byChoice: true }, wrote[1]],
    });

    const inquiries = await within(card).findByTestId('customer-inquiries');
    const offButtons = within(inquiries).getAllByText('customers.detail.removeLead');
    expect(offButtons).toHaveLength(1);
    const loads = vi.mocked(fetchCustomer).mock.calls.length;
    fireEvent.click(offButtons[0]);

    await waitFor(() => expect(removeLeadFromCustomer).toHaveBeenCalledWith('l2'));
    await waitFor(() => expect(vi.mocked(fetchCustomer).mock.calls.length).toBeGreaterThan(loads));
  });
});
