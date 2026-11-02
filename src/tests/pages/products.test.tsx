import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Products from '../../pages/Products';
import { createProduct, createProductsFromGallery, createProductsFromImages, listProducts, minorToPrice, priceToMinor, updateProduct, type Product } from '../../services/productsApi';
import { aiService } from '../../services/aiApi';
import { uploadImage } from '../../services/imagesApi';

// One `t`, as the real hook keeps: the page reloads its list when it changes.
const i18n = vi.hoisted(() => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key) }));
vi.mock('react-i18next', () => ({ useTranslation: () => i18n }));
const site = vi.hoisted(() => ({ current: { subDomain: 'shop', defaultLanguage: 'he' } as Record<string, unknown> }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('browser-image-compression', () => ({ default: (file: File) => Promise.resolve(file) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { webConfig_id: 'w1' } } }) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) => selector({ webConfig: { data: site.current } }),
}));
vi.mock('../../store/slices/webConfigSlice', () => ({ fetchWebConfig: vi.fn() }));
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn() }));
vi.mock('../../services/aiApi', () => ({ aiService: { draftProduct: vi.fn() } }));
vi.mock('../../services/productsApi', async (original) => ({
  ...(await original<typeof import('../../services/productsApi')>()),
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  createProductsFromImages: vi.fn(),
  createProductsFromGallery: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  reorderProducts: vi.fn(),
}));

const product = (over: Partial<Product> = {}): Product => ({
  _id: 'p1', slug: 'ring', name: 'Ring', price: 12050, images: [{ url: 'a.webp' }], details: [], status: 'published', availability: 'in_stock', order: 0, ...over,
});
const plan = (maxProducts: number, productPages = true) => ({ maxProducts, productPages });

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
