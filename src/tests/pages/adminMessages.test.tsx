import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminMessages from '../../pages/admin/AdminMessages';
import { countSystemMessageAudience, fetchSystemMessages, fetchUsers, sendSystemMessage } from '../../services/adminApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) =>
      o && 'n' in o ? `${key}:${o.n}` : o && 'names' in o ? `${key}:${o.names}` : key,
    i18n: { language: 'en' },
  }),
}));
vi.mock('../../services/adminApi', () => ({
  fetchSystemMessages: vi.fn(),
  sendSystemMessage: vi.fn(),
  countSystemMessageAudience: vi.fn(),
  fetchUsers: vi.fn(),
}));

const row = { _id: 'm1', title: 'Upkeep', body: 'Tonight', push: true, recipients: 22, pushed: 7, createdAt: '2026-11-01T10:00:00Z' };
const dana = { _id: 'u1', name: 'Dana', email: 'dana@example.com' };
const users = (data: Array<typeof dana>) =>
  ({ data, page: 1, limit: 8, total: data.length, totalPages: 1 }) as unknown as Awaited<ReturnType<typeof fetchUsers>>;

/**
 * LT-534 — the operator's message asks first and says how many it reaches;
 * LT-543 — to everyone, a group, or named accounts, minus the excluded.
 */
describe('AdminMessages', () => {
  beforeEach(() => {
    vi.mocked(fetchSystemMessages).mockReset().mockResolvedValue({ data: [], audience: 22 });
    vi.mocked(sendSystemMessage).mockReset().mockResolvedValue(row);
    vi.mocked(countSystemMessageAudience).mockReset().mockResolvedValue(22);
    vi.mocked(fetchUsers).mockReset().mockResolvedValue(users([dana]));
  });

  const fill = () => {
    fireEvent.change(screen.getByTestId('system-message-title'), { target: { value: ' Upkeep ' } });
    fireEvent.change(screen.getByTestId('system-message-body'), { target: { value: 'Tonight' } });
  };
  const confirm = () => fireEvent.click(screen.getAllByRole('button', { name: 'admin.messages.send' }).slice(-1)[0]);

  it('stays shut until both title and text are in', async () => {
    render(<AdminMessages />);
    await waitFor(() => expect(fetchSystemMessages).toHaveBeenCalled());
    expect(screen.getByTestId('system-message-send')).toBeDisabled();
    fireEvent.change(screen.getByTestId('system-message-title'), { target: { value: 'Upkeep' } });
    expect(screen.getByTestId('system-message-send')).toBeDisabled();
  });

  it('asks with the number of accounts, and sends to everyone only on yes', async () => {
    render(<AdminMessages />);
    await screen.findByText('admin.messages.empty');
    expect(await screen.findByText('admin.messages.audience.count:22')).toBeInTheDocument();
    fill();
    fireEvent.click(screen.getByTestId('system-message-send'));

    expect(await screen.findByText('admin.messages.confirm:22')).toBeInTheDocument();
    expect(sendSystemMessage).not.toHaveBeenCalled();

    vi.mocked(fetchSystemMessages).mockResolvedValue({ data: [row], audience: 22 });
    confirm();

    await waitFor(() =>
      expect(sendSystemMessage).toHaveBeenCalledWith({ title: 'Upkeep', body: 'Tonight', push: false, audience: {} })
    );
    expect(await screen.findByTestId('system-message-row')).toHaveTextContent('admin.messages.recipients:22');
    expect(screen.getByTestId('system-message-audience')).toHaveTextContent('admin.messages.audience.everyone');
    expect(screen.getByTestId('system-message-title')).toHaveValue('');
  });

  it('counts and sends to the group picked', async () => {
    vi.mocked(countSystemMessageAudience).mockImplementation(async (a) => (a.plans?.length ? 4 : 22));
    render(<AdminMessages />);
    await screen.findByText('admin.messages.audience.count:22');
    fireEvent.click(screen.getByTestId('audience-siteKinds-book'));
    fireEvent.click(screen.getByTestId('audience-plans-plus'));
    fireEvent.click(screen.getByTestId('audience-plans-pro'));
    fireEvent.click(screen.getByTestId('audience-languages-en'));

    expect(await screen.findByText('admin.messages.audience.count:4')).toBeInTheDocument();
    expect(countSystemMessageAudience).toHaveBeenLastCalledWith({
      siteKinds: ['book'],
      plans: ['plus', 'pro'],
      languages: ['en'],
    });
    fill();
    fireEvent.click(screen.getByTestId('system-message-send'));
    confirm();

    await waitFor(() =>
      expect(sendSystemMessage).toHaveBeenCalledWith(
        expect.objectContaining({ audience: { siteKinds: ['book'], plans: ['plus', 'pro'], languages: ['en'] } })
      )
    );
  });

  it('sends to named accounts only, and not before one is picked', async () => {
    vi.mocked(countSystemMessageAudience).mockResolvedValue(1);
    render(<AdminMessages />);
    await screen.findByText('admin.messages.empty');
    fill();
    fireEvent.click(screen.getByTestId('audience-mode-accounts'));

    expect(await screen.findByText('admin.messages.audience.count:0')).toBeInTheDocument();
    expect(screen.getByTestId('system-message-send')).toBeDisabled();

    fireEvent.change(screen.getByTestId('audience-accounts-input'), { target: { value: 'dana' } });
    fireEvent.click(await screen.findByTestId('audience-accounts-result'));
    expect(screen.getByTestId('audience-accounts-chip')).toHaveTextContent('Dana');
    expect(await screen.findByText('admin.messages.audience.count:1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('system-message-send'));
    confirm();
    await waitFor(() => expect(sendSystemMessage).toHaveBeenCalledWith(expect.objectContaining({ audience: { accounts: ['u1'] } })));
  });

  it('leaves the excluded out, and the history says who it went to', async () => {
    vi.mocked(fetchSystemMessages).mockResolvedValue({
      data: [{ ...row, audience: { plans: ['trial'], exclude: [dana] } }],
      audience: 22,
    });
    render(<AdminMessages />);
    const shown = (await screen.findByTestId('system-message-audience')).textContent?.replace(/[\u2068\u2069]/g, '');
    expect(shown).toBe('admin.messages.audience.plans.label: admin.messages.audience.plans.trial · admin.messages.audience.without:Dana');

    fireEvent.change(screen.getByTestId('audience-exclude-input'), { target: { value: 'da' } });
    fireEvent.click(await screen.findByTestId('audience-exclude-result'));
    await waitFor(() => expect(countSystemMessageAudience).toHaveBeenLastCalledWith({ exclude: ['u1'] }));
  });
});
