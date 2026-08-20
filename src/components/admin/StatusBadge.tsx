import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Status pill for admin tables (LT-058): subscription status, boarding
 * status, roles and appointment states share one palette so the same status
 * reads the same everywhere in the panel.
 */
const STYLES: Record<string, string> = {
  // subscription
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  free: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  past_due: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  canceled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  deleted: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  // boarding
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  onboarded: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  // roles
  admin: 'bg-primary/10 text-primary',
  user: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  client: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  // appointments
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

interface StatusBadgeProps {
  status?: string | null;
  /** i18n prefix for the label, e.g. 'admin.status' → admin.status.active. */
  i18nPrefix?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, i18nPrefix = 'admin.status' }) => {
  const { t } = useTranslation();
  // Old test-era accounts miss some status fields entirely — show a quiet
  // dash rather than a raw "admin.x.undefined" i18n key.
  if (!status) {
    return <span className="text-gray-300 dark:text-gray-600">—</span>;
  }
  const style = STYLES[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${style}`}>
      {t(`${i18nPrefix}.${status}`, { defaultValue: status })}
    </span>
  );
};

export default StatusBadge;
