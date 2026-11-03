import React from 'react';
import { useTranslation } from 'react-i18next';
import { PLAN_NAMES, type PaidPlan } from '../../services/paddleApi';

/**
 * The plans side by side (LT-465, Erel 2026-10-28; three since LT-504), the
 * same rows as the register's pricing, lightor.app and the terms. The numbers
 * are the server's own limits (entitlements.ts): change both together.
 *  - `compare`: the plans, beside the ones on offer (web only, LT-130);
 *  - `includes`: what a subscriber's plan includes, a statement about the
 *    account (in the app too).
 */
export const PLAN_ROWS = [
  'bookings',
  'inquiries',
  'services',
  // LT-565: entitlements' maxProducts, on any site (a booking site can show products too).
  'products',
  'texts',
  'siteLighty',
  'rebuilds',
  'pictures',
  'editing',
  // LT-551: the paid plans' line, no model named (Erel 2026-11-02).
  'aiModel',
  'insights',
  'history',
  'badge',
  'support',
] as const;

type PlanColumn = 'free' | PaidPlan;

interface PlanCompareProps {
  mode: 'compare' | 'includes';
  /** The subscriber's plan, for `includes`. */
  plan?: PaidPlan;
  /** What one extra booking costs, written in the page's language. */
  price: string;
  /** A leads site (LT-511): it takes no bookings and sends no booking's texts. */
  leadsSite?: boolean;
}

const PlanCompare: React.FC<PlanCompareProps> = ({ mode, plan = 'pro', price, leadsSite = false }) => {
  const { t } = useTranslation();
  const rows = leadsSite ? PLAN_ROWS.filter((row) => row !== 'bookings' && row !== 'texts') : PLAN_ROWS;
  const cell = (row: (typeof PLAN_ROWS)[number], column: PlanColumn) => t(`billing.compare.rows.${row}.${column}`, { price });

  if (mode === 'includes') {
    return (
      <div className="space-y-1" data-testid="plan-includes">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('billing.compare.includesTitle')}</p>
        <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5 list-disc ps-5">
          {rows.map((row) => (
            // Plain sentences, as on the plan cards (Erel 2026-11-01).
            <li key={row}>{t(`billing.pricing.rows.${row}.${plan}`, { price })}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="plan-compare">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('billing.compare.title')}</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full min-w-[32rem] text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200">
            <tr>
              <th scope="col" className="p-2 text-start font-medium">
                <span className="sr-only">{t('billing.compare.feature')}</span>
              </th>
              <th scope="col" className="p-2 text-start font-semibold">{t('billing.compare.free')}</th>
              <th scope="col" className="p-2 text-start font-semibold">
                <bdi>{PLAN_NAMES.plus}</bdi>
              </th>
              <th scope="col" className="p-2 text-start font-semibold">
                <bdi>{PLAN_NAMES.pro}</bdi>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-600 dark:text-gray-300">
            {rows.map((row) => (
              <tr key={row}>
                <th scope="row" className="p-2 text-start font-medium text-gray-800 dark:text-gray-100">
                  {t(`billing.compare.rows.${row}.label`)}
                </th>
                <td className="p-2 align-top">{cell(row, 'free')}</td>
                <td className="p-2 align-top">{cell(row, 'plus')}</td>
                <td className="p-2 align-top">{cell(row, 'pro')}</td>
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
