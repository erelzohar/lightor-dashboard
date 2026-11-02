import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import { getAt, setAt } from '../../utils/editorPaths';
import { CARD_LAYOUTS, LAYOUTS, PRODUCTS_PAGE_LAYOUTS, PRODUCT_CARDS, PRODUCT_PAGE_LAYOUTS, optionLabel } from '../../utils/editorOptions';
import { vocabLang } from './labels';

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

/** How the home page lays its products out: its block's own look, else the design's. */
const homeLayoutOf = (config: unknown): string | undefined => {
  // Not through getAt: to it 'blocks.<id>' names one block, and 'blocks' alone none.
  const blocks = ((config as { blocks?: unknown } | null)?.blocks ?? []) as Array<{ type?: string; variant?: string }>;
  return blocks.find((b) => b.type === 'products')?.variant ?? (designOf(config).productsLayout as string | undefined);
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
const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
    on
      ? 'bg-primary text-white border-primary'
      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-primary/50'
  }`;

// ── The little pictures of each choice ──
const pic = 'rounded bg-gray-300 dark:bg-slate-500';
const line = 'h-1 rounded-full bg-gray-300 dark:bg-slate-500';

const CardThumb: React.FC<{ card: string }> = ({ card }) => {
  if (card === 'framed') {
    return (
      <div className="flex h-full flex-col gap-1 rounded-md border border-gray-300 bg-white p-1 dark:border-slate-500 dark:bg-slate-800">
        <div className={`${pic} flex-1`} />
        <div className={`${line} w-3/4`} />
      </div>
    );
  }
  if (card === 'overlay') {
    return (
      <div className={`${pic} relative h-full`}>
        <div className="absolute inset-x-1.5 bottom-1.5 h-1 rounded-full bg-white/90" />
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col gap-1">
      <div className={`${pic} flex-1`} />
      <div className={`${line} w-3/4`} />
      {card === 'button' ? <div className="h-1.5 rounded-full bg-primary/70" /> : <div className={`${line} w-1/3`} />}
    </div>
  );
};

const PageThumb: React.FC<{ layout: string }> = ({ layout }) => {
  if (layout === 'hero') {
    return (
      <div className="flex h-full flex-col items-center gap-1">
        <div className={`${pic} h-5 w-full`} />
        <div className={`${line} w-2/3`} />
        <div className={`${line} w-1/2`} />
      </div>
    );
  }
  const words = (
    <div className="flex flex-1 flex-col gap-1 pt-0.5">
      <div className={`${line} w-full`} />
      <div className={`${line} w-2/3`} />
      <div className="h-1.5 w-2/3 rounded-full bg-primary/70" />
    </div>
  );
  if (layout === 'gallery') {
    return (
      <div className="flex h-full gap-1">
        <div className="flex flex-1 flex-col gap-0.5">
          <div className={`${pic} flex-1`} />
          <div className={`${pic} flex-1`} />
        </div>
        {words}
      </div>
    );
  }
  return (
    <div className="flex h-full gap-1">
      <div className={`${pic} flex-1`} />
      {words}
    </div>
  );
};

/** A row of choices with a little picture each. */
const ThumbChoices: React.FC<{
  name: string;
  values: string[];
  current: string;
  labelOf: (value: string) => string;
  thumb: (value: string) => React.ReactNode;
  onPick: (value: string) => void;
  columns: string;
  testId: string;
}> = ({ name, values, current, labelOf, thumb, onPick, columns, testId }) => (
  <div className={`grid gap-2 ${columns}`} role="radiogroup" aria-label={name} data-testid={testId}>
    {values.map((value) => (
      <button
        key={value}
        type="button"
        role="radio"
        aria-checked={current === value}
        onClick={() => onPick(value)}
        className={`flex flex-col gap-1.5 rounded-xl border p-1.5 text-center text-[11px] leading-tight transition-colors ${
          current === value
            ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
            : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-primary/50'
        }`}
      >
        <span className="block h-12 w-full rounded-lg bg-gray-100 p-1.5 dark:bg-slate-700/60" aria-hidden="true">{thumb(value)}</span>
        <span className="break-words">{labelOf(value)}</span>
      </button>
    ))}
  </div>
);

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
      <ThumbChoices
        name={t('siteEditor.products.card')}
        values={Object.keys(PRODUCT_CARDS)}
        current={productCardOf(config)}
        labelOf={(value) => optionLabel(PRODUCT_CARDS, value, lang)}
        thumb={(value) => <CardThumb card={value} />}
        onPick={(value) => onUpdate((prev) => setAt(prev, 'design.productCard', value))}
        columns="grid-cols-4"
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
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('siteEditor.products.layout')}>
          {PRODUCTS_PAGE_LAYOUTS.map((value) => (
            <button key={value} type="button" role="radio" aria-checked={layout === value} className={chip(layout === value)} onClick={() => onUpdate((prev) => setAt(prev, 'design.productsPageLayout', value))}>
              {optionLabel(LAYOUTS, value, lang)}
            </button>
          ))}
        </div>
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
        <ThumbChoices
          name={t('siteEditor.products.layout')}
          values={Object.keys(PRODUCT_PAGE_LAYOUTS)}
          current={productPageLayoutOf(config)}
          labelOf={(value) => optionLabel(PRODUCT_PAGE_LAYOUTS, value, lang)}
          thumb={(value) => <PageThumb layout={value} />}
          onPick={(value) => onUpdate((prev) => setAt(prev, 'design.productPageLayout', value))}
          columns="grid-cols-3"
          testId="product-page-choices"
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.products.contentHint')}</p>
      <ManageProducts />
    </div>
  );
}
