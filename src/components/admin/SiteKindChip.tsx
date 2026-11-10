import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanStanding, SiteKind } from '../../services/adminApi';

/**
 * LT-647: what a business's site is (bookings, inquiries, products, or none
 * yet) and where it stands on the plans, as pills for the admin panel. The
 * panel spoke of bookings alone; every kind of site reads the same here.
 */
const KIND_STYLES: Record<SiteKind, string> = {
  book: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  lead: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  products: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  none: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const PLAN_STYLES: Record<PlanStanding, string> = {
  free: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  freeDays: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  plus: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  pro: 'bg-primary/10 text-primary',
  sandbox: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const PILL = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold';

export const SiteKindChip: React.FC<{ kind?: SiteKind }> = ({ kind }) => {
  const { t } = useTranslation();
  if (!kind) return null;
  return (
    <span className={`${PILL} ${KIND_STYLES[kind]}`} data-testid={`site-kind-${kind}`}>
      {t(`admin.siteKind.${kind}`)}
    </span>
  );
};

export const PlanChip: React.FC<{ plan?: PlanStanding }> = ({ plan }) => {
  const { t } = useTranslation();
  if (!plan) return null;
  return (
    <span className={`${PILL} ${PLAN_STYLES[plan]}`} data-testid={`plan-${plan}`}>
      {t(`admin.planStanding.${plan}`)}
    </span>
  );
};
