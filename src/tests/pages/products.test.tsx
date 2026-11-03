import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Products from '../../pages/Products';
import { createProduct, createProductsFromGallery, createProductsFromImages, fetchProductViews, listProducts, minorToPrice, priceToMinor, updateProduct, type Product } from '../../services/productsApi';
import { mostViewed } from '../../components/products/MostViewed';
import { aiService } from '../../services/aiApi';
import { uploadImage } from '../../services/imagesApi';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import toast from 'react-hot-toast';

// One `t`, as the real hook keeps: the page reloads its list when it changes.
const i18n = vi.hoisted(() => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key), i18n: { language: 'he' } }));
vi.mock('react-i18next', () => ({ useTranslation: () => i18n }));
const site = vi.hoisted(() => ({ current: { subDomain: 'shop', defaultLanguage: 'he' } as Record<string, unknown> }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('browser-image-compression', () => ({ default: (file: File) => Promise.resolve(file) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { webConfig_id: 'w1' } } }) }));
const store = vi.hoisted(() => ({ dispatch: vi.fn(async (a: unknown) => a) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => store.dispatch }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) => selector({ webConfig: { data: site.current } }),
}));
vi.mock('../../store/slices/webConfigSlice', () => ({
  fetchWebConfig: vi.fn(),
  updateWebConfig: Object.assign(vi.fn((config: unknown) => ({ type: 'webConfig/update', config })), { rejected: { match: () => false } }),
}));
const platform = vi.hoisted(() => ({ canOfferPurchases: vi.fn(() => true), isNativeApp: () => false }));
vi.mock('../../lib/platform', () => platform);
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn() }));
vi.mock('../../services/aiApi', () => ({ aiService: { draftProduct: vi.fn(), draftProductFromText: vi.fn(), createImage: vi.fn() } }));
vi.mock('../../services/productsApi', async (original) => ({
  ...(await original<typeof import('../../services/productsApi')>()),
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  createProductsFromImages: vi.fn(),
  createProductsFromGallery: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  reorderProducts: vi.fn(),
  // LT-569: none read unless a test gives some.
  fetchProductViews: vi.fn(async () => { throw new Error('no views'); }),
}));

const product = (over: Partial<Product> = {}): Product => ({
  _id: 'p1', slug: 'ring', name: 'Ring', price: 12050, images: [{ url: 'a.webp' }], details: [], status: 'published', availability: 'in_stock', order: 0, ...over,
});
const plan = (maxProducts: number, productPages = true, freeDaysUntil?: string) => ({ maxProducts, productPages, ...(freeDaysUntil ? { freeDaysUntil } : {}) });

describe('prices', () => {
  it('reads what the owner types into minor units, and back', () => {
    expect(priceToMinor('120')).toBe(12000);
    expect(priceToMinor('120.50')).toBe(12050);
    expect(priceToMinor('120,5')).toBe(12050);
    expect(priceToMinor('')).toBeNull();
    expect(priceToMinor('abc')).toBeUndefined();
    expect(priceToMinor('19.99')).toBe(1999);
    expect(minorToPrice(12050)).toBe('120.5');
    expect(minorToPrice(undefined)).toBe('');
  });
});

