import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import { getAt, setAt } from '../../utils/editorPaths';
import { CARD_LAYOUTS, FREE_DEFAULTS, PRODUCTS_PAGE_LAYOUTS, PRODUCT_CARDS, PRODUCT_PAGE_LAYOUTS, blockLookOf, isPaidDesign, optionLabel, sectionLabel } from '../../utils/editorOptions';
import { canOfferPurchases } from '../../lib/platform';
import { PaidNote, usePaidDesignsHeld } from './MotionPlan';
import { vocabLang } from './labels';
import DesignChoices from './DesignChoices';

/**
 * LT-545 (Erel: design the products' card, their page and a product's page):
 * the choices for the products' own pages, shown when the editor's preview is
 * on one of them, and the card, which the home page's section offers too.
 */

export interface PreviewProduct { slug: string; name: string }

/** The products the preview can open: the ones the site shows on its home page. */
export const previewProductsOf = (config: unknown): PreviewProduct[] => {
  const items = (getAt(config, 'products.items') ?? []) as unknown[];
  return items.flatMap((item) => {
    const r = item as Record<string, unknown> | null;
    return r && typeof r.slug === 'string' && typeof r.name === 'string' ? [{ slug: r.slug, name: r.name }] : [];
  });
};

const designOf = (config: unknown): Record<string, unknown> => (getAt(config, 'design') ?? {}) as Record<string, unknown>;

/** How the home page lays its products out: its block's own look, else the design's (as the site draws it). */
const homeLayoutOf = (config: unknown): string | undefined => {
  // Not through getAt: to it 'blocks.<id>' names one block, and 'blocks' alone none.
  const blocks = ((config as { blocks?: unknown } | null)?.blocks ?? []) as Array<{ type?: string; variant?: string }>;
  return blockLookOf('products', blocks.find((b) => b.type === 'products')?.variant, designOf(config));
};

/** The products page's layout as the site draws it: its own, else the home page's when still, else tiles. */
export const productsPageLayoutOf = (config: unknown): string => {
  const own = designOf(config).productsPageLayout as string | undefined;
  if (own && PRODUCTS_PAGE_LAYOUTS.includes(own)) return own;
  const home = homeLayoutOf(config);
  return home && PRODUCTS_PAGE_LAYOUTS.includes(home) ? home : 'well';
};

export const productCardOf = (config: unknown): string => {
  const card = designOf(config).productCard as string | undefined;
  return card && card in PRODUCT_CARDS ? card : 'plain';
};

export const productPageLayoutOf = (config: unknown): string => {
  const layout = designOf(config).productPageLayout as string | undefined;
  return layout && layout in PRODUCT_PAGE_LAYOUTS ? layout : 'side';
};

const label = 'mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300';

interface PanelProps<T> {
  config: T;
  onUpdate: (next: T | ((prev: T) => T), mergeKey?: string) => void;
}

/** The product card: on the products page, the home page's section and the more-products row. */
export function ProductCardPicker<T>({ config, onUpdate }: PanelProps<T>) {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  return (
    <div>
      <p className={label}>{t('siteEditor.products.card')}</p>
      {/* LT-595: a picture of each card, drawn by the site. */}
      <DesignChoices
        name={t('siteEditor.products.card')}
        group="card"
        values={Object.keys(PRODUCT_CARDS)}
        current={productCardOf(config)}
        labelOf={(value) => optionLabel(PRODUCT_CARDS, value, lang)}
        onPick={(value) => onUpdate((prev) => setAt(prev, 'design.productCard', value))}
        language={i18n.language || 'he'}
        testId="product-card-choices"
      />
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.products.cardHint')}</p>
    </div>
  );
}

const ManageProducts: React.FC = () => {
  const { t } = useTranslation();
  const { guardLinkClick } = useLeaveGuard();
  return (
    <Link
      to="/products"
      onClick={(e) => guardLinkClick(e, '/products')}
      data-testid="manage-products"
      className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
    >
      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
      {t('siteEditor.section.manageProducts')}
    </Link>
  );
};

/** The page of all the products: its layout and the card. */
export function ProductsPagePanel<T>({ config, onUpdate }: PanelProps<T>) {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  const layout = productsPageLayoutOf(config);
  return (
    <div className="flex flex-col gap-5" data-testid="products-page-panel">
      <div>
        <p className={label}>{t('siteEditor.products.layout')}</p>
        <DesignChoices
          name={t('siteEditor.products.layout')}
          group="productsPage"
          values={PRODUCTS_PAGE_LAYOUTS}
          current={layout}
          labelOf={(value) => sectionLabel('products', value, lang)}
          onPick={(value) => onUpdate((prev) => setAt(prev, 'design.productsPageLayout', value))}
          language={i18n.language || 'he'}
          testId="products-page-choices"
        />
      </div>
      {CARD_LAYOUTS.includes(layout)
        ? <ProductCardPicker config={config} onUpdate={onUpdate} />
        : <p className="text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.products.noCards')}</p>}
      <ManageProducts />
    </div>
  );
}

/** A product's own page: which product the preview shows, and the page's layout. */
export function ProductPagePanel<T>({ config, onUpdate, slug, onPreview }: PanelProps<T> & { slug: string | null; onPreview: (slug: string) => void }) {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  const pickerId = useId();
  const items = previewProductsOf(config);
  const held = usePaidDesignsHeld();
  const sells = canOfferPurchases();
  const [asked, setAsked] = useState<string | null>(null);
  const pageLayout = productPageLayoutOf(config);
  return (
    <div className="flex flex-col gap-5" data-testid="product-page-panel">
      {items.length > 1 && (
        <div>
          <label htmlFor={pickerId} className={label}>{t('siteEditor.products.preview')}</label>
          <select
            id={pickerId}
            value={slug ?? ''}
            onChange={(e) => onPreview(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-primary"
          >
            {items.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <p className={label}>{t('siteEditor.products.layout')}</p>
        {/* LT-605: the floating stage is a paid design (MotionPlan, as in SectionPanel). */}
        <DesignChoices
          name={t('siteEditor.products.layout')}
          group="productPage"
          values={Object.keys(PRODUCT_PAGE_LAYOUTS).filter((v) => !isPaidDesign('productPage', v) || !held || sells)}
          current={held && isPaidDesign('productPage', pageLayout) ? FREE_DEFAULTS.productPage : pageLayout}
          labelOf={(value) => optionLabel(PRODUCT_PAGE_LAYOUTS, value, lang)}
          marked={(value) => isPaidDesign('productPage', value) && (!held || sells)}
          onPick={(value) => {
            if (held && isPaidDesign('productPage', value)) { setAsked(value); return; }
            setAsked(null);
            onUpdate((prev) => setAt(prev, 'design.productPageLayout', value));
          }}
          language={i18n.language || 'he'}
          testId="product-page-choices"
        />
        {asked && <div className="mt-2"><PaidNote /></div>}
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.products.contentHint')}</p>
      <ManageProducts />
    </div>
  );
}
