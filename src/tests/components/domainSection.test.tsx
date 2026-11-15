import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import toast from 'react-hot-toast';
import DomainSection, { AUTO_CHECK_MS } from '../../components/settings/DomainSection';
import { useOwnDomain } from '../../hooks/useOwnDomain';
import { checkDomain, connectDomain, disconnectDomain, fetchDomain, type DomainAnswer, type DomainState } from '../../services/domainApi';

/**
 * LT-661 (phase 2): the owner's own domain in Settings > Site. The API is
 * mocked on the contract's shapes: every route answers
 * `{ configured, allowed, target, domain }`, a refusal carries `code`, and a
 * domain another site holds carries the TXT `proof`.
 */
const { t } = vi.hoisted(() => ({
  // The key, then whatever was put in it: "key|host=x|address=y".
  t: (key: string, vars?: Record<string, unknown>) =>
    [key, ...Object.entries(vars ?? {}).filter(([k]) => k !== 'defaultValue').map(([k, v]) => `${k}=${String(v)}`)].join('|'),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/domainApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/domainApi')>()),
  fetchDomain: vi.fn(),
  connectDomain: vi.fn(),
  checkDomain: vi.fn(),
  disconnectDomain: vi.fn(),
}));

const P = 'settings.customDomain';
const TARGET = 'sites.lightor.app';
const HOST = 'www.dana-studio.co.il';
const LIGHTOR = 'dana.lightor.app';

const answer = (domain: DomainState | null, over: Partial<DomainAnswer> = {}): DomainAnswer => ({
  configured: true,
  allowed: true,
  target: TARGET,
  domain,
  ...over,
});
const pending: DomainState = {
  host: HOST,
  status: 'pending',
  stage: 'dns',
  // The server's own words, in English: never on the owner's screen.
  error: 'pending_validation (custom hostname is pending)',
  connectedAt: '2026-11-15T10:00:00.000Z',
  expiresAt: '2026-11-18T10:00:00.000Z',
};
const certificate: DomainState = { ...pending, stage: 'certificate' };
const active: DomainState = { host: HOST, status: 'active', stage: 'active', connectedAt: pending.connectedAt, activeAt: '2026-11-15T10:20:00.000Z' };
const broken: DomainState = { ...active, status: 'error', stage: 'dns', error: 'The custom hostname was deleted (moved)' };
const paused: DomainState = { ...active, status: 'paused', pausedAt: '2026-11-15T03:00:00.000Z', expiresAt: '2026-12-15T03:00:00.000Z' };

/** The server's refusal, as axios hands it over. */
const refusal = (status: number, code?: string, extra: Record<string, unknown> = {}) => ({
  response: { status, data: { success: false, error: 'English words from the server', ...(code ? { code } : {}), ...extra } },
});
const PROOF = { name: `_lightor.${HOST}`, value: 'lightor-site=0123456789abcdef0123456789abcdef' };

const served = vi.fn();
const Harness: React.FC = () => {
  const own = useOwnDomain({ onServedChange: served });
  return <DomainSection own={own} lightorHost={LIGHTOR} />;
};
const mount = () =>
  render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>
  );
/** Mounted, with the first read in. */
const show = async (first: DomainAnswer) => {
  vi.mocked(fetchDomain).mockResolvedValue(first);
  const view = mount();
  await waitFor(() => expect(screen.queryByTestId('domain-loading')).toBeNull());
  return view;
};

const box = () => screen.getByTestId('own-domain');
const field = () => screen.getByLabelText(`${P}.form.label`) as HTMLInputElement;
const button = (name: string) => screen.getByRole('button', { name });
const status = () => screen.getByTestId('domain-status');
const w = window as unknown as { Capacitor?: unknown };
const writeText = vi.fn();

const RULES: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
};
const violations = async (): Promise<string[]> =>
  (await axe.run(document.body, RULES)).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);

beforeEach(() => {
  for (const fn of [fetchDomain, connectDomain, checkDomain, disconnectDomain]) vi.mocked(fn).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  served.mockReset();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});
afterEach(() => {
  vi.useRealTimers();
  delete w.Capacitor;
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  document.documentElement.dir = 'ltr';
});