describe('the Products page (LT-540)', () => {
  beforeEach(() => {
    vi.mocked(listProducts).mockResolvedValue({ products: [product()], limits: plan(10) });
  });

  it('shows the products and how many the plan holds', async () => {
    render(<Products />);
    expect(await screen.findByText('Ring')).toBeTruthy();
    expect(screen.getByTestId('products-count').textContent).toContain('"used":1');
    expect(screen.getByTestId('products-count').textContent).toContain('"max":10');
  });

  it('says so on a plan whose product has no page of its own, and stops at the cap', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: [product()], limits: plan(1, false) });
    render(<Products />);
    expect(await screen.findByTestId('products-full')).toBeTruthy();
    expect(screen.getByTestId('products-count').textContent).toContain('products.onePageNote');
    expect((screen.getByText('products.add').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers a way in when there is nothing yet', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: [], limits: plan(10) });
    render(<Products />);
    expect(await screen.findByTestId('products-empty')).toBeTruthy();
  });

  it('adds a product, turning the price into minor units', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: [], limits: plan(10) });
    vi.mocked(createProduct).mockResolvedValue(product({ _id: 'p2', name: 'Chain' }));
    render(<Products />);
    await screen.findByTestId('products-empty');
    fireEvent.click(screen.getByText('products.add'));
    const dialog = await screen.findByTestId('product-editor');
    fireEvent.change(within(dialog).getByLabelText('products.name'), { target: { value: 'Chain' } });
    fireEvent.change(within(dialog).getByLabelText('products.price'), { target: { value: '99.90' } });
    fireEvent.click(within(dialog).getByText('products.save'));
    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    expect(vi.mocked(createProduct).mock.calls[0][0]).toMatchObject({ name: 'Chain', price: 9990, status: 'published', availability: 'in_stock' });
    expect(await screen.findByText('Chain')).toBeTruthy();
  });

  it('refuses a price that is not a number, without sending anything', async () => {
    vi.mocked(createProduct).mockClear();
    render(<Products />);
    await screen.findByText('Ring');
    fireEvent.click(screen.getByText('products.add'));
    const dialog = await screen.findByTestId('product-editor');
    fireEvent.change(within(dialog).getByLabelText('products.name'), { target: { value: 'Chain' } });
    fireEvent.change(within(dialog).getByLabelText('products.price'), { target: { value: 'free' } });
    fireEvent.click(within(dialog).getByText('products.save'));
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('opens a product to edit, and clears the "sample" mark on save', async () => {
    vi.mocked(updateProduct).mockResolvedValue(product({ name: 'Golden ring' }));
    render(<Products />);
    fireEvent.click(await screen.findByTestId('product-card'));
    const dialog = await screen.findByTestId('product-editor');
    expect((within(dialog).getByLabelText('products.price') as HTMLInputElement).value).toBe('120.5');
    fireEvent.change(within(dialog).getByLabelText('products.name'), { target: { value: 'Golden ring' } });
    fireEvent.click(within(dialog).getByText('products.save'));
    await waitFor(() => expect(updateProduct).toHaveBeenCalled());
    expect(vi.mocked(updateProduct).mock.calls[0][1]).toMatchObject({ name: 'Golden ring', sample: false, price: 12050 });
  });

  it('lets Lighty fill in what is empty, and never what the owner wrote', async () => {
    vi.mocked(aiService.draftProduct).mockResolvedValue({ name: 'AI name', summary: 'AI line', description: 'AI words', category: 'AI kind' });
    render(<Products />);
    fireEvent.click(await screen.findByTestId('product-card'));
    const dialog = await screen.findByTestId('product-editor');
    const fill = within(dialog).getByTestId('fill-from-picture');
    // LT-542 (Erel): it looks like a button - the pop look, not a line of text.
    expect(fill.className).toContain('shadow-[inset_0_0_0_2px_var(--pop-edge)');
    fireEvent.click(fill);
    await waitFor(() => expect((within(dialog).getByLabelText('products.summary') as HTMLInputElement).value).toBe('AI line'));
    expect((within(dialog).getByLabelText('products.name') as HTMLInputElement).value).toBe('Ring');
    expect(aiService.draftProduct).toHaveBeenCalledWith('a.webp', 'he');
  });

  it('makes a draft from each picture, within what the plan has left', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: [product()], limits: plan(3) });
    vi.mocked(uploadImage).mockResolvedValue({ imageName: 'up.webp' });
    vi.mocked(createProductsFromImages).mockResolvedValue([product({ _id: 'p5', name: 'New one', status: 'draft' })]);
    render(<Products />);
    await screen.findByText('Ring');
    const input = screen.getByLabelText('products.addMany', { selector: 'input' });
    const files = ['a', 'b', 'c'].map((n) => new File(['x'], `${n}.png`, { type: 'image/png' }));
    fireEvent.change(input, { target: { files } });
    await waitFor(() => expect(createProductsFromImages).toHaveBeenCalled());
    expect(vi.mocked(createProductsFromImages).mock.calls[0][0]).toHaveLength(2);
    expect(await screen.findByText('products.badge.draft')).toBeTruthy();
  });

  it('offers to turn a gallery into products, once, and confirms first', async () => {
    site.current = { subDomain: 'shop', defaultLanguage: 'he', components: { portfolio: { items: [{ url: 'a.webp' }, { url: 'b.webp' }] } } };
    vi.mocked(listProducts).mockResolvedValue({ products: [], limits: plan(10) });
    vi.mocked(createProductsFromGallery).mockResolvedValue([product({ _id: 'g1', name: 'From the gallery' })]);
    render(<Products />);
    const offer = await screen.findByTestId('from-gallery');
    fireEvent.click(within(offer).getByText('products.fromGallery.action'));
    expect(createProductsFromGallery).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByText('products.fromGallery.confirm'));
    await waitFor(() => expect(createProductsFromGallery).toHaveBeenCalled());
    expect(await screen.findByText('From the gallery')).toBeTruthy();
    site.current = { subDomain: 'shop', defaultLanguage: 'he', catalog: true, components: { portfolio: { items: [{ url: 'a.webp' }] } } };
  });

  it('says nothing of the gallery on a site that already has products', async () => {
    render(<Products />);
    await screen.findByText('Ring');
    expect(screen.queryByTestId('from-gallery')).toBeNull();
  });
});

