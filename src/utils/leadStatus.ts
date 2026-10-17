import type { LeadStatus } from '../services/leadsApi';

/** A lead status's chip colours (LT-197): the leads page and a customer's card (LT-376). */
export const LEAD_STATUS_TINT: Record<LeadStatus, string> = {
  new: 'bg-primary/10 text-primary border-primary/30',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40',
  closed: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
};
