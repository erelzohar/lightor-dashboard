import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoriesPanel, { categoryCounts } from '../../components/products/CategoriesPanel';
import ProductOptionsField from '../../components/products/ProductOptionsField';
import { ProductCardPicker, ProductPagePanel, ProductsPagePanel } from '../../components/siteEditor/ProductDesign';
import { CARD_LAYOUTS, FREE_DEFAULTS, PAID_LAYOUTS, PRODUCTS_PAGE_LAYOUTS, isPaidDesign, sectionDef } from '../../utils/editorOptions';
import type { Product } from '../../services/productsApi';

const { t } = vi.hoisted(() => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { language: 'en', dir: () => 'ltr' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
const renameCategory = vi.fn(async (_from: string, _to: string) => 2);
vi.mock('../../services/productsApi', () => ({ renameCategory: (from: string, to: string) => renameCategory(from, to) }));
vi.mock('../../contexts/LeaveGuardContext', () => ({ useLeaveGuard: () => ({ guardLinkClick: vi.fn() }) }));

const product = (i: number, category?: string): Product => ({
  _id: `p${i}`, slug: `p-${i}`, name: `Product ${i}`, images: [], details: [], status: 'published', availability: 'in_stock', order: i, ...(category ? { category } : {}),
});

describe('the categories panel (LT-587)', () => {
  beforeEach(() => renameCategory.mockClear());
  const products = [product(0, 'טבעת'), product(1, 'שרשראות'), product(2, 'טבעת'), product(3)];

  it('counts each category in the order the products have them', () => {
    expect(categoryCounts(products)).toEqual([{ name: 'טבעת', count: 2 }, { name: 'שרשראות', count: 1 }]);
  });

  it('renames a category for all its products, and says when the new name joins another', async () => {
    const onChanged = vi.fn();
    render(<CategoriesPanel products={products} onChanged={onChanged} />);
    // LT-592: every category is a pill with its number of products beside the name.
    const pills = screen.getAllByTestId('category-pill');
    expect(pills).toHaveLength(2);
    expect(within(pills[0]).getByRole('textbox')).toHaveValue('טבעת');
    expect(within(pills[0]).getByRole('textbox')).toHaveAttribute('readonly');
    expect(pills[0].textContent).toContain('(2)');
    expect(pills[1].textContent).toContain('(1)');
    fireEvent.click(screen.getByRole('button', { name: 'products.categoriesPanel.renameOne:{"name":"טבעת"}' }));
    const input = within(pills[0]).getByRole('textbox');
    await waitFor(() => expect(input).not.toHaveAttribute('readonly'));
    fireEvent.change(input, { target: { value: 'שרשראות' } });
    expect(screen.getByTestId('category-joins')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByTestId('category-clears')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'טבעות' } });
    expect(screen.queryByTestId('category-joins')).toBeNull();
    expect(screen.queryByTestId('category-clears')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(renameCategory).toHaveBeenCalledWith('טבעת', 'טבעות'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    await waitFor(() => expect(input).toHaveAttribute('readonly'));
  });

  it('one pill open at a time; the check saves, Escape puts the name back, an unchanged name saves nothing', async () => {
    render(<CategoriesPanel products={products} onChanged={vi.fn()} />);
    const [first, second] = screen.getAllByTestId('category-pill');
    fireEvent.click(screen.getByRole('button', { name: 'products.categoriesPanel.renameOne:{"name":"טבעת"}' }));
    await waitFor(() => expect(first).toHaveAttribute('data-editing', 'true'));
    fireEvent.click(screen.getByRole('button', { name: 'products.categoriesPanel.renameOne:{"name":"שרשראות"}' }));
    await waitFor(() => expect(second).toHaveAttribute('data-editing', 'true'));
    expect(first).not.toHaveAttribute('data-editing');
    const input = within(second).getByRole('textbox');
    fireEvent.change(input, { target: { value: 'עגילים' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('שרשראות');
    expect(second).not.toHaveAttribute('data-editing');
    fireEvent.click(within(second).getByRole('button', { name: 'products.categoriesPanel.renameOne:{"name":"שרשראות"}' }));
    await waitFor(() => expect(second).toHaveAttribute('data-editing', 'true'));
    fireEvent.click(within(second).getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(second).not.toHaveAttribute('data-editing'));
    expect(renameCategory).not.toHaveBeenCalled();
    fireEvent.click(within(second).getByRole('button', { name: 'products.categoriesPanel.renameOne:{"name":"שרשראות"}' }));
    fireEvent.change(within(second).getByRole('textbox'), { target: { value: ' עגילים ' } });
    fireEvent.click(within(second).getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(renameCategory).toHaveBeenCalledWith('שרשראות', 'עגילים'));
  });

  it('a failed save keeps the pill open with the words typed', async () => {
    renameCategory.mockRejectedValueOnce(new Error('down'));
    render(<CategoriesPanel products={products} onChanged={vi.fn()} />);
    const [first] = screen.getAllByTestId('category-pill');
    fireEvent.click(screen.getByRole('button', { name: 'products.categoriesPanel.renameOne:{"name":"טבעת"}' }));
    const input = within(first).getByRole('textbox');
    fireEvent.change(input, { target: { value: 'טבעות' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(renameCategory).toHaveBeenCalled());
    await waitFor(() => expect(first).toHaveAttribute('data-editing', 'true'));
    expect(input).toHaveValue('טבעות');
  });

  it('draws nothing for products without categories', () => {
    const { container } = render(<CategoriesPanel products={[product(0)]} onChanged={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('colours and sizes on the product form (LT-588)', () => {
  it('adds a colour by its name and swatch, a size with Enter, and takes either off', () => {
    const onColors = vi.fn();
    const onSizes = vi.fn();
    const { rerender } = render(<ProductOptionsField colors={[]} sizes={[]} onColors={onColors} onSizes={onSizes} labelClass="" fieldClass="" />);
    fireEvent.change(screen.getByLabelText('products.colorSwatch'), { target: { value: '#cc2233' } });
    fireEvent.change(screen.getByLabelText('products.colorName'), { target: { value: 'אדום' } });
    fireEvent.click(screen.getByLabelText('products.addColor'));
    expect(onColors).toHaveBeenCalledWith([{ name: 'אדום', hex: '#cc2233' }]);
    fireEvent.change(screen.getByLabelText('products.sizes'), { target: { value: 'M' } });
    fireEvent.keyDown(screen.getByLabelText('products.sizes'), { key: 'Enter' });
    expect(onSizes).toHaveBeenCalledWith(['M']);
    rerender(<ProductOptionsField colors={[{ name: 'אדום', hex: '#cc2233' }]} sizes={['M', 'L']} onColors={onColors} onSizes={onSizes} labelClass="" fieldClass="" />);
    fireEvent.click(screen.getByLabelText('products.removeOption:{"name":"M"}'));
    expect(onSizes).toHaveBeenLastCalledWith(['L']);
  });
});

describe("the editor's new product looks (LT-588)", () => {
  it('offers the two new cards and the shop-like product page', () => {
    const config = { design: {} };
    render(<MemoryRouter><ProductCardPicker config={config} onUpdate={vi.fn()} /></MemoryRouter>);
    const cards = within(screen.getByTestId('product-card-choices')).getAllByRole('radio').map((r) => r.textContent);
    expect(cards).toEqual(expect.arrayContaining(['Details revealed', 'Colours and sizes']));
  });

  it('offers the product page its shop layout', () => {
    render(<MemoryRouter><ProductPagePanel config={{ design: {}, products: { items: [] } }} onUpdate={vi.fn()} slug={null} onPreview={vi.fn()} /></MemoryRouter>);
    expect(within(screen.getByTestId('product-page-choices')).getByRole('radio', { name: 'Shop page' })).toBeInTheDocument();
  });

  it('offers the products page by category, the shop taking the card and the rows not', () => {
    expect(PRODUCTS_PAGE_LAYOUTS).toEqual(expect.arrayContaining(['rows', 'shelves', 'shop']));
    expect(CARD_LAYOUTS).toContain('shop');
    expect(CARD_LAYOUTS).not.toContain('rows');
    const onUpdate = vi.fn();
    render(<MemoryRouter><ProductsPagePanel config={{ design: { productsPageLayout: 'rows' } }} onUpdate={onUpdate} /></MemoryRouter>);
    expect(screen.getByText('siteEditor.products.noCards')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'A row per category' }).getAttribute('aria-checked')).toBe('true');
  });

  it('the home drops card and the highlights with pictures, the latter a paid design', () => {
    expect(sectionDef('products')?.variants).toContain('drops');
    expect(sectionDef('features')?.variants).toContain('stack');
    expect(PAID_LAYOUTS.features).toEqual(['stack']);
    expect(isPaidDesign('features', 'stack')).toBe(true);
    expect(FREE_DEFAULTS.features).toBe('tiles');
  });
});