describe('the own-domain row: what the server offers', () => {
  it('a server with no Cloudflare: the "coming soon" row as it was, nothing to type or press, no tour anchor', async () => {
    await show(answer(null, { configured: false, allowed: false }));
    expect(screen.getByTestId('coming-soon')).toBeInTheDocument();
    expect(screen.getByText(`${P}.title`)).toBeInTheDocument();
    expect(screen.getByText(`${P}.desc`)).toBeInTheDocument();
    expect(within(box()).queryByRole('textbox')).toBeNull();
    expect(within(box()).queryByRole('button')).toBeNull();
    expect(within(box()).queryByRole('link')).toBeNull();
    expect(box()).not.toHaveAttribute('data-tour');
    expect(fetchDomain).toHaveBeenCalledTimes(1);
  });

  it('an API from before the feature (404): "coming soon" too, and no error', async () => {
    vi.mocked(fetchDomain).mockRejectedValue(refusal(404));
    mount();
    expect(await screen.findByTestId('coming-soon')).toBeInTheDocument();
    expect(screen.queryByTestId('domain-load-error')).toBeNull();
  });

  it('a read that failed: says so, and "try again" reads it again', async () => {
    vi.mocked(fetchDomain).mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue(answer(null));
    mount();
    expect(await screen.findByTestId('domain-load-error')).toHaveTextContent(`${P}.loadError`);
    expect(screen.queryByTestId('coming-soon')).toBeNull();
    fireEvent.click(button(`${P}.retry`));
    expect(await screen.findByTestId('domain-form')).toBeInTheDocument();
    expect(fetchDomain).toHaveBeenCalledTimes(2);
  });

  it('a plan without it: a locked row with the way to the plans, and nothing to type', async () => {
    await show(answer(null, { allowed: false }));
    const locked = screen.getByTestId('domain-locked');
    expect(locked).toHaveTextContent(`${P}.locked.body`);
    expect(screen.getByText(`${P}.locked.badge`)).toBeInTheDocument();
    expect(screen.getByTestId('domain-upgrade')).toHaveAttribute('href', '/account');
    expect(within(box()).queryByRole('textbox')).toBeNull();
    // On every plan the tour has its row to point at.
    expect(box()).toHaveAttribute('data-tour', 'settings-domain');
  });

  it('in the apps the locked row states the fact and sells nothing (LT-130)', async () => {
    w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    await show(answer(null, { allowed: false }));
    expect(screen.getByTestId('domain-locked')).toHaveTextContent(`${P}.locked.body`);
    expect(screen.queryByTestId('domain-upgrade')).toBeNull();
  });
});

