import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Building2,
  CreditCard,
  CalendarRange,
  Banknote,
  ExternalLink,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import { DonutChart } from '../../components/ui/donut-chart';
import ErrorBoundaryWithLanguage from '../../components/ui/ErrorBoundary';
import StatusBadge from '../../components/admin/StatusBadge';
import { useTheme } from '../../contexts/ThemeContext';
import {
  fetchOverview,
  fetchTimeseries,
  fetchTopBusinesses,
  AdminOverview as OverviewData,
  TimeseriesPoint,
  TopBusiness,
} from '../../services/adminApi';

/**
 * Admin → Overview (LT-058): the operator's KPI wall — system totals, the
 * signup→paying funnel, MRR, a 30-day signups chart, plan mix, and the
 * busiest tenants. Three requests total; each widget degrades independently
 * behind an error boundary.
 */
const AdminOverview: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { darkMode, direction } = useTheme();

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [signups, setSignups] = useState<TimeseriesPoint[]>([]);
  const [topBusinesses, setTopBusinesses] = useState<TopBusiness[]>([]);
  const [loading, setLoading] = useState(true);

  document.title = t('admin.overview.title');

  useEffect(() => {
    (async () => {
      try {
        const [overviewData, signupsData, topData] = await Promise.all([
          fetchOverview(),
          fetchTimeseries('signups', 'day'),
          fetchTopBusinesses(8),
        ]);
        setOverview(overviewData);
        setSignups(signupsData);
        setTopBusinesses(topData);
      } catch {
        toast.error(t('admin.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading || !overview) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { totals, funnel, mrr, paddleEnv } = overview;

  // Fill missing days so the chart doesn't skip quiet days.
  const signupsByDate = new Map(signups.map((p) => [p.date, p.count]));
  const chartData: { date: string; label: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    chartData.push({
      date: key,
      label: d.toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
        day: '2-digit',
        month: '2-digit',
      }),
      count: signupsByDate.get(key) ?? 0,
    });
  }

  const planMix = [
    { label: t('admin.status.active'), value: totals.bySubscriptionStatus.active ?? 0, color: '#10b981' },
    { label: t('admin.status.free'), value: totals.bySubscriptionStatus.free ?? 0, color: '#94a3b8' },
    { label: t('admin.status.past_due'), value: totals.bySubscriptionStatus.past_due ?? 0, color: '#f59e0b' },
    { label: t('admin.status.canceled'), value: totals.bySubscriptionStatus.canceled ?? 0, color: '#ef4444' },
  ].filter((segment) => segment.value > 0);

  const funnelSteps = [
    { label: t('admin.overview.funnel.signedUp'), value: funnel.signedUp, color: 'bg-blue-500' },
    { label: t('admin.overview.funnel.onboarded'), value: funnel.onboarded, color: 'bg-violet-500' },
    { label: t('admin.overview.funnel.verified'), value: funnel.verified, color: 'bg-emerald-500' },
    { label: t('admin.overview.funnel.paying'), value: funnel.paying, color: 'bg-amber-500' },
  ];
  const funnelMax = Math.max(funnel.signedUp, 1);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
            {t('admin.overview.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.overview.subtitle')}</p>
        </div>
        {paddleEnv === 'sandbox' && (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {t('admin.overview.sandboxBadge')}
          </span>
        )}
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t('admin.overview.kpi.businesses')}
          value={totals.businesses.toLocaleString()}
          subline={t('admin.overview.kpi.verifiedOfThem', { count: totals.verified })}
          icon={<Building2 size={20} className="text-blue-500" />}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          accent="bg-blue-500"
          delay={0.05}
        />
        <StatCard
          label={t('admin.overview.kpi.activeSubs')}
          value={(totals.bySubscriptionStatus.active ?? 0).toLocaleString()}
          subline={t('admin.overview.kpi.ofBusinesses', { count: totals.businesses })}
          icon={<CreditCard size={20} className="text-emerald-500" />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          accent="bg-emerald-500"
          delay={0.1}
        />
        <StatCard
          label={t('admin.overview.kpi.mrr')}
          value={<span dir="ltr">₪{mrr.mrrILS.toLocaleString()}</span>}
          subline={t('admin.overview.kpi.mrrDetail', {
            monthly: mrr.activeMonthly,
            yearly: mrr.activeYearly,
          })}
          icon={<Banknote size={20} className="text-violet-500" />}
          iconBg="bg-violet-100 dark:bg-violet-900/30"
          accent="bg-violet-500"
          delay={0.15}
        />
        <StatCard
          label={t('admin.overview.kpi.appointmentsThisMonth')}
          value={totals.appointmentsThisMonth.toLocaleString()}
          subline={t('admin.overview.kpi.appointmentsTotal', {
            count: totals.appointmentsTotal,
          })}
          icon={<CalendarRange size={20} className="text-amber-500" />}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          accent="bg-amber-500"
          delay={0.2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* ── Signups chart ── */}
        <ErrorBoundaryWithLanguage>
          <Card animate={false} className="lg:col-span-2">
            <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">
              {t('admin.overview.signupsChart')}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                  className={direction === 'rtl' ? 'direction-rtl' : ''}
                >
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: darkMode ? '#2f2f2f' : '#fff',
                      border: '0.0625rem solid ' + (darkMode ? '#464646' : '#e2e8f0'),
                      borderRadius: '0.5rem',
                    }}
                    formatter={(value: number) => [value, t('admin.overview.signups')]}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </ErrorBoundaryWithLanguage>

        {/* ── Plan mix donut ── */}
        <ErrorBoundaryWithLanguage>
          <Card animate={false}>
            <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">
              {t('admin.overview.planMix')}
            </h3>
            {planMix.length === 0 ? (
              <p className="text-sm text-gray-400">{t('admin.table.empty')}</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <DonutChart
                  data={planMix}
                  size={170}
                  strokeWidth={22}
                  centerContent={
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">
                        {totals.businesses}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {t('admin.overview.kpi.businesses')}
                      </p>
                    </div>
                  }
                />
                <ul className="w-full space-y-1.5">
                  {planMix.map((segment) => (
                    <li key={segment.label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: segment.color }}
                        />
                        {segment.label}
                      </span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                        {segment.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </ErrorBoundaryWithLanguage>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Funnel ── */}
        <ErrorBoundaryWithLanguage>
          <Card animate={false}>
            <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">
              {t('admin.overview.funnel.title')}
            </h3>
            <div className="space-y-3">
              {funnelSteps.map((step) => (
                <div key={step.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-300">{step.label}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                      {step.value}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${step.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(step.value / funnelMax) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </ErrorBoundaryWithLanguage>

        {/* ── Top businesses ── */}
        <ErrorBoundaryWithLanguage>
          <Card animate={false} className="lg:col-span-2">
            <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">
              {t('admin.overview.topBusinesses')}
            </h3>
            {topBusinesses.length === 0 ? (
              <p className="text-sm text-gray-400">{t('admin.table.empty')}</p>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-gray-800/40">
                {topBusinesses.map((business, index) => (
                  <li key={business.userId} className="py-2.5 flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-gray-400 tabular-nums">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/admin/users/${business.userId}`}
                        className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-primary truncate block"
                      >
                        {business.businessName || business.name || business.email}
                      </Link>
                      {business.subDomain && (
                        <a
                          href={`https://${business.subDomain}.lightor.app`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-gray-400 hover:text-primary inline-flex items-center gap-1"
                          dir="ltr"
                        >
                          {business.subDomain}.lightor.app
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    {business.subscriptionStatus && (
                      <StatusBadge status={business.subscriptionStatus} />
                    )}
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums">
                      {business.bookings}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </ErrorBoundaryWithLanguage>
      </div>
    </motion.div>
  );
};

export default AdminOverview;
