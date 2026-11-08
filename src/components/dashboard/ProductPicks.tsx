import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Palette } from 'lucide-react';
import type { ProductInterest } from '../../services/leadsApi';

/**
 * LT-624: on a products site's home, the colours and sizes visitors picked when they asked
 * about a product (LT-588) - what to keep in stock. Ranked bars on one baseline, like the
 * products page's most viewed (LT-569): one colour for every bar, and the colour's own swatch
 * beside its name, so a pale one still reads.
 */
const ProductPicks: React.FC<{ picks: ProductInterest['picks'] }> = ({ picks }) => {
  const { t } = useTranslation();
  const max = Math.max(1, ...picks.map((p) => p.count));
  const colors = picks.filter((p) => p.kind === 'color');
  const sizes = picks.filter((p) => p.kind === 'size');

  const rows = (list: ProductInterest['picks'], heading: string) =>
    list.length > 0 && (
      <div>
        <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">{heading}</p>
        <ol className="space-y-2.5" aria-label={heading}>
          {list.map((pick) => (
            <li key={`${pick.kind}-${pick.value}`} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3" data-testid="product-pick">
              <span className="flex min-w-0 items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                {pick.kind === 'color' && (
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/15 dark:border-white/25"
                    style={{ backgroundColor: pick.hex }}
                    aria-hidden="true"
                  />
                )}
                <span className="break-words">{pick.value}</span>
              </span>
              <span className="h-2 rounded-full bg-gray-100 dark:bg-slate-700/60" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (pick.count / max) * 100)}%` }} />
              </span>
              <span className="min-w-[1.5rem] text-end text-sm tabular-nums text-gray-600 dark:text-gray-300">{pick.count}</span>
            </li>
          ))}
        </ol>
      </div>
    );

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card h-full rounded-3xl p-4 sm:p-5"
      data-testid="product-picks"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="shrink-0 rounded-full bg-primary/10 p-2 text-primary">
          <Palette className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-800 dark:text-white">{t('dashboard.productsHome.picksTitle')}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.productsHome.picksSub')}</p>
        </div>
      </div>
      <div className="space-y-5">
        {rows(colors, t('products.colors'))}
        {rows(sizes, t('products.sizes'))}
      </div>
    </motion.section>
  );
};

export default ProductPicks;
