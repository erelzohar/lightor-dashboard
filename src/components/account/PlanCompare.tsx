import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Free and Lightor+ side by side (LT-465, Erel 2026-10-28), the same rows as
 * the register's pricing, lightor.app and the terms. The numbers are the
 * server's own limits (entitlements.ts): change both together.
 *  - `compare`: both plans, beside the plans on offer (web only, LT-130);
 *  - `plus`: what a subscriber's plan includes, a statement about the
 *    account (in the app too).
 */
export const PLAN_ROWS = [
  'bookings',
  'inquiries',
  'services',
  'texts',
  'siteLighty',
  'rebuilds',
  'pictures',
  'editing',
  'insights',
  'badge',
  'support',
] as const;

interface PlanCompareProps {
  mode: 'compare' | 'plus';
  /** What one extra booking costs, written in the page's language. */
  price: string;
}

const PlanCompare: React.FC<PlanCompareProps> = ({ mode, price }) => {
  const { t } = useTranslation();
  const cell = (row: (typeof PLAN_ROWS)[number], plan: 'free' | 'plus') => t(`billing.compare.rows.${row}.${plan}`, { price });

  if (mode === 'plus') {
    return (
      <div className="space-y-1" data-testid="plan-includes">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('billing.compare.includesTitle')}</p>
        <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5 list-disc ps-5">
          {PLAN_ROWS.map((row) => (
            // Each part isolated in the page's own direction: a label ending
            // in "AI" would pull the colon and the number into its run, and a
            // <bdi> would turn "Lighty ..." left to right.
            <li key={row}>
              <span className="[unicode-bidi:isolate]">{t(`billing.compare.rows.${row}.label`)}</span>:{' '}
              <span className="[unicode-bidi:isolate]">{cell(row, 'plus')}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="plan-compare">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('billing.compare.title')}</h3>
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200">
            <tr>
              <th scope="col" className="p-2 text-start font-medium">
                <span className="sr-only">{t('billing.compare.feature')}</span>
              </th>
              <th scope="col" className="p-2 text-start font-semibold">{t('billing.compare.free')}</th>
              <th scope="col" className="p-2 text-start font-semibold">
                <bdi>Lightor+</bdi>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-600 dark:text-gray-300">
            {PLAN_ROWS.map((row) => (
              <tr key={row}>
                <th scope="row" className="p-2 text-start font-medium text-gray-800 dark:text-gray-100">
                  {t(`billing.compare.rows.${row}.label`)}
                </th>
                <td className="p-2 align-top">{cell(row, 'free')}</td>
                <td className="p-2 align-top">{cell(row, 'plus')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('billing.compare.freeDays')}</p>
    </div>
  );
};

export default PlanCompare;