describe('the own-domain row: connecting', () => {
  it('no domain: a named field for the domain that was bought, and Connect once something is typed', async () => {
    await show(answer(null));
    expect(field()).toHaveAttribute('dir', 'ltr');
    expect(field()).toHaveAttribute('placeholder', 'dana-studio.co.il');
    expect(screen.getByText(`${P}.form.help`)).toBeInTheDocument();
    expect(button(`${P}.form.connect`)).toBeDisabled();
    fireEvent.change(field(), { target: { value: '   ' } });
    expect(button(`${P}.form.connect`)).toBeDisabled();
    fireEvent.change(field(), { target: { value: 'dana-studio.co.il' } });
    expect(button(`${P}.form.connect`)).toBeEnabled();
    expect(box()).toHaveAttribute('data-tour', 'settings-domain');
  });

  it('connects what was typed, shows the name the server stored, and hands the focus to it', async () => {
    await show(answer(null));
    vi.mocked(connectDomain).mockResolvedValue(answer(pending));
    fireEvent.change(field(), { target: { value: '  https://Dana-Studio.co.il/  ' } });
    fireEvent.click(button(`${P}.form.connect`));

    const host = await screen.findByTestId('domain-host');
    // The server tidies the name (scheme, case, the bare domain to www): it is sent as typed.
    expect(connectDomain).toHaveBeenCalledWith('https://Dana-Studio.co.il/');
    expect(host).toHaveTextContent(HOST);
    expect(host).toHaveAttribute('dir', 'ltr');
    expect(screen.getByTestId('domain-card')).toHaveAttribute('data-view', 'pending');
    await waitFor(() => expect(host).toHaveFocus());
    expect(toast.success).toHaveBeenCalledWith(`${P}.saved`);
    expect(screen.queryByTestId('domain-form')).toBeNull();
    // Pending is not served yet: the site's address has not changed.
    expect(served).not.toHaveBeenCalled();
  });

  it('a domain that is live at once says "connected" once, and the page hears the new address', async () => {
    await show(answer(null));
    vi.mocked(connectDomain).mockResolvedValue(answer(active));
    fireEvent.change(field(), { target: { value: 'dana-studio.co.il' } });
    fireEvent.click(button(`${P}.form.connect`));
    await screen.findByTestId('domain-host');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(`${P}.connected`));
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(served).toHaveBeenCalledWith(HOST);
  });

  it.each([
    ['INVALID_DOMAIN', 400],
    ['DOMAIN_TAKEN', 409],
    ['PLAN_REQUIRED', 403],
    ['TOO_MANY', 429],
    ['CLOUDFLARE_REFUSED', 502],
    ['CLOUDFLARE_UNREACHABLE', 502],
    ['DOMAINS_NOT_CONFIGURED', 503],
    ['NO_SITE', 404],
  ])('%s: its own words under the field, said aloud, never the server\'s English', async (code, httpStatus) => {
    await show(answer(null));
    vi.mocked(fetchDomain).mockResolvedValue(answer(null));
    vi.mocked(connectDomain).mockRejectedValue(refusal(httpStatus, code));
    fireEvent.change(field(), { target: { value: 'dana-studio.co.il' } });
    fireEvent.click(button(`${P}.form.connect`));

    await waitFor(() => expect(screen.getByTestId('domain-alert')).toHaveTextContent(`${P}.errors.${code}`));
    expect(screen.getByTestId('domain-alert')).toHaveAttribute('role', 'alert');
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveAccessibleDescription(`${P}.errors.${code}`);
    expect(box()).not.toHaveTextContent('English words from the server');
    // The name stays, to be fixed with the reason in view.
    expect(field()).toHaveValue('dana-studio.co.il');
    fireEvent.change(field(), { target: { value: 'dana-studio.co' } });
    expect(screen.getByTestId('domain-alert')).toBeEmptyDOMElement();
  });

  it('a refusal with no code, and a server that was not reached: the general words', async () => {
    await show(answer(null));
    vi.mocked(connectDomain).mockRejectedValueOnce(refusal(500)).mockRejectedValueOnce(new Error('Network Error'));
    fireEvent.change(field(), { target: { value: 'dana-studio.co.il' } });
    fireEvent.click(button(`${P}.form.connect`));
    await waitFor(() => expect(screen.getByTestId('domain-alert')).toHaveTextContent(`${P}.errors.generic`));
    fireEvent.click(button(`${P}.form.connect`));
    await waitFor(() => expect(connectDomain).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('domain-alert')).toHaveTextContent(`${P}.errors.generic`));
    expect(box()).not.toHaveTextContent('Network Error');
  });

  it('a plan that changed under the form: the row is read again and shows what is true now', async () => {
    await show(answer(null));
    vi.mocked(fetchDomain).mockResolvedValue(answer(null, { allowed: false }));
    vi.mocked(connectDomain).mockRejectedValue(refusal(403, 'PLAN_REQUIRED'));
    fireEvent.change(field(), { target: { value: 'dana-studio.co.il' } });
    fireEvent.click(button(`${P}.form.connect`));
    expect(await screen.findByTestId('domain-locked')).toBeInTheDocument();
    expect(fetchDomain).toHaveBeenCalledTimes(2);
  });
});

