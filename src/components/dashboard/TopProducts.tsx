import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, ImagePlus, Inbox, ShoppingBag } from 'lucide-react';
import type { RankedProduct } from '../../lib/productsHome';
import { minorToPrice } from '../../services/productsApi';
import { currencySymbol } from '../../utils/currency';
import { resolveImage } from '../../utils/images';

/**
 * LT-624 (Erel: "maybe show the cards of the best-selling products"): a products site's
 * home leads with its products - the four visitors want most, by the last 30 days'
 * inquiries and then views (there are no sales to count: visitors ask, they do not buy
 * yet). Each card is the product's picture with its place, its name and price, and how
 * often it was asked about and opened. With nothing counted yet they stand in the site's
 * order, and the card says so.
 */
const TopProducts: React.FC<{
  ranked: RankedProduct[];
  currency?: string;
  direction: 'ltr' | 'rtl';
  /** Beside the colours and sizes: two to a row up to xl. */
  narrow?: boolean;
}> = ({ ranked, currency, direction, narrow = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const Arrow = direction === 'rtl' ? ArrowLeft : ArrowRight;
  const counted = ranked.some((r) => r.asks > 0 || r.views > 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card h-full rounded-3xl p-4 sm:p-5"
      data-tour="top-products"
      data-testid="top-products"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="shrink-0 rounded-full bg-primary/10 p-2 text-primary">
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-800 dark:text-white">{t('dashboard.productsHome.topTitle')}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {ranked.length && !counted ? t('dashboard.productsHome.topEmpty') : t('dashboard.productsHome.topSub')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t('dashboard.productsHome.allProducts')}
          <Arrow className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {ranked.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.productsHome.noProducts')}</p>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            {t('products.add')}
          </button>
        </div>
      ) : (
        <ol className={`grid grid-cols-2 gap-3 sm:gap-4 ${narrow ? 'xl:grid-cols-4' : 'md:grid-cols-4'}`}>
          {ranked.map(({ product, asks, views }, i) => {
            const cover = product.images[0]?.url;
            return (
              <li key={product._id} className="min-w-0" data-testid="top-product">
                <button
                  type="button"
                  onClick={() => navigate('/products')}
                  className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white/50 text-start transition-transform hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-800/50"
                >
                  <span className="relative block aspect-square w-full bg-gray-100 dark:bg-slate-800">
                    {cover ? (
                      <img src={resolveImage(cover)} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-gray-400"><ImagePlus className="h-7 w-7" aria-hidden="true" /></span>
                    )}
                    {counted && (
                      <span
                        className="absolute start-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-gray-900 shadow dark:bg-slate-900/90 dark:text-white"
                        aria-label={t('dashboard.productsHome.rank', { n: i + 1 })}
                      >
                        {i + 1}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-1 flex-col gap-1 p-3">
                    <span className="break-words font-medium leading-snug text-gray-900 dark:text-white">{product.name}</span>
                    {typeof product.price === 'number' && (
                      <span className="text-sm text-gray-500 dark:text-gray-400" dir="ltr">{`${currencySymbol(currency)}${minorToPrice(product.price)}`}</span>
                    )}
                    <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1" data-testid="top-product-asks">
                        <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('dashboard.productsHome.asks', { count: asks })}
                      </span>
                      <span className="inline-flex items-center gap-1" data-testid="top-product-views">
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('products.views.card', { count: views })}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </motion.section>
  );
};

export default TopProducts;
