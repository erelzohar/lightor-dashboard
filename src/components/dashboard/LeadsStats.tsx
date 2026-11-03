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

/** "15.11" from "2026-11-15": the day the visits began to be counted. */
const dayLabel = (day: string): string => {
  const [, m, d] = day.split('-');
  return `${Number(d)}.${Number(m)}`;
};

/**
 * LT-569: what share of the visits left a lead over the last 30 days - the
 * leads counted only from the day the visits were, so the first weeks are
 * not inflated by leads from before it. Null without a visit.
 */
export const conversionRate = (stats: LeadStats): { rate: number; leads: number; visits: number } | null => {
  const v = stats.visits;
  if (!v || v.last30 <= 0) return null;
  const leads = stats.perDay.filter((d) => !v.since || d.date >= v.since).reduce((sum, d) => sum + d.count, 0);
  return { rate: Math.round((leads / v.last30) * 1000) / 10, leads, visits: v.last30 };
};

/** The visits began to be counted after last month's start: no month to compare with yet. */
const comparable = (since: string | null, perDay: { date: string }[]): boolean => {
  if (!since) return false;
  const today = perDay[perDay.length - 1]?.date;
  if (!today) return false;
  const [y, m] = today.split('-').map(Number);
  const lastMonthStart = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  return since <= lastMonthStart;
};

/**
 * The average response time as the owner reads it: minutes under an hour,
 * hours with one decimal (no ".0") under two days, whole days beyond — and
 * "—" until one has been measured. Each unit is decided on the rounded
 * figure, so 59.6 minutes reads "1 hour", never "60 min".
 */
export const formatResponseTime = (ms: number | null, t: TFunction, language: string): string => {
  if (ms === null) return '-';
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
 * row on phones, four across from lg. LT-569: the site's visits and the
 * share that left a lead join them - then three across from lg.
 */
const LeadsStats: React.FC<LeadsStatsProps> = ({ stats, onOpenLeads }) => {
  const { t, i18n } = useTranslation();
  const { total, handled } = stats.last30;

  const visits = stats.visits;
  const conversion = conversionRate(stats);
  const visitsCompared = !!visits && comparable(visits.since, visits.perDay);
  // LT-569: the visits and the share that left a lead, beside the month's leads.
  const visitCards: (StatsWidgetProps & { key: string })[] = visits ? [
    {
      key: 'visits',
      label: t('dashboard.leadsStats.visits'),
      value: String(visits.thisMonth),
      change: visitsCompared ? monthChange(visits.thisMonth, visits.lastMonthToDate) : null,
      sub: visitsCompared || !visits.since
        ? t('dashboard.leadsStats.lastMonth', { count: visits.lastMonthToDate })
        : t('dashboard.leadsStats.countedSince', { date: dayLabel(visits.since) }),
      series: visits.perDay.map((d) => d.count),
    },
    {
      key: 'conversion',
      label: t('dashboard.leadsStats.conversion'),
      value: conversion ? `${conversion.rate}%` : '-',
      change: null,
      ...(conversion
        ? { sub: t('dashboard.leadsStats.conversionOf', { leads: conversion.leads, visits: conversion.visits }) }
        : { hint: t('dashboard.leadsStats.conversionNotYet') }),
    },
  ] : [];

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
    ...visitCards,
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
      value: total > 0 ? `${Math.round((handled / total) * 100)}%` : '-',
      change: null,
      sub: total > 0 ? t('dashboard.leadsStats.handledOf', { handled, total }) : t('dashboard.leadsStats.last30'),
    },
  ];

  return (
    <div className={`grid grid-cols-2 ${visits ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3 sm:gap-4`} data-testid="leads-stats">
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
