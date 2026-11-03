import React from 'react';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Product, ProductViews } from '../../services/productsApi';

const TOP = 5;

/** "15.11" from "2026-11-15". */
const dayLabel = (day: string): string => {
  const [, m, d] = day.split('-');
  return `${Number(d)}.${Number(m)}`;
};

/** The products by views, most first; those never opened are left out. */
export const mostViewed = (products: Product[], views: ProductViews, top = TOP): { product: Product; views: number }[] =>
  products
    .map((product) => ({ product, views: views.byProduct[product._id] ?? 0 }))
    .filter((p) => p.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, top);

/**
 * LT-569: the products visitors opened most over the last 30 days, as bars
 * (Erel: "most viewed" with a chart). Plain bars like the leads chart: no
 * library, sized with the card. The counting started with LT-569, so the
 * card says from when while it is younger than the 30 days.
 */
const MostViewed: React.FC<{ products: Product[]; views: ProductViews }> = ({ products, views }) => {
  const { t } = useTranslation();
  const rows = mostViewed(products, views);
  const max = Math.max(1, ...rows.map((r) => r.views));
  const since = views.since && views.perDay.length && views.since > views.perDay[0].date ? views.since : null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4 sm:p-5"
      data-tour="most-viewed"
      data-testid="most-viewed"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-semibold text-gray-900 dark:text-white">{t('products.views.title')}</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 tabular-nums" data-testid="most-viewed-total">
          {t('products.views.total', { count: views.total })}
          {since ? ` · ${t('products.views.since', { date: dayLabel(since) })}` : ''}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400" data-testid="most-viewed-empty">{t('products.views.empty')}</p>
      ) : (
        <ol className="space-y-3" aria-label={t('products.views.title')}>
          {rows.map(({ product, views: n }) => (
            <li
              key={product._id}
              className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,14rem)_1fr_auto]"
              data-testid="most-viewed-row"
            >
              <span className="text-sm text-gray-800 dark:text-slate-200 break-words">{product.name}</span>
              <span className="h-3 rounded-full bg-gray-100 dark:bg-slate-700/60" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (n / max) * 100)}%` }} />
              </span>
              <span className="inline-flex min-w-[3.25rem] items-center justify-end gap-1 text-sm tabular-nums text-gray-600 dark:text-slate-300">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {n}
              </span>
            </li>
          ))}
        </ol>
      )}
    </motion.section>
  );
};

export default MostViewed;