describe('the own-domain row: a domain another site holds (TXT proof)', () => {
  const taken = async () => {
    await show(answer(null));
    vi.mocked(connectDomain).mockRejectedValue(refusal(409, 'DOMAIN_TAKEN', { proof: PROOF }));
    fireEvent.change(field(), { target: { value: 'dana-studio.co.il' } });
    fireEvent.click(button(`${P}.form.connect`));
    return screen.findByTestId('domain-proof');
  };

  it('shows the TXT record: the name as registrars take it, the value, the full name, each to copy', async () => {
    const card = await taken();
    expect(card).toHaveTextContent(`${P}.proof.title`);
    expect(card).toHaveTextContent(`${P}.proof.body`);
    expect(screen.getByTestId('domain-value-proof-type')).toHaveTextContent('TXT');
    expect(screen.getByTestId('domain-value-proof-name')).toHaveTextContent('_lightor.www');
    expect(screen.getByTestId('domain-value-proof-value')).toHaveTextContent(PROOF.value);
    expect(screen.getByTestId('domain-value-proof-full-name')).toHaveTextContent(PROOF.name);
    for (const id of ['proof-name', 'proof-value', 'proof-full-name']) {
      expect(screen.getByTestId(`domain-value-${id}`)).toHaveAttribute('dir', 'ltr');
    }
    // "TXT" is typed nowhere: no button for it.
    expect(screen.queryByTestId('domain-copy-proof-type')).toBeNull();

    fireEvent.click(screen.getByTestId('domain-copy-proof-name'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('_lightor.www'));
    fireEvent.click(screen.getByTestId('domain-copy-proof-value'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(PROOF.value));
    fireEvent.click(screen.getByTestId('domain-copy-proof-full-name'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(PROOF.name));
    expect(toast.success).toHaveBeenCalledWith(`${P}.copied`);
    // The short refusal is said too, and the typed name stays for the second press.
    expect(screen.getByTestId('domain-alert')).toHaveTextContent(`${P}.errors.DOMAIN_TAKEN`);
    expect(field()).toHaveValue('dana-studio.co.il');
  });

  it('Connect again, once the record is in, moves the domain here', async () => {
    await taken();
    vi.mocked(connectDomain).mockResolvedValue(answer(pending));
    fireEvent.click(button(`${P}.form.connect`));
    expect(await screen.findByTestId('domain-host')).toHaveTextContent(HOST);
    expect(connectDomain).toHaveBeenCalledTimes(2);
    expect(connectDomain).toHaveBeenLastCalledWith('dana-studio.co.il');
    expect(screen.queryByTestId('domain-proof')).toBeNull();
  });

  it('the record proves one name: typing another puts it away', async () => {
    await taken();
    fireEvent.change(field(), { target: { value: 'other-studio.co.il' } });
    expect(screen.queryByTestId('domain-proof')).toBeNull();
  });

  it('a taken domain with no proof from the server: the words alone', async () => {
    await show(answer(null));
    vi.mocked(connectDomain).mockRejectedValue(refusal(409, 'DOMAIN_TAKEN'));
    fireEvent.change(field(), { target: { value: 'dana-studio.co.il' } });
    fireEvent.click(button(`${P}.form.connect`));
    await waitFor(() => expect(screen.getByTestId('domain-alert')).toHaveTextContent(`${P}.errors.DOMAIN_TAKEN`));
    expect(screen.queryByTestId('domain-proof')).toBeNull();
  });

  it('says when a value could not be copied', async () => {
    await taken();
    writeText.mockRejectedValue(new Error('denied'));
    Object.defineProperty(document, 'execCommand', { value: vi.fn(() => false), configurable: true });
    fireEvent.click(screen.getByTestId('domain-copy-proof-value'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`${P}.copyFailed`));
  });
});

describe('the own-domain row: a connected domain', () => {
  it('waiting for the record: the status line, when it is released, and what to do at the registrar', async () => {
    await show(answer(pending));
    expect(screen.getByTestId('domain-card')).toHaveAttribute('data-view', 'pending');
    expect(status()).toHaveAttribute('role', 'status');
    expect(status()).toHaveTextContent(`${P}.status.dns`);
    expect(screen.getByText(`${P}.badge.pending`)).toBeInTheDocument();
    // The date in the page's own style, from `expiresAt`.
    expect(screen.getByTestId('domain-expires')).toHaveTextContent(`${P}.pendingUntil|date=18 November 2026`);
    expect(screen.getByText(`${P}.autoCheck`)).toBeInTheDocument();
    // Not a link until it is live.
    expect(screen.getByTestId('domain-host').tagName).toBe('P');
    expect(box()).not.toHaveTextContent('pending_validation');

    // (1) the CNAME: the host's first label to the target; (2) the bare domain forwarded to the host.
    const records = screen.getByTestId('domain-records');
    expect(within(records).getByText(`1. ${P}.records.step1`)).toBeInTheDocument();
    expect(screen.getByTestId('domain-value-type')).toHaveTextContent('CNAME');
    expect(screen.getByTestId('domain-value-name')).toHaveTextContent(/^www$/);
    expect(screen.getByTestId('domain-value-target')).toHaveTextContent(TARGET);
    expect(within(records).getByText(`2. ${P}.records.step2|domain=dana-studio.co.il`)).toBeInTheDocument();
    expect(screen.getByTestId('domain-value-forward')).toHaveTextContent(`https://${HOST}`);
    expect(within(records).getByText(`${P}.records.mail`)).toBeInTheDocument();
    for (const id of ['name', 'target', 'forward']) expect(screen.getByTestId(`domain-value-${id}`)).toHaveAttribute('dir', 'ltr');

    // Where the registrars keep it.
    const guide = screen.getByTestId('domain-guide');
    expect(guide).toHaveTextContent(`${P}.records.guideGeneral`);
    expect(guide).toHaveTextContent('GoDaddy');
    expect(guide).toHaveTextContent('My Products > dana-studio.co.il > DNS > Add New Record');
    expect(guide).toHaveTextContent('DNS > Forwarding');
    expect(guide).toHaveTextContent('Namecheap');
    expect(guide).toHaveTextContent('Domain List > Manage > Advanced DNS > Add New Record');
    expect(guide).toHaveTextContent('Domain > Redirect Domain');

    expect(button(`${P}.check`)).toBeEnabled();
    expect(button(`${P}.disconnect`)).toBeEnabled();
  });

  it('every value to paste has a copy button that copies exactly it', async () => {
    await show(answer(pending));
    fireEvent.click(screen.getByTestId('domain-copy-name'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('www'));
    fireEvent.click(screen.getByTestId('domain-copy-target'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(TARGET));
    fireEvent.click(screen.getByTestId('domain-copy-forward'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(`https://${HOST}`));
    // Each button says what it copies.
    expect(screen.getByTestId('domain-copy-name')).toHaveAccessibleName(`${P}.copyOf|what=${P}.records.name`);
    expect(screen.getByTestId('domain-copy-target')).toHaveAccessibleName(`${P}.copyOf|what=${P}.records.value`);
    expect(screen.queryByTestId('domain-copy-type')).toBeNull();
  });

  it('a host that is not `www` has no bare domain to forward: the CNAME alone', async () => {
    await show(answer({ ...pending, host: 'shop.dana-studio.co.il' }));
    expect(screen.getByTestId('domain-value-name')).toHaveTextContent(/^shop$/);
    expect(screen.queryByTestId('domain-value-forward')).toBeNull();
    expect(screen.getByTestId('domain-guide')).not.toHaveTextContent('Forwarding');
    expect(screen.getByTestId('domain-guide')).toHaveTextContent('My Products > shop.dana-studio.co.il > DNS > Add New Record');
  });

  it('the record was found: the line says the certificate is on its way', async () => {
    await show(answer(certificate));
    expect(status()).toHaveTextContent(`${P}.status.certificate`);
    expect(status()).not.toHaveTextContent(`${P}.status.dns`);
  });

  it('live: the address is a link, the records fold away, "check now" and "disconnect" stay', async () => {
    await show(answer(active));
    expect(screen.getByTestId('domain-card')).toHaveAttribute('data-view', 'active');
    const link = screen.getByTestId('domain-host');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', `https://${HOST}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('dir', 'ltr');
    expect(status()).toHaveTextContent(`${P}.activeBody|address=${LIGHTOR}`);
    expect(screen.getByText(`${P}.badge.active`)).toBeInTheDocument();
    expect(screen.getByTestId('domain-records-fold')).not.toHaveAttribute('open');
    expect(screen.getByText(`${P}.records.summary`)).toBeInTheDocument();
    expect(screen.queryByTestId('domain-expires')).toBeNull();
    expect(button(`${P}.check`)).toBeEnabled();
    expect(button(`${P}.disconnect`)).toBeEnabled();
    // Read as it is: nothing said, nothing changed.
    expect(toast.success).not.toHaveBeenCalled();
    expect(served).not.toHaveBeenCalled();
  });

  it('a problem: the reason in the owner\'s words, the records, "check now" - never the server\'s English', async () => {
    await show(answer(broken));
    expect(screen.getByTestId('domain-card')).toHaveAttribute('data-view', 'error');
    expect(status()).toHaveTextContent(`${P}.errorBody`);
    expect(screen.getByText(`${P}.badge.error`)).toBeInTheDocument();
    expect(screen.getByTestId('domain-records')).toBeInTheDocument();
    expect(button(`${P}.check`)).toBeEnabled();
    expect(box()).not.toHaveTextContent('custom hostname was deleted');
  });

  it('paused: why, until when, the way to the plans; it can still be disconnected, and there is nothing to check', async () => {
    await show(answer(paused, { allowed: false }));
    expect(screen.getByTestId('domain-card')).toHaveAttribute('data-view', 'paused');
    expect(status()).toHaveTextContent(`${P}.pausedBody|address=${LIGHTOR}|date=15 December 2026`);
    expect(screen.getByText(`${P}.badge.paused`)).toBeInTheDocument();
    expect(screen.getByTestId('domain-upgrade')).toHaveAttribute('href', '/account');
    expect(screen.queryByRole('button', { name: `${P}.check` })).toBeNull();
    expect(screen.queryByTestId('domain-records')).toBeNull();
    expect(button(`${P}.disconnect`)).toBeEnabled();
    expect(screen.getByTestId('domain-host').tagName).toBe('P');
  });

  it('paused with no date from the server: the same, without one', async () => {
    await show(answer({ ...paused, expiresAt: undefined }, { allowed: false }));
    expect(status()).toHaveTextContent(`${P}.pausedBodyNoDate|address=${LIGHTOR}`);
  });

  it('a plan without it holds a domain only paused, whatever was stored last', async () => {
    await show(answer(active, { allowed: false }));
    expect(screen.getByTestId('domain-card')).toHaveAttribute('data-view', 'paused');
    expect(screen.getByTestId('domain-host').tagName).toBe('P');
  });

  it('"check now" asks the server, and says what it found', async () => {
    await show(answer(pending));
    vi.mocked(checkDomain).mockResolvedValueOnce(answer(certificate)).mockResolvedValueOnce(answer(active));
    const check = button(`${P}.check`);
    check.focus();
    fireEvent.click(check);
    await waitFor(() => expect(status()).toHaveTextContent(`${P}.status.certificate`));
    expect(toast.success).toHaveBeenCalledWith(`${P}.checked`);
    // The pressed button is still there, and still has the focus.
    expect(button(`${P}.check`)).toBe(check);
    await waitFor(() => expect(check).toBeEnabled());
    expect(check).toHaveFocus();
    expect(served).not.toHaveBeenCalled();

    fireEvent.click(check);
    await waitFor(() => expect(screen.getByTestId('domain-card')).toHaveAttribute('data-view', 'active'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(`${P}.connected`));
    expect(toast.success).toHaveBeenCalledTimes(2);
    expect(served).toHaveBeenCalledTimes(1);
    expect(served).toHaveBeenCalledWith(HOST);
    expect(button(`${P}.check`)).toBe(check);
  });

  it('a check that failed says so in its own words, and the card stays', async () => {
    await show(answer(pending));
    vi.mocked(checkDomain).mockRejectedValue(refusal(502, 'CLOUDFLARE_UNREACHABLE'));
    fireEvent.click(button(`${P}.check`));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`${P}.errors.CLOUDFLARE_UNREACHABLE`));
    expect(screen.getByTestId('domain-host')).toHaveTextContent(HOST);
    await waitFor(() => expect(button(`${P}.check`)).toBeEnabled());
  });

  it('disconnect asks first; "no" changes nothing', async () => {
    await show(answer(active));
    fireEvent.click(button(`${P}.disconnect`));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(`${P}.disconnectTitle`);
    expect(dialog).toHaveTextContent(`${P}.disconnectConfirm|host=${HOST}|address=${LIGHTOR}`);
    fireEvent.click(within(dialog).getByRole('button', { name: 'admin.actions.cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(disconnectDomain).not.toHaveBeenCalled();
    expect(screen.getByTestId('domain-host')).toHaveTextContent(HOST);
  });

  it('disconnect, confirmed: the field is back with the focus in it, and the page hears the address is gone', async () => {
    await show(answer(active));
    vi.mocked(disconnectDomain).mockResolvedValue(answer(null));
    fireEvent.click(button(`${P}.disconnect`));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: `${P}.disconnect` }));

    await waitFor(() => expect(screen.getByTestId('domain-form')).toBeInTheDocument());
    expect(disconnectDomain).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(`${P}.disconnected`);
    await waitFor(() => expect(field()).toHaveFocus());
    expect(served).toHaveBeenCalledTimes(1);
    expect(served).toHaveBeenCalledWith(null);
  });

  it('a disconnect that failed says so, and the domain stays', async () => {
    await show(answer(pending));
    vi.mocked(disconnectDomain).mockRejectedValue(refusal(502, 'CLOUDFLARE_UNREACHABLE'));
    fireEvent.click(button(`${P}.disconnect`));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: `${P}.disconnect` }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`${P}.errors.CLOUDFLARE_UNREACHABLE`));
    expect(screen.getByTestId('domain-host')).toHaveTextContent(HOST);
  });
});

describe('the own-domain row: checking by itself while it waits', () => {
  /** Fake clock from before the mount, so the timer is the fake one; the first read is let in. */
  const showTimed = async (first: DomainAnswer) => {
    vi.useFakeTimers();
    vi.mocked(fetchDomain).mockResolvedValue(first);
    const view = mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    return view;
  };
  const pass = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it('asks every 15 seconds, quietly, and stops the moment it is live', async () => {
    expect(AUTO_CHECK_MS).toBe(15_000);
    await showTimed(answer(pending));
    vi.mocked(checkDomain).mockResolvedValueOnce(answer(pending)).mockResolvedValueOnce(answer(certificate)).mockResolvedValue(answer(active));

    await pass(14_999);
    expect(checkDomain).not.toHaveBeenCalled();
    await pass(1);
    expect(checkDomain).toHaveBeenCalledTimes(1);
    // Quiet: no "checked" toast, no busy button.
    expect(toast.success).not.toHaveBeenCalled();
    expect(button(`${P}.check`)).toBeEnabled();

    await pass(15_000);
    expect(checkDomain).toHaveBeenCalledTimes(2);
    expect(status()).toHaveTextContent(`${P}.status.certificate`);

    await pass(15_000);
    expect(checkDomain).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('domain-card')).toHaveAttribute('data-view', 'active');
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(`${P}.connected`);
    expect(served).toHaveBeenCalledWith(HOST);

    // Live: nobody asks any more.
    await pass(60_000);
    expect(checkDomain).toHaveBeenCalledTimes(3);
  });

  it('a quiet check that failed says nothing, and the next round asks again', async () => {
    await showTimed(answer(pending));
    vi.mocked(checkDomain).mockRejectedValueOnce(refusal(502, 'CLOUDFLARE_UNREACHABLE')).mockResolvedValue(answer(pending));
    await pass(15_000);
    expect(checkDomain).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByTestId('domain-host')).toHaveTextContent(HOST);
    await pass(15_000);
    expect(checkDomain).toHaveBeenCalledTimes(2);
  });

  it('stops when the row leaves the screen', async () => {
    const view = await showTimed(answer(pending));
    vi.mocked(checkDomain).mockResolvedValue(answer(pending));
    await pass(15_000);
    expect(checkDomain).toHaveBeenCalledTimes(1);
    view.unmount();
    await pass(60_000);
    expect(checkDomain).toHaveBeenCalledTimes(1);
  });

  it('stops while the tab is hidden, and starts over when it is back', async () => {
    await showTimed(answer(pending));
    vi.mocked(checkDomain).mockResolvedValue(answer(pending));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await pass(60_000);
    expect(checkDomain).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await pass(14_999);
    expect(checkDomain).not.toHaveBeenCalled();
    await pass(1);
    expect(checkDomain).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['live', answer(active)],
    ['a problem', answer(broken)],
    ['paused', answer(paused, { allowed: false })],
    ['waiting on a plan without it (paused)', answer(pending, { allowed: false })],
    ['no domain', answer(null)],
    ['a locked row', answer(null, { allowed: false })],
    ['coming soon', answer(null, { configured: false, allowed: false })],
  ])('never runs when the domain is not waiting: %s', async (_name, first) => {
    await showTimed(first);
    await pass(120_000);
    expect(checkDomain).not.toHaveBeenCalled();
  });

  it('stops once the domain is disconnected, and a late quiet answer never brings it back', async () => {
    await showTimed(answer(pending));
    // The timer's check is out, and slow.
    let land: (value: DomainAnswer) => void = () => undefined;
    vi.mocked(checkDomain).mockReturnValueOnce(new Promise<DomainAnswer>((resolve) => { land = resolve; }));
    await pass(15_000);
    expect(checkDomain).toHaveBeenCalledTimes(1);

    vi.mocked(disconnectDomain).mockResolvedValue(answer(null));
    fireEvent.click(button(`${P}.disconnect`));
    await pass(0);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: `${P}.disconnect` }));
    await pass(0);
    expect(screen.getByTestId('domain-form')).toBeInTheDocument();

    // The old answer lands after the disconnect: dropped.
    await act(async () => {
      land(answer(pending));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('domain-form')).toBeInTheDocument();
    expect(screen.queryByTestId('domain-host')).toBeNull();
    await pass(120_000);
    expect(checkDomain).toHaveBeenCalledTimes(1);
  });
});

