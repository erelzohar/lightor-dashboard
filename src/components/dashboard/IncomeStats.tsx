import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Appointment } from '../../types';
import { useTranslation } from 'react-i18next';
import { getDisplayStatus } from '../../utils/appointmentUtils';
import Card from '../ui/Card';

interface IncomeStatsProps {
  appointments: Appointment[];
}

const IncomeStats: React.FC<IncomeStatsProps> = ({ appointments }) => {
  const { t } = useTranslation();

  const calculateIncome = (appts: Appointment[], startDate: Date, endDate: Date) => {
    return appts
      .filter(a => {
        const d = new Date(parseInt(a.timestamp));
        return d >= startDate && d <= endDate && getDisplayStatus(a) === 'completed';
      })
      .reduce((total, a) => total + parseInt(a.type.price), 0);
  };

  const countAppointments = (appts: Appointment[], startDate: Date, endDate: Date) => {
    return appts.filter(a => {
      const d = new Date(parseInt(a.timestamp));
      return d >= startDate && d <= endDate && getDisplayStatus(a) === 'completed';
    }).length;
  };

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayIncome = calculateIncome(appointments, startOfDay, now);
  const weekIncome = calculateIncome(appointments, startOfWeek, now);
  const monthIncome = calculateIncome(appointments, startOfMonth, now);

  const todayCount = countAppointments(appointments, startOfDay, now);
  const weekCount = countAppointments(appointments, startOfWeek, now);
  const monthCount = countAppointments(appointments, startOfMonth, now);

  // Previous periods for % change
  const yesterdayStart = new Date(startOfDay);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(startOfDay.getTime() - 1);

  const lastWeekStart = new Date(startOfWeek);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(startOfWeek.getTime() - 1);

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const yesterdayIncome = calculateIncome(appointments, yesterdayStart, yesterdayEnd);
  const lastWeekIncome = calculateIncome(appointments, lastWeekStart, lastWeekEnd);
  const lastMonthIncome = calculateIncome(appointments, lastMonthStart, lastMonthEnd);

  const getChange = (current: number, previous: number): number | null => {
    if (previous === 0) return current > 0 ? 100 : null;
    return ((current - previous) / previous) * 100;
  };

  const todayChange = getChange(todayIncome, yesterdayIncome);
  const weekChange = getChange(weekIncome, lastWeekIncome);
  const monthChange = getChange(monthIncome, lastMonthIncome);

  const stats = [
    {
      title: t('incomeStats.today'),
      value: todayIncome,
      count: todayCount,
      change: todayChange,
      changeLabel: t('incomeStats.vsYesterday'),
      icon: <Calendar className="text-blue-500" size={20} />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      accentColor: 'bg-blue-500',
      delay: 0.1,
    },
    {
      title: t('incomeStats.weekly'),
      value: weekIncome,
      count: weekCount,
      change: weekChange,
      changeLabel: t('incomeStats.vsLastWeek'),
      icon: <TrendingUp className="text-emerald-500" size={20} />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      accentColor: 'bg-emerald-500',
      delay: 0.2,
    },
    {
      title: t('incomeStats.monthly'),
      value: monthIncome,
      count: monthCount,
      change: monthChange,
      changeLabel: t('incomeStats.vsLastMonth'),
      icon: <DollarSign className="text-violet-500" size={20} />,
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      accentColor: 'bg-violet-500',
      delay: 0.3,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: stat.delay }}
        >
          <Card animate={false} className="relative overflow-hidden h-full">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-light-gray font-medium">{stat.title}</p>
                <h4 className="text-2xl font-bold mt-1">
                  {t('appointments.currencySymbol')}{stat.value.toLocaleString()}
                </h4>
                <p className="text-xs text-light-gray mt-0.5">
                  {stat.count} {t('incomeStats.appointments')}
                </p>
              </div>
              <div className={`p-2.5 rounded-xl ${stat.iconBg} shrink-0`}>
                {stat.icon}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-light-gray/10 flex items-center gap-2">
              {stat.change !== null ? (
                <>
                  {stat.change >= 0 ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                      <TrendingUp size={11} />
                      +{stat.change.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                      <TrendingDown size={11} />
                      {stat.change.toFixed(1)}%
                    </span>
                  )}
                  <span className="text-xs text-light-gray">{stat.changeLabel}</span>
                </>
              ) : (
                <span className="text-xs text-light-gray">{stat.changeLabel}</span>
              )}
            </div>

            <div className={`absolute bottom-0 left-0 w-full h-0.5 ${stat.accentColor} opacity-40`} />
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default IncomeStats;
