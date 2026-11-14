import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import toast from 'react-hot-toast';
import DomainCard from '../../components/admin/DomainCard';
import {
  fetchUserDomain,
  connectUserDomain,
  checkUserDomain,
  disconnectUserDomain,
  AdminUserDomain,
  AdminDomainState,
} from '../../services/adminApi';

/**
 * LT-661 (phase 1): the operator connects a business's own domain from the
 * user page. The API is mocked on the contract's shape:
 * `{ configured, target, domain }` from every one of the four routes.
 */
const { t } = vi.hoisted(() => ({
  t: (key: string, vars?: Record<string, unknown>) => (vars?.host ? `${key}:${String(vars.host)}` : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/adminApi', () => ({
  fetchUserDomain: vi.fn(),
  connectUserDomain: vi.fn(),
  checkUserDomain: vi.fn(),
  disconnectUserDomain: vi.fn(),
}));

const TARGET = 'sites.lightor.app';
const answer = (domain: AdminDomainState | null, configured = true): AdminUserDomain => ({
  configured,
  target: TARGET,
  domain,
});
const pending: AdminDomainState = {
  host: 'www.dana-studio.co.il',
  status: 'pending',
  connectedAt: '2026-11-14T12:00:00.000Z',
  checkedAt: '2026-11-14T12:01:00.000Z',
};
const active: AdminDomainState = { ...pending, status: 'active', checkedAt: '2026-11-15T12:00:00.000Z', activeAt: '2026-11-15T12:00:00.000Z' };

/** The server's refusal, as axios hands it over. */
const refusal = (status: number, error: string) => ({ response: { status, data: { success: false, error } } });

const hostField = () => screen.getByLabelText('admin.domain.hostLabel') as HTMLInputElement;
const button = (name: string) => screen.getByRole('button', { name });

const RULES: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
};
const violations = async (): Promise<string[]> =>
  (await axe.run(document.body, RULES)).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);