describe('the own-domain row: accessibility and whole names', () => {
  const LONG = `www.${'a-very-long-business-name-'.repeat(4)}studio.co.il`;

  it.each(['ltr', 'rtl'] as const)('no WCAG A/AA violation axe can see in any state (%s)', async (dir) => {
    document.documentElement.dir = dir;
    for (const first of [
      answer(null, { configured: false, allowed: false }),
      answer(null, { allowed: false }),
      answer(null),
      answer(pending),
      answer(active),
      answer(broken),
      answer(paused, { allowed: false }),
    ]) {
      const view = await show(first);
      expect(await violations()).toEqual([]);
      view.unmount();
    }
    // The refusal, the proof card and the question before a disconnect.
    await show(answer(null));
    vi.mocked(connectDomain).mockRejectedValue(refusal(409, 'DOMAIN_TAKEN', { proof: PROOF }));
    fireEvent.change(field(), { target: { value: 'dana-studio.co.il' } });
    fireEvent.click(button(`${P}.form.connect`));
    await screen.findByTestId('domain-proof');
    expect(await violations()).toEqual([]);
  });

  it('the row is a group named by its title, and the field is named by its label', async () => {
    await show(answer(null));
    expect(screen.getByRole('group', { name: `${P}.title` })).toBe(box());
    expect(field()).toHaveAccessibleName(`${P}.form.label`);
    expect(field()).toHaveAccessibleDescription(`${P}.form.help`);
  });

  it('never cuts a name: a long host wraps whole, and nothing in the row truncates (LT-510)', async () => {
    await show(answer({ ...pending, host: LONG }));
    expect(screen.getByTestId('domain-host')).toHaveTextContent(LONG);
    expect(screen.getByTestId('domain-host').className).toContain('break-all');
    expect(screen.getByTestId('domain-value-forward')).toHaveTextContent(`https://${LONG}`);
    expect(screen.getByTestId('domain-value-forward').className).toContain('break-all');
    const cut = Array.from(box().querySelectorAll<HTMLElement>('*')).filter((el) => /\b(truncate|line-clamp-\S+|text-ellipsis|whitespace-nowrap)\b/.test(String(el.className)));
    // The status pill is one short word; nothing else may refuse to wrap.
    expect(cut.map((el) => el.textContent)).toEqual([`${P}.badge.pending`]);
    expect(box().textContent).not.toMatch(/\.\.\.|…/);
  });
});
