import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Leads from '../../pages/Leads';

/** The page reads its filter from the address (LT-288), so it renders inside a router. */
const renderAt = (ui: React.ReactElement, path = '/leads') =>
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
import { fetchLeads, updateLeadStatus, deleteLead, addLeadToCustomer } from '../../services/leadsApi';
import { fetchCustomer, fetchCustomers, type CustomerRecord } from '../../services/customersApi';
import { useNewLeadsCount } from '../../hooks/useNewLeadsCount';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }),
}));
const state = vi.hoisted(() => ({
  webConfig: {
    data: { leadFields: [{ key: 'area', label: 'Area', type: 'text', required: true, services: [] }] },
  },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: (): (() => void) => vi.fn() }));
vi.mock('../../store/slices/webConfigSlice', () => ({ fetchWebConfig: vi.fn() }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
vi.mock('../../services/customersApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/customersApi')>()),
  fetchCustomer: vi.fn(),
  fetchCustomers: vi.fn(),
}));
vi.mock('../../services/leadsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/leadsApi')>()),
  fetchLeads: vi.fn(),
  updateLeadStatus: vi.fn(),
  deleteLead: vi.fn(),
  addLeadToCustomer: vi.fn(),
}));

const lead = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  _id: id,
  name,
  phone: '0584006014',
  status: 'new',
  createdAt: '2026-09-27T10:00:00.000Z',
  updatedAt: '2026-09-27T10:00:00.000Z',
  ...extra,
});

const page = (data: unknown[], counts = { new: 1, contacted: 1, closed: 0 }) => ({
  success: true,
  data,
  pagination: { total: data.length, page: 1, limit: 20, pages: 1 },
  counts,
});

const Badge = () => <span data-testid="badge">{String(useNewLeadsCount(false))}</span>;

