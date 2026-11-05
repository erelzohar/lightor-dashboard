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
  useTranslation: () => ({ t, i18n: { language: 'en' } }),
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
    fireEvent.click(screen.getByText('products.categoriesPanel.title:{"count":2}'));
    const rows = within(screen.getByTestId('categories-panel')).getAllByRole('listitem');
    fireEvent.click(within(rows[0]).getByText('products.categoriesPanel.rename'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'שרשראות' } });
    expect(screen.getByTestId('category-joins')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'טבעות' } });
    expect(screen.queryByTestId('category-joins')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(renameCategory).toHaveBeenCalledWith('טבעת', 'טבעות'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
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
