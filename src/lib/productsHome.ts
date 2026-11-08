import type { Product, ProductViews } from '../services/productsApi';
import type { ProductInterest } from '../services/leadsApi';

/**
 * LT-624 (Erel 2026-11-09: "the products dashboard and the leads dashboard look exactly the
 * same"): the numbers a products site's home is made of, apart from how it draws them.
 */

export interface RankedProduct {
  product: Product;
  /** Inquiries about it in the last 30 days. */
  asks: number;
  /** Times its page was opened in the last 30 days. */
  views: number;
}

/**
 * The products visitors want most: by inquiries, then by views, then in the site's own order.
 * Only those on the site (a draft is nowhere to be asked about), unless every one is a draft.
 */
export const rankProducts = (
  products: Product[],
  interest: Pick<ProductInterest, 'byProduct'> | null | undefined,
  views: Pick<ProductViews, 'byProduct'> | null | undefined,
  top = 4,
): RankedProduct[] => {
  const shown = products.filter((p) => p.status === 'published');
  return (shown.length ? shown : products)
    .map((product, order) => ({
      product,
      asks: interest?.byProduct[product._id] ?? 0,
      views: views?.byProduct[product._id] ?? 0,
      order,
    }))
    .sort((a, b) => b.asks - a.asks || b.views - a.views || a.order - b.order)
    .slice(0, top)
    .map(({ product, asks, views: seen }) => ({ product, asks, views: seen }));
};

/**
 * Inquiries about products in every 100 product views, over the days the views were counted
 * (they began with LT-569, after the 30 days' first inquiries), so the first weeks are not
 * inflated. Null without a view.
 */
export const askRate = (
  views: Pick<ProductViews, 'total' | 'since'> | null | undefined,
  interest: Pick<ProductInterest, 'total' | 'perDay'> | null | undefined,
): { rate: number; asks: number; views: number } | null => {
  if (!views || views.total <= 0) return null;
  const since = views.since;
  const asks = interest?.perDay
    ? interest.perDay.filter((d) => !since || d.date >= since).reduce((sum, d) => sum + d.count, 0)
    : interest?.total ?? 0;
  return { rate: Math.round((asks / views.total) * 1000) / 10, asks, views: views.total };
};

/** How many of the hundred dots light up: at least one for any inquiry at all. */
export const litDots = (rate: number): number => (rate <= 0 ? 0 : Math.min(100, Math.max(1, Math.round(rate))));