// LT-546 (Erel 2026-11-02): "write that only the first product shows after the free period".
// LT-568 (Erel): a few words become a product - its texts, and a picture made like the editor's "create with AI".
describe('a product from a few words (LT-568)', () => {
  beforeEach(() => {
    vi.mocked(aiService.createImage).mockReset();
    vi.mocked(listProducts).mockResolvedValue({ products: [], limits: plan(10) });
    vi.mocked(aiService.draftProductFromText).mockResolvedValue({
      name: 'Vanilla candle', summary: 'A candle in a jar', description: 'Full words', category: 'Candles', picture: 'A candle in a glass jar, plain background',
    });
  });

  const openNew = async () => {
    render(<Products />);
    await screen.findByTestId('products-empty');
    fireEvent.click(screen.getByText('products.add'));
    return screen.findByTestId('product-editor');
  };

  it('writes the new product and adds the picture Lighty made, saved with it', async () => {
    vi.mocked(aiService.createImage).mockResolvedValue('https://api.lightor.app/api/images/temp/t1.webp');
    vi.mocked(createProduct).mockResolvedValue(product({ _id: 'p9', name: 'Vanilla candle' }));
    const dialog = await openNew();
    fireEvent.change(within(dialog).getByLabelText('products.fromWords.label'), { target: { value: 'a vanilla candle in a jar' } });
    fireEvent.click(within(dialog).getByTestId('create-from-words'));
    // No saving before the picture is in: it would be saved without it.
    expect((within(dialog).getByText('products.save').closest('button') as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect((within(dialog).getByLabelText('products.name') as HTMLInputElement).value).toBe('Vanilla candle'));
    expect(aiService.draftProductFromText).toHaveBeenCalledWith('a vanilla candle in a jar', 'he');
    await waitFor(() => expect(aiService.createImage).toHaveBeenCalledWith('A candle in a glass jar, plain background', '4:3', 'product'));
    // The thumbnails carry an empty alt (the form names them), so they are found as elements.
    await waitFor(() => expect([...dialog.querySelectorAll('img')].some((img) => img.getAttribute('src')?.endsWith('/temp/t1.webp'))).toBe(true));
    await waitFor(() => expect((within(dialog).getByText('products.save').closest('button') as HTMLButtonElement).disabled).toBe(false));
    expect((within(dialog).getByLabelText('products.fieldDescription') as HTMLTextAreaElement).value).toBe('Full words');
    fireEvent.click(within(dialog).getByText('products.save'));
    await waitFor(() => expect(createProduct).toHaveBeenCalled());
    expect(vi.mocked(createProduct).mock.calls[0][0]).toMatchObject({
      name: 'Vanilla candle', category: 'Candles', images: [{ url: 'https://api.lightor.app/api/images/temp/t1.webp' }],
    });
  });

  // Erel: the free plan makes the picture too, out of its 5 a month; past the month, the texts stay.
  it("asks for a product's picture, and keeps the texts when the month's pictures are used up", async () => {
    vi.mocked(aiService.createImage).mockRejectedValue({ response: { status: 429, data: {} } });
    const dialog = await openNew();
    fireEvent.change(within(dialog).getByLabelText('products.fromWords.label'), { target: { value: 'a vanilla candle' } });
    fireEvent.click(within(dialog).getByTestId('create-from-words'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('products.fromWords.pictureLimit'));
    expect(aiService.createImage).toHaveBeenCalledWith('A candle in a glass jar, plain background', '4:3', 'product');
    expect((within(dialog).getByLabelText('products.name') as HTMLInputElement).value).toBe('Vanilla candle');
    expect(dialog.querySelectorAll('img')).toHaveLength(0);
  });

  it('spends no AI picture on a product that already has one', async () => {
    vi.mocked(uploadImage).mockResolvedValue({ imageName: 'own.webp' });
    const dialog = await openNew();
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'own.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(dialog.querySelectorAll('img')).toHaveLength(1));
    fireEvent.change(within(dialog).getByLabelText('products.fromWords.label'), { target: { value: 'a vanilla candle' } });
    fireEvent.click(within(dialog).getByTestId('create-from-words'));
    await waitFor(() => expect((within(dialog).getByLabelText('products.name') as HTMLInputElement).value).toBe('Vanilla candle'));
    expect(aiService.createImage).not.toHaveBeenCalled();
  });

  it('is only in a new product\'s form', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: [product()], limits: plan(10) });
    render(<Products />);
    fireEvent.click(await screen.findByTestId('product-card'));
    const dialog = await screen.findByTestId('product-editor');
    expect(within(dialog).queryByTestId('product-from-words')).toBeNull();
  });
});

