import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminMessages from '../../pages/admin/AdminMessages';
import { fetchSystemMessages, sendSystemMessage } from '../../services/adminApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) => (o && 'n' in o ? `${key}:${o.n}` : key),
    i18n: { language: 'en' },
  }),
}));
vi.mock('../../services/adminApi', () => ({ fetchSystemMessages: vi.fn(), sendSystemMessage: vi.fn() }));

const row = { _id: 'm1', title: 'Upkeep', body: 'Tonight', push: true, recipients: 22, pushed: 7, createdAt: '2026-11-01T10:00:00Z' };

/** LT-534 — the operator's message to every account asks first and says how many it reaches. */
describe('AdminMessages', () => {
  beforeEach(() => {
    vi.mocked(fetchSystemMessages).mockReset().mockResolvedValue({ data: [], audience: 22 });
    vi.mocked(sendSystemMessage).mockReset().mockResolvedValue(row);
  });

  const fill = () => {
    fireEvent.change(screen.getByTestId('system-message-title'), { target: { value: ' Upkeep ' } });
    fireEvent.change(screen.getByTestId('system-message-body'), { target: { value: 'Tonight' } });
  };

  it('stays shut until both title and text are in', async () => {
    render(<AdminMessages />);
    await waitFor(() => expect(fetchSystemMessages).toHaveBeenCalled());
    expect(screen.getByTestId('system-message-send')).toBeDisabled();
    fireEvent.change(screen.getByTestId('system-message-title'), { target: { value: 'Upkeep' } });
    expect(screen.getByTestId('system-message-send')).toBeDisabled();
  });

  it('asks with the number of accounts, and sends only on yes', async () => {
    render(<AdminMessages />);
    await screen.findByText('admin.messages.empty');
    fill();
    fireEvent.click(screen.getByTestId('system-message-send'));

    expect(await screen.findByText('admin.messages.confirm:22')).toBeInTheDocument();
    expect(sendSystemMessage).not.toHaveBeenCalled();

    vi.mocked(fetchSystemMessages).mockResolvedValue({ data: [row], audience: 22 });
    fireEvent.click(screen.getAllByRole('button', { name: 'admin.messages.send' }).at(-1)!);

    await waitFor(() => expect(sendSystemMessage).toHaveBeenCalledWith({ title: 'Upkeep', body: 'Tonight', push: false }));
    expect(await screen.findByTestId('system-message-row')).toHaveTextContent('admin.messages.recipients:22');
    expect(screen.getByTestId('system-message-title')).toHaveValue('');
  });
});
