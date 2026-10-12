import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Appointment } from '../../types';
import { useTranslation } from 'react-i18next';
import { getDisplayStatus } from '../../utils/appointmentUtils';
import StatsWidget from '../ui/stats-widget';

interface IncomeStatsProps {
  appointments: Appointment[];
}

interface Period {
  start: Date;
  end: Date;
}

/** Completed appointments in a period, and what they brought in. */
export const incomeIn = (appointments: Appointment[], { start, end }: Period) => {
  let income = 0;
  let count = 0;
  for (const a of appointments) {
    const d = new Date(parseInt(a.timestamp));
    if (d < start || d > end || getDisplayStatus(a) !== 'completed') continue;
    count += 1;
    // `price` is an optional string: a service without one counts as 0, not NaN.
    income += Number(a.type?.price) || 0;
  }
  return { income, count };
};

const change = (current: number, previous: number): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

/**
 * Today / this week / this month (LT-272): each card is a stats widget whose
 * sparkline is the same figure over recent periods — the last 7 days, 7
 * weeks, 6 months — ending with the current one, which is still running.
 */
export const incomePeriods = (now: Date) => {
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week0 = new Date(day0);
  week0.setDate(day0.getDate() - day0.getDay());
  const month0 = new Date(now.getFullYear(), now.getMonth(), 1);

  // Counted in calendar steps, never in fixed milliseconds (DST days are 23/25 h).
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() - (6 - i));
    const end = i === 6 ? now : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, -1);
    return { start, end };
  });
  const weeks = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(week0.getFullYear(), week0.getMonth(), week0.getDate() - 7 * (6 - i));
    const end = i === 6 ? now : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, 0, 0, 0, -1);
    return { start, end };
  });
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(month0.getFullYear(), month0.getMonth() - (5 - i), 1);
    const end = i === 5 ? now : new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, -1);
    return { start, end };
  });
  return { days, weeks, months };
};

/**
 * The previous period cut at the point the running one has reached (LT-281):
 * yesterday up to this hour, last week up to this weekday and hour, last month
 * up to this day of the month (its last day when it is shorter). Comparing a
 * running period with the whole of the previous one always looked like a
 * drop early on. Calendar steps again, never fixed milliseconds.
 */
export const samePointIn = (previous: Period, now: Date, unit: 'day' | 'week' | 'month'): Period => {
  const { start } = previous;
  const daysIn =
    unit === 'day'
      ? 0
      : unit === 'week'
        ? now.getDay()
        : Math.min(now.getDate(), new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()) - 1;
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + daysIn,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
  return { start, end: end > previous.end ? previous.end : end };
};

const IncomeStats: React.FC<IncomeStatsProps> = ({ appointments }) => {
  const { t } = useTranslation();

  const cards = useMemo(() => {
    const now = new Date();
    const { days, weeks, months } = incomePeriods(now);
    const build = (periods: Period[], unit: 'day' | 'week' | 'month', label: string, changeLabel: string) => {
      const totals = periods.map((p) => incomeIn(appointments, p));
      const current = totals[totals.length - 1];
      const previous = incomeIn(appointments, samePointIn(periods[periods.length - 2], now, unit));
      return {
        label,
        changeLabel,
        value: `${t('appointments.currencySymbol')}${current.income.toLocaleString()}`,
        sub: `${current.count} ${t('incomeStats.appointments')}`,
        change: change(current.income, previous.income),
        series: totals.map((x) => x.income),
      };
    };
    return [
      build(days, 'day', t('incomeStats.today'), t('incomeStats.vsYesterday')),
      build(weeks, 'week', t('incomeStats.weekly'), t('incomeStats.vsLastWeek')),
      build(months, 'month', t('incomeStats.monthly'), t('incomeStats.vsLastMonth')),
    ];
  }, [appointments, t]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * (index + 1) }}
        >
          <StatsWidget {...card} />
        </motion.div>
      ))}
    </div>
  );
};

export default IncomeStats;
