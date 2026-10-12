import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import StatsWidget, { StatsWidgetProps } from '../ui/stats-widget';
import type { LeadStats } from '../../services/leadsApi';

interface LeadsStatsProps {
  stats: LeadStats;
  /** The waiting card opens the leads page. */
  onOpenLeads: () => void;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Percent change against last month; none when last month had nothing to compare with. */
export const monthChange = (thisMonth: number, lastMonth: number): number | null =>
  lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;

/**
 * The average response time as the owner reads it: minutes under an hour,
 * hours with one decimal (no ".0") under two days, whole days beyond — and
 * "—" until one has been measured. Each unit is decided on the rounded
 * figure, so 59.6 minutes reads "1 hour", never "60 min".
 */
export const formatResponseTime = (ms: number | null, t: TFunction, language: string): string => {
  if (ms === null) return '—';
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return t('dashboard.leadsStats.minutes', { value: minutes });
  const hours = Math.round(ms / (HOUR / 10)) / 10;
  if (hours < 48) {
    // The locale's decimal mark ("2,5 h" in French), in Western digits like the other cards.
    const numbers = language.split('-')[0] === 'ar' ? 'ar-u-nu-latn' : language;
    const value = new Intl.NumberFormat(numbers, { maximumFractionDigits: 1 }).format(hours);
    return t(hours === 1 ? 'dashboard.leadsStats.hour' : 'dashboard.leadsStats.hours', { value });
  }
  return t('dashboard.leadsStats.days', { value: Math.round(ms / DAY) });
};

/**
 * A leads site's four numbers (LT-274), on the bookings home's stats widgets
 * (LT-272) so both homes read as one family: this month's inquiries against
 * last month's, how many still wait for an answer, how fast the owner
 * answers, and how many of the last 30 days' inquiries were handled. Two to a
 * row on phones, four across from lg.
 */
const LeadsStats: React.FC<LeadsStatsProps> = ({ stats, onOpenLeads }) => {
  const { t, i18n } = useTranslation();
  const { total, handled } = stats.last30;

  const cards: (StatsWidgetProps & { key: string })[] = [
    {
      key: 'month',
      label: t('dashboard.leadsStats.thisMonth'),
      value: String(stats.thisMonth),
      // Against last month up to the same day and hour (LT-281): a running
      // month against all of the last one always looked like a drop.
      change: monthChange(stats.thisMonth, stats.lastMonthToDate ?? stats.lastMonth),
      sub: t('dashboard.leadsStats.lastMonth', { count: stats.lastMonthToDate ?? stats.lastMonth }),
      series: stats.perDay.map((d) => d.count),
    },
    {
      key: 'waiting',
      label: t('dashboard.leadsStats.waiting'),
      value: String(stats.waiting),
      change: null,
      sub: stats.waiting > 0 ? t('dashboard.leadsStats.waitingCta') : t('dashboard.leadsStats.waitingNone'),
      tone: stats.waiting > 0 ? 'warning' : 'default',
      // The leads page has no status filter in its URL, so this opens the whole list.
      onClick: onOpenLeads,
    },
    {
      key: 'response',
      label: t('dashboard.leadsStats.responseTime'),
      value: formatResponseTime(stats.avgResponseMs, t, i18n.language),
      change: null,
      ...(stats.avgResponseMs === null
        ? { hint: t('dashboard.leadsStats.responseNotYet') }
        : { sub: t('dashboard.leadsStats.last30') }),
    },
    {
      key: 'handled',
      label: t('dashboard.leadsStats.handled'),
      value: total > 0 ? `${Math.round((handled / total) * 100)}%` : '—',
      change: null,
      sub: total > 0 ? t('dashboard.leadsStats.handledOf', { handled, total }) : t('dashboard.leadsStats.last30'),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="leads-stats">
      {cards.map(({ key, ...card }, index) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * (index + 1) }}
          data-testid={`leads-stat-${key}`}
        >
          <StatsWidget {...card} compact />
        </motion.div>
      ))}
    </div>
  );
};

export default LeadsStats;
