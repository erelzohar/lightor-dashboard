import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Leads from '../../pages/Leads';
import { fetchLeads, updateLeadStatus, deleteLead } from '../../services/leadsApi';
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
vi.mock('../../services/leadsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/leadsApi')>()),
  fetchLeads: vi.fn(),
  updateLeadStatus: vi.fn(),
  deleteLead: vi.fn(),
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
    render(<><Leads /><Badge /></>);

    const cards = await screen.findAllByTestId('lead-card');
    expect(cards).toHaveLength(2);
    const first = within(cards[0]);
    expect(first.getByText('Dana Levi')).toBeInTheDocument();
    expect(first.getByText('Kitchen renovation')).toBeInTheDocument();
    expect(first.getByText('Haifa')).toBeInTheDocument();
    expect(first.getByText('0584006014').closest('a')).toHaveAttribute('href', 'tel:0584006014');
    expect(first.getByText('leads.whatsapp').closest('a')).toHaveAttribute('href', 'https://wa.me/972584006014');
    await waitFor(() => expect(screen.getByTestId('badge')).toHaveTextContent('1'));
  });

  it('filters by status', async () => {
    render(<Leads />);
    await screen.findAllByTestId('lead-card');

    fireEvent.click(screen.getByRole('tab', { name: /leads\.status\.closed/ }));

    await waitFor(() => expect(fetchLeads).toHaveBeenLastCalledWith({ status: 'closed', page: 1, limit: 20 }));
  });

  it('changes a status and reloads', async () => {
    render(<Leads />);
    const cards = await screen.findAllByTestId('lead-card');

    fireEvent.click(within(cards[0]).getByRole('button', { name: 'leads.status.contacted' }));

    await waitFor(() => expect(updateLeadStatus).toHaveBeenCalledWith('l1', 'contacted'));
    await waitFor(() => expect(fetchLeads).toHaveBeenCalledTimes(2));
  });

  it('deletes only after the confirmation', async () => {
    render(<Leads />);
    const cards = await screen.findAllByTestId('lead-card');

    fireEvent.click(within(cards[1]).getByRole('button', { name: 'leads.delete' }));
    expect(deleteLead).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'leads.delete' }));

    await waitFor(() => expect(deleteLead).toHaveBeenCalledWith('l2'));
  });

  it('shows the empty state', async () => {
    vi.mocked(fetchLeads).mockResolvedValue(page([], { new: 0, contacted: 0, closed: 0 }) as never);
    render(<Leads />);
    expect(await screen.findByTestId('leads-empty')).toBeInTheDocument();
    expect(screen.getByText('leads.empty')).toBeInTheDocument();
  });
});