describe('Admin: a site’s own domain (LT-661)', () => {
  beforeEach(() => {
    vi.mocked(fetchUserDomain).mockReset();
    vi.mocked(connectUserDomain).mockReset();
    vi.mocked(checkUserDomain).mockReset();
    vi.mocked(disconnectUserDomain).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('reads the state of the page’s user', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(null));
    render(<DomainCard userId="u9" />);
    await screen.findByText('admin.domain.connect');
    expect(fetchUserDomain).toHaveBeenCalledTimes(1);
    expect(fetchUserDomain).toHaveBeenCalledWith('u9');
  });

  it('a server without the Cloudflare token: says so, and offers nothing to type or press', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(null, false));
    render(<DomainCard userId="u9" />);

    expect(await screen.findByTestId('domain-not-configured')).toHaveTextContent('admin.domain.notConfigured');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('a server without the token still shows a domain it holds, with no actions', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(pending, false));
    render(<DomainCard userId="u9" />);

    expect(await screen.findByTestId('domain-host')).toHaveTextContent('www.dana-studio.co.il');
    expect(screen.getByTestId('domain-not-configured')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('no domain: the DNS record follows what is typed, and Connect waits for a host', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(null));
    render(<DomainCard userId="u9" />);

    expect(await screen.findByTestId('domain-dns')).toHaveTextContent(`CNAME www -> ${TARGET}`);
    expect(button('admin.domain.connect')).toBeDisabled();

    fireEvent.change(hostField(), { target: { value: '   ' } });
    expect(button('admin.domain.connect')).toBeDisabled();

    fireEvent.change(hostField(), { target: { value: 'Shop.Dana-Studio.co.il' } });
    expect(screen.getByTestId('domain-dns')).toHaveTextContent(`CNAME shop -> ${TARGET}`);
    expect(button('admin.domain.connect')).toBeEnabled();
  });

  it('connect sends the host trimmed and lower-cased, and shows what the server stored', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(null));
    vi.mocked(connectUserDomain).mockResolvedValue(answer(pending));
    render(<DomainCard userId="u9" />);

    fireEvent.change(await screen.findByLabelText('admin.domain.hostLabel'), { target: { value: '  WWW.Dana-Studio.CO.il ' } });
    fireEvent.click(button('admin.domain.connect'));

    expect(await screen.findByTestId('domain-host')).toHaveTextContent('www.dana-studio.co.il');
    expect(connectUserDomain).toHaveBeenCalledTimes(1);
    expect(connectUserDomain).toHaveBeenCalledWith('u9', 'www.dana-studio.co.il');
    expect(screen.getByText('admin.domain.status.pending')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('admin.domain.connected');
  });

  it('the buttons wait while a request runs: one press, one request', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(null));
    let settle: (value: AdminUserDomain) => void = () => {};
    vi.mocked(connectUserDomain).mockReturnValue(new Promise((resolve) => { settle = resolve; }));
    render(<DomainCard userId="u9" />);

    fireEvent.change(await screen.findByLabelText('admin.domain.hostLabel'), { target: { value: 'www.dana-studio.co.il' } });
    fireEvent.click(button('admin.domain.connect'));
    await waitFor(() => expect(button('admin.domain.connect')).toBeDisabled());
    fireEvent.submit(hostField().closest('form') as HTMLFormElement);
    expect(connectUserDomain).toHaveBeenCalledTimes(1);

    settle(answer(pending));
    expect(await screen.findByTestId('domain-host')).toBeInTheDocument();
  });

  it.each([
    [409, 'This domain is connected to another site'],
    [503, 'Custom domains are not configured'],
    [400, 'Not a valid host name'],
  ])('a refused connect (%i) shows the server’s own words and keeps what was typed', async (status, message) => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(null));
    vi.mocked(connectUserDomain).mockRejectedValue(refusal(status, message));
    render(<DomainCard userId="u9" />);

    fireEvent.change(await screen.findByLabelText('admin.domain.hostLabel'), { target: { value: 'www.taken.co.il' } });
    fireEvent.click(button('admin.domain.connect'));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(hostField()).toHaveValue('www.taken.co.il');
    expect(hostField()).toHaveAccessibleDescription(message);
    expect(button('admin.domain.connect')).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();

    // The reason belongs to that host: it leaves when the host is changed.
    fireEvent.change(hostField(), { target: { value: 'www.other.co.il' } });
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it('a connect that fails with no answer falls back to the panel’s own failure text', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(null));
    vi.mocked(connectUserDomain).mockRejectedValue(new Error('Network Error'));
    render(<DomainCard userId="u9" />);

    fireEvent.change(await screen.findByLabelText('admin.domain.hostLabel'), { target: { value: 'www.dana-studio.co.il' } });
    fireEvent.click(button('admin.domain.connect'));
    expect(await screen.findByText('admin.errors.actionFailed')).toBeInTheDocument();
  });

  it('pending: the host as text (no link yet), its chip, its times, the DNS record and both actions', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(pending));
    render(<DomainCard userId="u9" />);

    expect(await screen.findByTestId('domain-host')).toHaveTextContent('www.dana-studio.co.il');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('admin.domain.status.pending')).toBeInTheDocument();
    expect(screen.getByTestId('domain-connectedAt')).toHaveTextContent('14 Nov 2026');
    expect(screen.getByTestId('domain-checkedAt')).toHaveTextContent('14 Nov 2026');
    expect(screen.getByTestId('domain-activeAt')).toHaveTextContent('-');
    expect(screen.getByTestId('domain-dns')).toHaveTextContent(`CNAME www -> ${TARGET}`);
    expect(button('admin.domain.check')).toBeEnabled();
    expect(button('admin.domain.disconnect')).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('active: the host is a link to the site on it, in a new tab', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(active));
    render(<DomainCard userId="u9" />);

    const link = await screen.findByRole('link', { name: 'www.dana-studio.co.il' });
    expect(link).toHaveAttribute('href', 'https://www.dana-studio.co.il');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('admin.domain.status.active')).toBeInTheDocument();
    expect(screen.getByTestId('domain-activeAt')).toHaveTextContent('15 Nov 2026');
    // It works: the record is not asked for again.
    expect(screen.queryByTestId('domain-dns')).not.toBeInTheDocument();
  });

  it.each(['error', 'paused'] as const)('%s: its chip, and the reason when the server gives one', async (status) => {
    vi.mocked(fetchUserDomain).mockResolvedValue(
      answer({ ...pending, status, ...(status === 'error' ? { error: 'The CNAME record was not found' } : {}) })
    );
    render(<DomainCard userId="u9" />);

    expect(await screen.findByText(`admin.domain.status.${status}`)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    if (status === 'error') expect(screen.getByRole('alert')).toHaveTextContent('The CNAME record was not found');
    else expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('check now asks the server again and shows its answer', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(pending));
    vi.mocked(checkUserDomain).mockResolvedValue(answer(active));
    render(<DomainCard userId="u9" />);

    fireEvent.click(await screen.findByRole('button', { name: 'admin.domain.check' }));

    expect(await screen.findByRole('link', { name: 'www.dana-studio.co.il' })).toBeInTheDocument();
    expect(checkUserDomain).toHaveBeenCalledWith('u9');
    expect(screen.getByText('admin.domain.status.active')).toBeInTheDocument();
    expect(screen.queryByText('admin.domain.status.pending')).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('admin.domain.checked');
  });

  it('a check that fails says why and changes nothing', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(pending));
    vi.mocked(checkUserDomain).mockRejectedValue(refusal(502, 'Cloudflare did not answer'));
    render(<DomainCard userId="u9" />);

    fireEvent.click(await screen.findByRole('button', { name: 'admin.domain.check' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Cloudflare did not answer'));
    expect(screen.getByText('admin.domain.status.pending')).toBeInTheDocument();
    expect(button('admin.domain.check')).toBeEnabled();
  });

  it('disconnect asks first: cancel keeps the domain, confirm clears it', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(active));
    vi.mocked(disconnectUserDomain).mockResolvedValue(answer(null));
    render(<DomainCard userId="u9" />);

    fireEvent.click(await screen.findByRole('button', { name: 'admin.domain.disconnect' }));
    let dialog = screen.getByRole('dialog', { name: 'admin.domain.disconnectTitle' });
    expect(dialog).toHaveTextContent('admin.domain.disconnectConfirm:www.dana-studio.co.il');
    expect(disconnectUserDomain).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'admin.actions.cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(disconnectUserDomain).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'www.dana-studio.co.il' })).toBeInTheDocument();

    fireEvent.click(button('admin.domain.disconnect'));
    dialog = screen.getByRole('dialog', { name: 'admin.domain.disconnectTitle' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'admin.domain.disconnect' }));

    // Back to the empty state: the field and Connect.
    expect(await screen.findByLabelText('admin.domain.hostLabel')).toHaveValue('');
    expect(disconnectUserDomain).toHaveBeenCalledTimes(1);
    expect(disconnectUserDomain).toHaveBeenCalledWith('u9');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('admin.domain.disconnected');
  });

  it('a disconnect that fails keeps the domain and says why', async () => {
    vi.mocked(fetchUserDomain).mockResolvedValue(answer(active));
    vi.mocked(disconnectUserDomain).mockRejectedValue(refusal(503, 'Custom domains are not configured'));
    render(<DomainCard userId="u9" />);

    fireEvent.click(await screen.findByRole('button', { name: 'admin.domain.disconnect' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'admin.domain.disconnect' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Custom domains are not configured'));
    expect(screen.getByRole('link', { name: 'www.dana-studio.co.il' })).toBeInTheDocument();
  });

  it('a state that cannot be read: an error with a retry, not a broken page', async () => {
    vi.mocked(fetchUserDomain).mockRejectedValueOnce(new Error('500')).mockResolvedValue(answer(pending));
    render(<DomainCard userId="u9" />);

    expect(await screen.findByText('admin.domain.loadError')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(button('admin.domain.retry'));
    expect(await screen.findByTestId('domain-host')).toHaveTextContent('www.dana-studio.co.il');
  });

  // The same rules as the repo's axe gate (tests/a11y/axe.test.tsx, LT-362).
  describe.each(['ltr', 'rtl'] as const)('no WCAG A/AA violation axe can see (%s)', (dir) => {
    beforeEach(() => {
      document.documentElement.dir = dir;
    });

    it('the empty card with a refused host', async () => {
      vi.mocked(fetchUserDomain).mockResolvedValue(answer(null));
      vi.mocked(connectUserDomain).mockRejectedValue(refusal(400, 'Not a valid host name'));
      render(<DomainCard userId="u9" />);
      fireEvent.change(await screen.findByLabelText('admin.domain.hostLabel'), { target: { value: 'nope' } });
      fireEvent.click(button('admin.domain.connect'));
      await screen.findByText('Not a valid host name');
      expect(await violations()).toEqual([]);
    });

    it('a connected domain, and the question before disconnecting', async () => {
      vi.mocked(fetchUserDomain).mockResolvedValue(answer({ ...active, status: 'error', error: 'The CNAME record was not found' }));
      render(<DomainCard userId="u9" />);
      fireEvent.click(await screen.findByRole('button', { name: 'admin.domain.disconnect' }));
      expect(screen.getByRole('dialog')).toHaveAccessibleName();
      expect(await violations()).toEqual([]);
    });

    it('the active domain and the not-configured note', async () => {
      vi.mocked(fetchUserDomain).mockResolvedValue(answer(active, false));
      render(<DomainCard userId="u9" />);
      await screen.findByRole('link', { name: 'www.dana-studio.co.il' });
      expect(await violations()).toEqual([]);
    });
  });
});
