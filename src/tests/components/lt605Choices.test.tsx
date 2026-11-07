import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductPagePanel, ProductsPagePanel } from '../../components/siteEditor/ProductDesign';
import { ButtonSample } from '../../components/siteEditor/ThemeSamples';
import { BUTTON_STYLES, OWN_BACKDROP_HEROES, PRODUCTS_PAGE_LAYOUTS, sectionDef, sectionLabel } from '../../utils/editorOptions';

const { t } = vi.hoisted(() => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { language: 'en', dir: () => 'ltr' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../../contexts/LeaveGuardContext', () => ({ useLeaveGuard: () => ({ guardLinkClick: vi.fn() }) }));
// The free plan: the paid designs are held.
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn(async () => ({ limits: { motionDesigns: false } })) }));

/**
 * LT-605 (Erel's four components): the editor offers the live-colours hero,
 * the 3D button, the wall of shelves and the two product pages; the hero and
 * the floating stage are paid designs.
 */
describe("the editor's LT-605 looks", () => {
  it('names the new looks, the wall in the products section as a wall of shelves', () => {
    expect(sectionDef('hero')?.variants).toContain('mesh');
    expect(OWN_BACKDROP_HEROES).toContain('mesh');
    expect(sectionDef('products')?.variants).toContain('wall');
    expect(PRODUCTS_PAGE_LAYOUTS).toContain('wall');
    expect(sectionLabel('products', 'wall', 'he')).toBe('קיר מדפים');
    expect(sectionLabel('features', 'wall', 'en')).toBe('Wall');
    expect(sectionLabel('hero', 'mesh', 'he')).toBe('צבעים חיים');
    expect(BUTTON_STYLES.splash).toEqual({ he: 'תלת ממד', en: '3D splash' });
  });

  it('draws the 3D button raised on its own side', () => {
    render(<ButtonSample style="splash" color="#e0475b" />);
    const sample = document.querySelector('[data-sample="button-splash"]') as HTMLElement;
    expect(sample.style.boxShadow).toContain('0 3px 0 rgba(0,0,0,0.35), 0 3px 0 #e0475b');
  });

  it('crowns the floating stage on the free plan, and a tap on it leaves the page as it is', async () => {
    const onUpdate = vi.fn();
    render(<MemoryRouter><ProductPagePanel config={{ design: { productPageLayout: 'stage' }, products: { items: [] } }} onUpdate={onUpdate} slug={null} onPreview={vi.fn()} /></MemoryRouter>);
    const choices = screen.getByTestId('product-page-choices');
    expect(within(choices).getByRole('radio', { name: 'On a white ledge' })).toBeInTheDocument();
    const stage = within(choices).getByRole('radio', { name: 'Floating stage' });
    // Held: the lit choice is the one the site draws, the plain one.
    await waitFor(() => expect(within(choices).getByRole('radio', { name: 'Pictures beside' })).toHaveAttribute('aria-checked', 'true'));
    expect(within(stage).getByTestId('paid-mark')).toBeInTheDocument();
    fireEvent.click(stage);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByTestId('paid-note')).toBeInTheDocument();
    fireEvent.click(within(choices).getByRole('radio', { name: 'On a white ledge' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('offers the products page its wall, by the products section\'s own name', () => {
    render(<MemoryRouter><ProductsPagePanel config={{ design: { productsPageLayout: 'wall' } }} onUpdate={vi.fn()} /></MemoryRouter>);
    const wall = within(screen.getByTestId('products-page-choices')).getByRole('radio', { name: 'Wall of shelves' });
    expect(wall).toHaveAttribute('aria-checked', 'true');
  });
});
