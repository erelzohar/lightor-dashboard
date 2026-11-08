import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Dashboard from '../../pages/Dashboard';
import { fetchLeads, fetchLeadStats, LeadStats } from '../../services/leadsApi';
import { fetchProductViews, listProducts, type Product, type ProductViews } from '../../services/productsApi';
import { askRate, litDots, rankProducts } from '../../lib/productsHome';

const { t } = vi.hoisted(() => ({
  t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}(${Object.values(opts).join(',')})` : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/authApi', () => ({ resendVerification: vi.fn() }));
vi.mock('../../services/entitlementsApi', () => ({
  fetchMyEntitlements: vi.fn(() => Promise.resolve({ plan: 'plus', limits: { monthlyLeads: null }, usage: { leadsThisMonth: 4 }, pilot: null })),
}));
vi.mock('../../services/leadsApi', () => ({ fetchLeads: vi.fn(), fetchLeadStats: vi.fn() }));
vi.mock('../../services/productsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/productsApi')>()),
  listProducts: vi.fn(),
  fetchProductViews: vi.fn(),
}));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'rtl', language: 'he', darkMode: false }) }));
const user = vi.hoisted(() => ({
  _id: 'u1', name: 'Dana', isVerified: true, boardingStatus: 'active', subscription: { status: 'free' }, webConfig_id: 'wc1',
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user, isAuthenticated: true, isLoading: false }, updateUser: vi.fn() }),
}));
interface MockState {
  webConfig: { data: Record<string, unknown>; loading: boolean };
  appointments: { appointments: unknown[]; appointmentTypes: unknown[]; loading: boolean };
}
const state = vi.hoisted<MockState>(() => ({
  webConfig: { data: {}, loading: false },
  appointments: { appointments: [], appointmentTypes: [], loading: false },
}));
vi.mock('../../hooks/useAppSelector', () => ({ useAppSelector: (selector: (s: MockState) => unknown): unknown => selector(state) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn(() => Promise.resolve({})) }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  fetchAppointments: vi.fn(() => ({ type: 'appointments/fetch' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'appointments/fetchTypes' })),
}));
vi.mock('../../store/slices/webConfigSlice', () => ({ fetchWebConfig: vi.fn(() => ({ type: 'webConfig/fetch' })) }));
vi.mock('../../components/appointments/AppointmentDetails', () => ({ default: (): null => null }));

const site = (catalog: boolean) => ({
  _id: 'wc1', businessName: 'Dana Polish', subDomain: 'dana', conversion: 'lead', catalog, currency: 'ILS',
  contact: { phone: '0501234567' }, address: { city: 'Haifa', street: 'Herzl 1' }, logoImageName: 'logo.webp',
});

const product = (id: string, name: string, over: Partial<Product> = {}): Product => ({
  _id: id, slug: id, name, price: 4990, images: [{ url: `${id}.webp` }], details: [], status: 'published', availability: 'in_stock', order: 0, ...over,
});
const products = [
  product('p1', 'Pink polish'),
  product('p2', 'Red polish'),
  product('p3', 'Top coat', { images: [] }),
  product('p4', 'Lamp'),
  product('p5', 'Hidden draft', { status: 'draft' }),
];

const day = (i: number) => new Date(Date.UTC(2026, 9, 11 + i)).toISOString().slice(0, 10);
const perDay = (f: (i: number) => number) => Array.from({ length: 30 }, (_, i) => ({ date: day(i), count: f(i) }));
const views = (over: Partial<ProductViews> = {}): ProductViews => ({
  total: 200, byProduct: { p1: 20, p2: 90, p4: 90 }, perDay: perDay((i) => (i === 29 ? 12 : 6)), since: day(0), ...over,
});
const stats = (over: Partial<LeadStats> = {}): LeadStats => ({
  thisMonth: 6,
  lastMonth: 4,
  lastMonthToDate: 3,
  waiting: 2,
  last30: { total: 8, handled: 6 },
  avgResponseMs: null,
  perDay: perDay((i) => (i % 5 === 0 ? 1 : 0)),
  topic: { label: 'What for?', items: [{ value: 'Gift', count: 3 }], other: 0 },
  products: {
    total: 7,
    byProduct: { p1: 4, p2: 3 },
    perDay: perDay((i) => (i === 29 ? 2 : i % 6 === 0 ? 1 : 0)),
    picks: [
      { value: 'ורוד', kind: 'color', hex: '#f4a6c1', count: 4 },
      { value: 'M', kind: 'size', count: 2 },
    ],
  },
  ...over,
});
const lead = (id: string, product?: { product_id: string; name: string; options?: string }) => ({
  _id: id, name: `Visitor ${id}`, phone: '0584006014', status: 'new', createdAt: '2026-11-08T10:00:00.000Z', updatedAt: '2026-11-08T10:00:00.000Z',
  ...(product ? { product } : {}),
});
const page = {
  success: true,
  data: [lead('l1', { product_id: 'p1', name: 'Pink polish', options: 'ורוד, M' }), lead('l2'), lead('l3', { product_id: 'gone', name: 'Old one' })],
  pagination: { total: 3, page: 1, limit: 5, pages: 1 },
  counts: { new: 2, contacted: 1, closed: 0 },
};

beforeEach(() => {
  navigate.mockReset();
  state.webConfig.data = site(true);
  vi.mocked(fetchLeads).mockReset().mockResolvedValue(page as never);
  vi.mocked(fetchLeadStats).mockReset().mockResolvedValue(stats());
  vi.mocked(listProducts).mockReset().mockResolvedValue({ products, limits: { maxProducts: 15, productPages: true } } as never);
  vi.mocked(fetchProductViews).mockReset().mockResolvedValue(views());
});

/** The number a screen reader hears: the final one, whatever the count-up shows meanwhile. */
const spoken = (cell: HTMLElement) => cell.querySelector('dd .sr-only')?.textContent;

/** LT-624 (Erel: "the products dashboard and the leads dashboard look exactly the same"). */
describe('A products site has its own home', () => {
  it('leads with the shop\'s band of four numbers, not the leads home\'s cards', async () => {
    render(<Dashboard />);
    const band = await screen.findByTestId('stats-band');
    expect(screen.queryByTestId('leads-stats')).toBeNull();
    expect(screen.queryByTestId('leads-chart')).toBeNull();
    expect(screen.queryByTestId('leads-topics')).toBeNull();

    const inquiries = within(band).getByTestId('band-stat-inquiries');
    expect(within(inquiries).getByText('dashboard.productsHome.inquiries')).toBeInTheDocument();
    expect(spoken(inquiries)).toBe('6');
    expect(within(inquiries).getByTestId('band-change')).toHaveTextContent('100%'); // 6 against 3
    expect(within(inquiries).getByTestId('band-visual-trend')).toBeInTheDocument();

    const seen = within(band).getByTestId('band-stat-views');
    expect(spoken(seen)).toBe('200');
    expect(within(seen).getByTestId('band-context')).toHaveTextContent('dashboard.productsHome.mostViewed(Red polish)');
    expect(within(seen).getByTestId('band-visual-bars').querySelectorAll('span')).toHaveLength(30);

    // 7 inquiries about products in 200 views: 3.5 in every hundred, four dots lit.
    const rate = within(band).getByTestId('band-stat-rate');
    expect(spoken(rate)).toBe('3.5');
    expect(within(rate).getByText('dashboard.productsHome.rateOf(7,200)')).toBeInTheDocument();
    expect(within(rate).getByTestId('band-visual-hundred').querySelectorAll('.bg-primary')).toHaveLength(4);

    const waiting = within(band).getByTestId('band-stat-waiting');
    expect(within(waiting).getByText('dashboard.leadsStats.waitingCta')).toBeInTheDocument();
    fireEvent.click(within(waiting).getByTestId('band-open-waiting'));
    expect(navigate).toHaveBeenCalledWith('/leads?status=new');
  });

  it('shows the most wanted products as cards: by inquiries, then views, drafts left out', async () => {
    render(<Dashboard />);
    const cards = await screen.findAllByTestId('top-product');
    expect(cards.map((c) => c.textContent)).toEqual([
      expect.stringContaining('Pink polish'),
      expect.stringContaining('Red polish'),
      expect.stringContaining('Lamp'),
      expect.stringContaining('Top coat'),
    ]);
    expect(within(cards[0]).getByTestId('top-product-asks')).toHaveTextContent('dashboard.productsHome.asks(4)');
    expect(within(cards[0]).getByTestId('top-product-views')).toHaveTextContent('products.views.card(20)');
    expect(within(cards[0]).getByLabelText('dashboard.productsHome.rank(1)')).toBeInTheDocument();
    expect(cards[0].querySelector('img')?.getAttribute('src')).toMatch(/p1\.webp$/);
    expect(screen.queryByText('Hidden draft')).toBeNull();
    fireEvent.click(within(cards[1]).getByRole('button'));
    expect(navigate).toHaveBeenCalledWith('/products');
  });

  it('lists the colours and sizes asked for, each colour with its swatch', async () => {
    render(<Dashboard />);
    const picks = await screen.findByTestId('product-picks');
    const rows = within(picks).getAllByTestId('product-pick');
    expect(rows.map((r) => r.textContent)).toEqual(['ורוד4', 'M2']);
    expect((rows[0].querySelector('[style]') as HTMLElement).style.backgroundColor).toBe('rgb(244, 166, 193)');
  });

  it("shows each latest inquiry's product, with its picture and the colour picked", async () => {
    render(<Dashboard />);
    const summary = await screen.findByTestId('leads-summary');
    expect(within(summary).getByText('dashboard.productsHome.latest')).toBeInTheDocument();
    const products = within(summary).getAllByTestId('leads-summary-product');
    expect(products).toHaveLength(2);
    expect(products[0]).toHaveTextContent('Pink polish · ורוד, M');
    expect(products[0].querySelector('img')?.getAttribute('src')).toMatch(/p1\.webp$/);
    // A product no longer on the site keeps its name, with a plain mark for a picture.
    expect(products[1]).toHaveTextContent('Old one');
    expect(products[1].querySelector('img')).toBeNull();
  });

  it('says so when nothing was counted yet, and keeps the products in the site\'s order', async () => {
    vi.mocked(fetchLeadStats).mockResolvedValue(stats({ products: { total: 0, byProduct: {}, perDay: perDay(() => 0), picks: [] } }));
    vi.mocked(fetchProductViews).mockResolvedValue(views({ total: 0, byProduct: {}, perDay: perDay(() => 0) }));
    render(<Dashboard />);
    const top = await screen.findByTestId('top-products');
    expect(within(top).getByText('dashboard.productsHome.topEmpty')).toBeInTheDocument();
    expect(within(top).queryByLabelText(/rank/)).toBeNull();
    expect(screen.queryByTestId('product-picks')).toBeNull();
    const rate = screen.getByTestId('band-stat-rate');
    expect(within(rate).getByText('dashboard.productsHome.rateNotYet')).toBeInTheDocument();
  });

  it('a leads site without products keeps the leads home', async () => {
    state.webConfig.data = site(false);
    render(<Dashboard />);
    expect(await screen.findByTestId('leads-stats')).toBeInTheDocument();
    expect(screen.queryByTestId('stats-band')).toBeNull();
    expect(listProducts).not.toHaveBeenCalled();
    expect(fetchProductViews).not.toHaveBeenCalled();
  });

  it('greets a new shop with no inquiry and no view yet as any new site', async () => {
    vi.mocked(fetchLeads).mockResolvedValue({ ...page, data: [], pagination: { total: 0, page: 1, limit: 5, pages: 0 }, counts: { new: 0, contacted: 0, closed: 0 } } as never);
    vi.mocked(fetchProductViews).mockResolvedValue(views({ total: 0, byProduct: {} }));
    render(<Dashboard />);
    expect(await screen.findByText('dashboard.emptyTitle')).toBeInTheDocument();
    expect(screen.queryByTestId('stats-band')).toBeNull();
  });
});

describe('The products home\'s numbers', () => {
  it('ranks by inquiries, then views, then the site\'s order', () => {
    const ranked = rankProducts(products, { byProduct: { p4: 1 } }, { byProduct: { p2: 5, p3: 5 } });
    expect(ranked.map((r) => r.product._id)).toEqual(['p4', 'p2', 'p3', 'p1']);
  });

  it('counts the rate only over the days the views were counted', () => {
    const interest = { total: 9, perDay: perDay((i) => (i < 20 ? 0 : 1)) }; // 10 in the last ten days
    expect(askRate({ total: 100, since: day(25) }, interest)).toEqual({ rate: 5, asks: 5, views: 100 });
    expect(askRate({ total: 100, since: null }, interest)).toEqual({ rate: 10, asks: 10, views: 100 });
    expect(askRate({ total: 0, since: null }, interest)).toBeNull();
    // An older API without the days: all of the 30 days' inquiries.
    expect(askRate({ total: 300, since: day(0) }, { total: 9 })).toEqual({ rate: 3, asks: 9, views: 300 });
  });

  it('lights one dot for any inquiry at all, a hundred at most', () => {
    expect(litDots(0)).toBe(0);
    expect(litDots(0.2)).toBe(1);
    expect(litDots(3.5)).toBe(4);
    expect(litDots(250)).toBe(100);
  });
});