describe('the switch that shows them on the site (LT-558)', () => {
  beforeEach(() => {
    vi.mocked(listProducts).mockResolvedValue({ products: [product()], limits: plan(10) });
    vi.mocked(updateWebConfig).mockClear();
  });
  afterEach(() => { site.current = { subDomain: 'shop', defaultLanguage: 'he' }; });
  const withSite = (products?: Record<string, unknown>) => {
    site.current = { _id: 'w1', subDomain: 'shop', defaultLanguage: 'he', catalog: true, components: { hero: { visible: true }, ...(products ? { products } : {}) } };
  };

  it('is on for a site that never touched it, and turns the products off with the rest of the site kept', async () => {
    withSite({ title: 'Our rings' });
    render(<Products />);
    const toggle = (await screen.findByRole('switch')) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    expect(screen.getByTestId('products-on-site').textContent).toContain('products.visibility.shown');
    fireEvent.click(toggle);
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledWith({
      _id: 'w1',
      components: { hero: { visible: true }, products: { title: 'Our rings', visible: false } },
    }));
  });

  it('says the products are hidden and still kept, and turns them back on', async () => {
    withSite({ visible: false });
    render(<Products />);
    const toggle = (await screen.findByRole('switch')) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(screen.getByTestId('products-on-site').textContent).toContain('products.visibility.hiddenBody');
    fireEvent.click(toggle);
    await waitFor(() => expect(vi.mocked(updateWebConfig).mock.calls[0][0]).toMatchObject({ components: { products: { visible: true } } }));
  });

  it('is not there before the site has products', async () => {
    site.current = { _id: 'w1', subDomain: 'shop', defaultLanguage: 'he', components: {} };
    render(<Products />);
    await screen.findByText('Ring');
    expect(screen.queryByTestId('products-on-site')).toBeNull();
  });
});

