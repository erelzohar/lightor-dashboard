import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageTour, { forgetToursDoneHere } from '../../components/tour/PageTour';
import { tourFor } from '../../components/tour/tours';
import { markTourSeen, setToursOff } from '../../services/toursApi';
import he from '../../i18n/locales/he.json';
import en from '../../i18n/locales/en.json';
import ar from '../../i18n/locales/ar.json';
import fr from '../../i18n/locales/fr.json';
import es from '../../i18n/locales/es.json';

/**
 * LT-389 — Lighty's page tours: once per page per account, one lit part at
 * a time, parts that are not on the page left out, and nothing while the
 * account says no or another popup is open.
 */
const { t } = vi.hoisted(() => ({ t: (key: string, o?: Record<string, unknown>) => (o && 'n' in o ? `${key}:${o.n}/${o.total}` : key) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
const state = vi.hoisted(() => ({
  user: { _id: 'u1', tours: undefined as undefined | { seen?: string[]; off?: boolean } },
  webConfig: { data: { conversion: 'book' } as null | { conversion?: string } },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: state.user } }) }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown => selector({ webConfig: state.webConfig }),
}));
vi.mock('../../services/toursApi', () => ({
  markTourSeen: vi.fn().mockResolvedValue({ seen: [], off: false }),
  setToursOff: vi.fn().mockResolvedValue({ seen: [], off: true }),
  restartTours: vi.fn(),
}));
// jsdom lays nothing out: a part is "on screen" unless it says otherwise.
vi.mock('../../components/tour/geometry', () => ({
  isVisible: (el: Element) => (el as HTMLElement).dataset.offscreen !== 'true',
  findTarget: (selectors: string[]) => {
    for (const s of selectors) {
      const el = Array.from(document.querySelectorAll<HTMLElement>(s)).find((e) => e.dataset.offscreen !== 'true');
      if (el) return el;
    }
    return null;
  },
}));

const renderAt = (path: string, page: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      {page}
      <PageTour enabled settleMs={0} />
    </MemoryRouter>
  );

const customersPage = (
  <div>
    <button data-tour="add-customer">add</button>
    <div data-tour="customers-table">table</div>
  </div>
);

describe('Lighty page tours (LT-389)', () => {
  beforeEach(() => {
    state.user = { _id: 'u1', tours: undefined };
    state.webConfig.data = { conversion: 'book' };
    forgetToursDoneHere();
    vi.mocked(markTourSeen).mockClear();
    vi.mocked(setToursOff).mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("walks the page's parts that are there, back and forth, and marks the tour done at the end", async () => {
    renderAt('/customers', customersPage);

    const card = await screen.findByRole('dialog', { name: 'tour.customers.add.title' });
    expect(card).toHaveTextContent('tour.step:1/2');
    fireEvent.click(screen.getByText('tour.next'));
    expect(await screen.findByRole('dialog', { name: 'tour.customers.table.title' })).toHaveTextContent('tour.step:2/2');
    fireEvent.click(screen.getByText('tour.prev'));
    expect(await screen.findByRole('dialog', { name: 'tour.customers.add.title' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('tour.next'));
    fireEvent.click(await screen.findByText('tour.done'));

    await waitFor(() => expect(screen.queryByTestId('page-tour')).toBeNull());
    expect(markTourSeen).toHaveBeenCalledWith('customers');
  });

  it('shows nothing for a tour already done, or with tours off', async () => {
    state.user = { _id: 'u1', tours: { seen: ['customers'] } };
    const { unmount } = renderAt('/customers', customersPage);
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByTestId('page-tour')).toBeNull();
    unmount();

    state.user = { _id: 'u1', tours: { off: true } };
    renderAt('/customers', customersPage);
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByTestId('page-tour')).toBeNull();
  });

  it('waits while another popup is open', async () => {
    const popup = document.createElement('div');
    popup.setAttribute('aria-modal', 'true');
    document.body.appendChild(popup);
    renderAt('/customers', customersPage);

    await act(() => new Promise((r) => setTimeout(r, 120)));
    expect(screen.queryByTestId('page-tour')).toBeNull();
    popup.remove();
    expect(await screen.findByRole('dialog', { name: 'tour.customers.add.title' }, { timeout: 2000 })).toBeInTheDocument();
  });

  it('Escape skips the tour for good; "don\'t show tours" turns them all off', async () => {
    const { unmount } = renderAt('/customers', customersPage);
    const card = await screen.findByRole('dialog', { name: 'tour.customers.add.title' });
    fireEvent.keyDown(card, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('page-tour')).toBeNull());
    expect(markTourSeen).toHaveBeenCalledWith('customers');
    unmount();

    forgetToursDoneHere();
    renderAt('/appointments', <div><div data-tour="calendar">cal</div></div>);
    fireEvent.click(await screen.findByText('tour.turnOff'));
    await waitFor(() => expect(screen.queryByTestId('page-tour')).toBeNull());
    expect(setToursOff).toHaveBeenCalledWith(true);
  });

  it('waits for the site to be known', async () => {
    state.webConfig.data = null;
    renderAt('/customers', customersPage);
    await act(() => new Promise((r) => setTimeout(r, 120)));
    expect(screen.queryByTestId('page-tour')).toBeNull();
  });

  it('leaves a page with none of its parts for a later visit', async () => {
    renderAt('/customers', <div>empty</div>);
    await act(() => new Promise((r) => setTimeout(r, 120)));
    expect(screen.queryByTestId('page-tour')).toBeNull();
    expect(markTourSeen).not.toHaveBeenCalled();
  });

  it("the home tour opens with Lighty's hello and tells a leads site about its inquiries", async () => {
    state.webConfig.data = { conversion: 'lead' };
    renderAt('/', <div><div data-tour="stats">stats</div><nav data-tour="nav">nav</nav></div>);

    expect(await screen.findByRole('dialog', { name: 'tour.home.intro.title' })).toHaveTextContent('tour.step:1/3');
    fireEvent.click(screen.getByText('tour.next'));
    expect(await screen.findByRole('dialog', { name: 'tour.home.statsLeads.title' })).toBeInTheDocument();
  });

  it('has its words in all five languages', () => {
    const paths = ['/', '/lighty', '/design', '/appointments', '/leads', '/customers', '/schedule-vacations', '/appointment-types', '/portfolio', '/settings', '/account'];
    const keys = new Set<string>();
    for (const p of paths) for (const leads of [false, true]) tourFor(p, leads)?.steps.forEach((s) => keys.add(s.key));
    expect(keys.size).toBeGreaterThan(30);
    for (const locale of [he, en, ar, fr, es] as unknown as Array<{ tour: Record<string, unknown> }>) {
      for (const ui of ['next', 'prev', 'done', 'skip', 'turnOff', 'step']) expect(typeof locale.tour[ui]).toBe('string');
      for (const key of keys) {
        const node = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], locale.tour) as { title?: string; body?: string };
        expect(node?.title, key).toBeTruthy();
        expect(node?.body, key).toBeTruthy();
      }
    }
  });
});