/** The Leads page (LT-197): list, filter, status, delete — and the badge follows. */
describe('Leads page', () => {
  beforeEach(() => {
    vi.mocked(fetchLeads).mockReset().mockResolvedValue(page([
      lead('l1', 'Dana Levi', { message: 'Kitchen renovation', answers: [{ key: 'area', label: 'Area', value: 'Haifa' }] }),
      lead('l2', 'Moshe Cohen', { status: 'contacted' }),
    ]) as never);
    vi.mocked(updateLeadStatus).mockReset().mockResolvedValue({} as never);
    vi.mocked(deleteLead).mockReset().mockResolvedValue(undefined);
  });

  it('lists leads with call and WhatsApp links, message and answers, and feeds the badge', async () => {
    renderAt(<><Leads /><Badge /></>);

    const cards = await screen.findAllByTestId('lead-card');
    expect(cards).toHaveLength(2);
    const first = within(cards[0]);
    expect(first.getByText('Dana Levi')).toBeInTheDocument();
    expect(first.getByText('Kitchen renovation')).toBeInTheDocument();
    expect(first.getByText('Haifa')).toBeInTheDocument();
    expect(first.getByText('058-4006014').closest('a')).toHaveAttribute('href', 'tel:+972584006014');
    expect(first.getByText('leads.whatsapp').closest('a')).toHaveAttribute('href', 'https://wa.me/972584006014');
    await waitFor(() => expect(screen.getByTestId('badge')).toHaveTextContent('1'));
  });

  it('filters by status', async () => {
    renderAt(<Leads />);
    await screen.findAllByTestId('lead-card');

    fireEvent.mouseDown(screen.getByRole('tab', { name: /leads\.status\.closed/ })); // chosen on press (LT-313)

    await waitFor(() => expect(fetchLeads).toHaveBeenLastCalledWith({ status: 'closed', page: 1, limit: 20 }));
  });

  it('opens on the filter the link names, and ignores one it does not know (LT-288)', async () => {
    const { unmount } = renderAt(<Leads />, '/leads?status=new');
    await waitFor(() => expect(fetchLeads).toHaveBeenLastCalledWith({ status: 'new', page: 1, limit: 20 }));
    expect(screen.getByRole('tab', { name: /leads\.status\.new/ })).toHaveAttribute('aria-selected', 'true');
    unmount();

    renderAt(<Leads />, '/leads?status=spam');
    await waitFor(() => expect(fetchLeads).toHaveBeenLastCalledWith({ status: undefined, page: 1, limit: 20 }));
  });

  it('changes a status and reloads', async () => {
    renderAt(<Leads />);
    const cards = await screen.findAllByTestId('lead-card');

    fireEvent.click(within(cards[0]).getByRole('button', { name: 'leads.status.contacted' }));

    await waitFor(() => expect(updateLeadStatus).toHaveBeenCalledWith('l1', 'contacted'));
    await waitFor(() => expect(fetchLeads).toHaveBeenCalledTimes(2));
  });

  it('deletes only after the confirmation', async () => {
    renderAt(<Leads />);
    const cards = await screen.findAllByTestId('lead-card');

    fireEvent.click(within(cards[1]).getByRole('button', { name: 'leads.delete' }));
    expect(deleteLead).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'leads.delete' }));

    await waitFor(() => expect(deleteLead).toHaveBeenCalledWith('l2'));
  });

  it('shows the empty state', async () => {
    vi.mocked(fetchLeads).mockResolvedValue(page([], { new: 0, contacted: 0, closed: 0 }) as never);
    renderAt(<Leads />);
    expect(await screen.findByTestId('leads-empty')).toBeInTheDocument();
    expect(screen.getByText('leads.empty')).toBeInTheDocument();
  });

  it("opens the writer's customer card from the lead, when there is one (LT-376)", async () => {
    vi.mocked(fetchLeads).mockReset().mockResolvedValue(page([
      lead('l1', 'Dana Levi', { customerId: 'c9' }),
      lead('l2', 'Moshe Cohen', { customerId: null }),
    ]) as never);
    vi.mocked(fetchCustomer).mockResolvedValue({
      customer: {
        _id: 'c9', name: 'Dana Levi', phone: '0584006014', phoneNormalized: '+972584006014', isBlocked: false, blockedAt: null,
        blockReason: null, notes: '', source: 'lead', firstSeenAt: '2026-09-27T10:00:00.000Z', lastSeenAt: '2026-09-27T10:00:00.000Z',
        createdAt: '2026-09-27T10:00:00.000Z',
      },
      stats: { visits: 0, cancelled: 0, upcoming: 0, revenue: 0, lastVisit: null, nextVisit: null },
      history: [],
      leadStats: { inquiries: 1, lastInquiry: '2026-09-27T10:00:00.000Z' },
      leads: [{ _id: 'l1', createdAt: '2026-09-27T10:00:00.000Z', status: 'new', message: 'Kitchen', answers: [] }],
    });
    renderAt(<Leads />);

    const cards = await screen.findAllByTestId('lead-card');
    expect(within(cards[1]).queryByText('leads.customerCard')).toBeNull();
    fireEvent.click(within(cards[0]).getByText('leads.customerCard'));

    const card = await screen.findByRole('dialog', { name: 'customers.detail.title' });
    expect(fetchCustomer).toHaveBeenCalledWith('c9');
    expect(await within(card).findByText('Kitchen')).toBeInTheDocument();
  });

  describe('adding a lead to the customers (LT-382)', () => {
    const customer = (id: string, name: string, phone: string): CustomerRecord => ({
      _id: id, name, phone, phoneNormalized: '+972' + phone.slice(1), isBlocked: false, blockedAt: null, blockReason: null,
      notes: '', source: 'lead', firstSeenAt: '2026-09-27T10:00:00.000Z', lastSeenAt: '2026-09-27T10:00:00.000Z',
      createdAt: '2026-09-27T10:00:00.000Z',
    });

    beforeEach(() => {
      vi.mocked(fetchLeads).mockReset().mockResolvedValue(page([
        lead('l1', 'Dana Levi', { customerId: null }),
        lead('l2', 'Old API', {}),
      ]) as never);
      vi.mocked(addLeadToCustomer).mockReset();
      vi.mocked(fetchCustomers).mockReset();
    });

    it('offers it only to a lead with no customer, and adds a new customer from its details', async () => {
      vi.mocked(addLeadToCustomer).mockResolvedValue(customer('c1', 'Dana L', '0584006014') as never);
      renderAt(<Leads />);

      const cards = await screen.findAllByTestId('lead-card');
      // An older API says nothing about customers: nothing is offered.
      expect(within(cards[1]).queryByText('leads.addToCustomers')).toBeNull();
      fireEvent.click(within(cards[0]).getByText('leads.addToCustomers'));

      const dialog = await screen.findByRole('dialog', { name: 'leads.toCustomer.title' });
      const name = within(dialog).getByLabelText('customers.add.name');
      expect(name).toHaveValue('Dana Levi');
      // The phone field shows it formatted, and sends it in E.164 (LT-407).
      expect(within(dialog).getByLabelText('customers.add.phone')).toHaveValue('058-400-6014');
      fireEvent.change(name, { target: { value: 'Dana L' } });
      const calls = vi.mocked(fetchLeads).mock.calls.length;
      fireEvent.click(within(dialog).getByText('leads.toCustomer.addNew'));

      await waitFor(() => expect(addLeadToCustomer).toHaveBeenCalledWith('l1', { name: 'Dana L', phone: '+972584006014' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'leads.toCustomer.title' })).toBeNull());
      // Read again: other leads from that number now have the customer too.
      expect(vi.mocked(fetchLeads).mock.calls.length).toBeGreaterThan(calls);
    });

    it('says so when the number is already a customer, with the way to that card', async () => {
      vi.mocked(addLeadToCustomer).mockRejectedValue({ response: { status: 409, data: { code: 'CUSTOMER_EXISTS', customerId: 'c7' } } });
      vi.mocked(fetchCustomer).mockResolvedValue({
        customer: customer('c7', 'Dana', '0584006014'),
        stats: { visits: 0, cancelled: 0, upcoming: 0, revenue: 0, lastVisit: null, nextVisit: null },
        history: [],
        leadStats: { inquiries: 0, lastInquiry: null },
        leads: [],
      } as never);
      renderAt(<Leads />);

      fireEvent.click(within((await screen.findAllByTestId('lead-card'))[0]).getByText('leads.addToCustomers'));
      const dialog = await screen.findByRole('dialog', { name: 'leads.toCustomer.title' });
      fireEvent.click(within(dialog).getByText('leads.toCustomer.addNew'));

      expect(await within(dialog).findByText('leads.toCustomer.exists')).toBeInTheDocument();
      fireEvent.click(within(dialog).getByText('leads.toCustomer.openExisting'));
      await screen.findByRole('dialog', { name: 'customers.detail.title' });
      expect(fetchCustomer).toHaveBeenCalledWith('c7');
    });

    it('adds it to an existing customer picked from the search', async () => {
      vi.mocked(fetchCustomers).mockResolvedValue({
        success: true, count: 2, pagination: { total: 2, page: 1, limit: 8, pages: 1 },
        data: [customer('c2', 'Moshe Cohen', '0521111111'), customer('c3', 'Dana Work', '0532222222')],
      } as never);
      vi.mocked(addLeadToCustomer).mockResolvedValue(customer('c3', 'Dana Work', '0532222222') as never);
      renderAt(<Leads />);

      fireEvent.click(within((await screen.findAllByTestId('lead-card'))[0]).getByText('leads.addToCustomers'));
      const dialog = await screen.findByRole('dialog', { name: 'leads.toCustomer.title' });
      fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'leads.toCustomer.existing' }));

      const pick = within(dialog).getByText('leads.toCustomer.addToPicked').closest('button')!;
      expect(pick).toBeDisabled();
      fireEvent.click(await within(dialog).findByText('Dana Work'));
      expect(pick).not.toBeDisabled();
      fireEvent.click(pick);

      await waitFor(() => expect(addLeadToCustomer).toHaveBeenCalledWith('l1', { customerId: 'c3' }));
      expect(fetchCustomers).toHaveBeenCalledWith(expect.objectContaining({ limit: 8 }));
    });
  });
});