describe('products past the plan (LT-546)', () => {
  const ten = Array.from({ length: 10 }, (_, i) => product({ _id: `p${i}`, slug: `p-${i}`, name: `Product ${i}`, order: i }));
  const page = () => render(<MemoryRouter><Products /></MemoryRouter>);

  beforeEach(() => {
    platform.canOfferPurchases.mockReturnValue(true);
  });

  it('on the free plan marks the first product shown and the rest hidden, and adds none', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: ten, limits: plan(1, false) });
    page();
    const notice = await screen.findByTestId('products-over-plan');
    expect(notice.textContent).toContain('products.overFree');
    expect(within(notice).getByText('products.upgradeBack').getAttribute('href')).toBe('/account');
    expect(screen.queryByTestId('products-full')).toBeNull();
    expect(screen.getAllByTestId('badge-shown')).toHaveLength(1);
    expect(screen.getAllByTestId('badge-hidden')).toHaveLength(9);
    const cards = screen.getAllByTestId('product-card');
    expect(within(cards[0]).getByTestId('badge-shown')).toBeTruthy();
    expect(within(cards[1]).getByTestId('badge-hidden')).toBeTruthy();
    // "10 of 1 products" read wrong: the count alone.
    expect(screen.getByTestId('products-count').textContent).toContain('products.countOnly:{"used":10}');
    expect((screen.getByText('products.add').closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('products.addMany').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('counts only what is published: a draft is never on the site', async () => {
    vi.mocked(listProducts).mockResolvedValue({
      products: [product({ _id: 'd', name: 'Draft', status: 'draft' }), product({ _id: 'a', name: 'A' }), product({ _id: 'b', name: 'B' })],
      limits: plan(1, false),
    });
    page();
    await screen.findByTestId('products-over-plan');
    const [draft, a, b] = screen.getAllByTestId('product-card');
    expect(within(draft).queryByTestId('badge-shown')).toBeNull();
    expect(within(draft).queryByTestId('badge-hidden')).toBeNull();
    expect(within(a).getByTestId('badge-shown')).toBeTruthy();
    expect(within(b).getByTestId('badge-hidden')).toBeTruthy();
  });

  it('says so in a hidden product\'s form', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: ten.slice(0, 3), limits: plan(1, false) });
    page();
    await screen.findByTestId('products-over-plan');
    fireEvent.click(screen.getAllByTestId('product-card')[2]);
    expect(within(await screen.findByTestId('product-editor')).getByTestId('product-hidden-note').textContent).toBe('products.hiddenNote');
  });

  it('shows the shown product no note', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: ten.slice(0, 3), limits: plan(1, false) });
    page();
    await screen.findByTestId('products-over-plan');
    fireEvent.click(screen.getAllByTestId('product-card')[0]);
    expect(within(await screen.findByTestId('product-editor')).queryByTestId('product-hidden-note')).toBeNull();
  });

  it('in the app states the fact and offers no upgrade', async () => {
    platform.canOfferPurchases.mockReturnValue(false);
    vi.mocked(listProducts).mockResolvedValue({ products: ten, limits: plan(1, false) });
    page();
    const notice = await screen.findByTestId('products-over-plan');
    expect(notice.textContent).toContain('products.overFree');
    expect(within(notice).queryByText('products.upgradeBack')).toBeNull();
  });

  it('on a paid plan past its number names the number', async () => {
    const thirty = Array.from({ length: 30 }, (_, i) => product({ _id: `q${i}`, name: `Q${i}`, order: i }));
    vi.mocked(listProducts).mockResolvedValue({ products: thirty, limits: plan(20) });
    page();
    expect((await screen.findByTestId('products-over-plan')).textContent).toContain('products.overPlan:{"max":20}');
    expect(screen.getAllByTestId('badge-shown')).toHaveLength(20);
    expect(screen.getAllByTestId('badge-hidden')).toHaveLength(10);
  });

  it('within the plan marks nothing', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: ten, limits: plan(20) });
    page();
    await screen.findByText('Product 0');
    expect(screen.queryByTestId('products-over-plan')).toBeNull();
    expect(screen.queryByTestId('badge-shown')).toBeNull();
    expect(screen.queryByTestId('badge-hidden')).toBeNull();
    expect(screen.getByTestId('products-count').textContent).toContain('products.count:{"used":10,"max":20}');
  });

  it('under the free days says when they end and what the free plan shows', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: ten.slice(0, 2), limits: { ...plan(15, true, '2027-01-02T10:00:00.000Z'), freeMaxProducts: 5 } });
    page();
    const note = await screen.findByTestId('products-after-trial');
    expect(note.textContent).toContain('products.afterFreeDays');
    expect(note.textContent).toContain(new Date('2027-01-02T10:00:00.000Z').toLocaleDateString('he-IL'));
    // LT-553: how many the free plan then shows, from the server.
    expect(note.textContent).toContain('"max":5');
    expect(screen.queryByTestId('products-over-plan')).toBeNull();
  });

  it('says nothing of the free days to a paying account', async () => {
    vi.mocked(listProducts).mockResolvedValue({ products: ten.slice(0, 2), limits: plan(20) });
    page();
    await screen.findByText('Product 0');
    expect(screen.queryByTestId('products-after-trial')).toBeNull();
  });
});

describe('the most viewed products (LT-569)', () => {
  const three = [
    product({ _id: 'a', slug: 'a', name: 'Ring', order: 0 }),
    product({ _id: 'b', slug: 'b', name: 'Necklace', order: 1 }),
    product({ _id: 'c', slug: 'c', name: 'Bracelet', order: 2 }),
  ];
  const perDay = Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String(i + 2).padStart(2, '0')}`, count: 0 }));
  const views = (byProduct: Record<string, number>, since: string | null = '2026-10-02') =>
    ({ total: Object.values(byProduct).reduce((a, b) => a + b, 0), byProduct, perDay, since });

  beforeEach(() => {
    site.current = { _id: 'w1', subDomain: 'shop', defaultLanguage: 'he', catalog: true, components: {} };
    vi.mocked(listProducts).mockResolvedValue({ products: three, limits: plan(10) });
  });
  afterEach(() => {
    site.current = { subDomain: 'shop', defaultLanguage: 'he' };
    vi.mocked(fetchProductViews).mockRejectedValue(new Error('no views'));
  });

  it('ranks the opened products, most first, and leaves out those never opened', () => {
    expect(mostViewed(three, views({ b: 9, a: 3 })).map((r) => [r.product.name, r.views])).toEqual([['Necklace', 9], ['Ring', 3]]);
  });

  it('draws them as bars with the total, and each card says its views', async () => {
    vi.mocked(fetchProductViews).mockResolvedValue(views({ b: 9, a: 3 }));
    render(<Products />);
    const card = await screen.findByTestId('most-viewed');
    const rows = within(card).getAllByTestId('most-viewed-row');
    expect(rows.map((r) => r.textContent)).toEqual(['Necklace9', 'Ring3']);
    expect(screen.getByTestId('most-viewed-total').textContent).toBe('products.views.total:{"count":12}');
    expect(screen.getAllByTestId('product-views').map((p) => p.textContent)).toEqual([
      'products.views.card:{"count":3}', 'products.views.card:{"count":9}', 'products.views.card:{"count":0}',
    ]);
  });

  it('says from when while the counting is younger than the 30 days, and when none was opened yet', async () => {
    vi.mocked(fetchProductViews).mockResolvedValue(views({}, '2026-10-20'));
    render(<Products />);
    expect(await screen.findByTestId('most-viewed-empty')).toBeTruthy();
    expect(screen.getByTestId('most-viewed-total').textContent).toContain('products.views.since:{"date":"20.10"}');
  });

  it('is not there before the site shows products, nor when the views cannot be read', async () => {
    vi.mocked(fetchProductViews).mockResolvedValue(views({ a: 1 }));
    site.current = { _id: 'w1', subDomain: 'shop', defaultLanguage: 'he', components: {} };
    const { unmount } = render(<Products />);
    await screen.findByText('Ring');
    expect(screen.queryByTestId('most-viewed')).toBeNull();
    expect(screen.queryByTestId('product-views')).toBeNull();
    unmount();
    site.current = { _id: 'w1', subDomain: 'shop', defaultLanguage: 'he', catalog: true, components: {} };
    vi.mocked(fetchProductViews).mockRejectedValue(new Error('down'));
    render(<Products />);
    await screen.findByText('Ring');
    expect(screen.queryByTestId('most-viewed')).toBeNull();
  });
});
