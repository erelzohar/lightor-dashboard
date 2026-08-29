import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Coins,
  MessageSquare,
  Mail,
  Sparkles,
  Server,
  Info,
  RotateCcw,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Select from '../../components/ui/Select';
import DataTable, { DataTableColumn } from '../../components/ui/DataTable';
import StatusBadge from '../../components/admin/StatusBadge';
import {
  fetchCostsSummary,
  fetchCostsByTenant,
  resetAiQuota,
  CostsSummary,
  TenantCost,
} from '../../services/adminApi';

/**
 * Admin → Costs (LT-058): the operator's burn-rate view. Live months come
 * from UsageEvent metering; months before the metering deploy come back as
 * a clearly-bannered booking-volume estimate.
 */
const AdminCosts: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<CostsSummary | null>(null);
  const [tenants, setTenants] = useState<TenantCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  // LT-076: prod-testing escape hatch — clears this IP's daily visitor AI
  // budget (the register wizard) and the admin's own monthly counters.
  const handleResetQuota = async () => {
    setResetting(true);
    try {
      await resetAiQuota();
      toast.success(t('admin.costs.resetQuotaDone'));
    } catch {
      toast.error(t('admin.costs.resetQuotaFailed'));
    } finally {
      setResetting(false);
    }
  };

  document.title = t('admin.costs.title');

  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const value = d.toISOString().slice(0, 7);
      options.push({
        value,
        label: d.toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
          month: 'long',
          year: 'numeric',
        }),
      });
    }
    return options;
  }, [i18n.language]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, tenantsData] = await Promise.all([
        fetchCostsSummary(month),
        fetchCostsByTenant(month),
      ]);
      setSummary(summaryData);
      setTenants(tenantsData);
    } catch {
      toast.error(t('admin.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [month, t]);

  useEffect(() => {
    load();
  }, [load]);

  const ils = (value: number) => (
    <span dir="ltr">₪{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
  );

  const tenantColumns: DataTableColumn<TenantCost>[] = [
    {
      key: 'name',
      label: t('admin.users.columns.name'),
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={`/admin/users/${row.userId}`}
            className="font-semibold text-gray-900 dark:text-dark-text hover:text-primary truncate block"
          >
            {row.businessName || row.name || row.email}
          </Link>
          {row.subDomain && (
            <p className="text-xs text-gray-400" dir="ltr">
              {row.subDomain}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'plan',
      label: t('admin.users.columns.plan'),
      render: (row) => <StatusBadge status={row.subscriptionStatus ?? 'free'} />,
    },
    {
      key: 'sms',
      label: t('admin.costs.kinds.sms'),
      className: 'hidden md:table-cell',
      render: (row) => <span className="tabular-nums">{row.counts.sms + row.counts.whatsapp}</span>,
    },
    {
      key: 'ai',
      label: t('admin.costs.kinds.ai'),
      className: 'hidden md:table-cell',
      render: (row) => (
        <span className="tabular-nums">
          {row.counts.ai}
          <span className="block text-xs text-gray-400">
            {t('admin.costs.kinds.aiTokens', {
              tokens: (row.counts.aiTokens ?? 0).toLocaleString(),
            })}
          </span>
        </span>
      ),
    },
    {
      key: 'costILS',
      label: t('admin.costs.columns.cost'),
      render: (row) => <span className="font-semibold tabular-nums">{ils(row.costILS)}</span>,
    },
  ];

  if (loading && !summary) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Coins size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
              {t('admin.costs.title')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.costs.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetQuota}
            disabled={resetting}
            title={t('admin.costs.resetQuotaHint')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} />
            {t('admin.costs.resetQuota')}
          </button>
          <Select
            fullWidth={false}
            className="!py-2 text-sm min-w-[170px]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            options={monthOptions}
          />
        </div>
      </div>

      {summary?.estimated && (
        <div className="flex items-start gap-2.5 mb-6 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-sm">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>{t('admin.costs.estimatedBanner')}</p>
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard
              label={t('admin.costs.kpi.variable')}
              value={ils(summary.variableILS)}
              subline={t('admin.costs.kpi.variableDetail')}
              icon={<MessageSquare size={20} className="text-blue-500" />}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              accent="bg-blue-500"
              delay={0.05}
            />
            <StatCard
              label={t('admin.costs.kpi.fixed')}
              value={ils(summary.fixedILS)}
              subline={t('admin.costs.kpi.fixedDetail')}
              icon={<Server size={20} className="text-gray-500" />}
              iconBg="bg-gray-100 dark:bg-gray-800"
              accent="bg-gray-400"
              delay={0.1}
            />
            <StatCard
              label={t('admin.costs.kpi.total')}
              value={ils(summary.totalILS)}
              subline={t('admin.costs.kpi.totalDetail', { month })}
              icon={<Coins size={20} className="text-violet-500" />}
              iconBg="bg-violet-100 dark:bg-violet-900/30"
              accent="bg-violet-500"
              delay={0.15}
            />
          </div>

          {/* ── Per-kind breakdown ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <Card animate={false}>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={15} className="text-blue-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-dark-text">
                  {t('admin.costs.kinds.sms')}
                </h4>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-dark-text">
                {ils(summary.variable.sms.costILS)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('admin.costs.kinds.messages', { count: summary.variable.sms.count })}
              </p>
            </Card>
            <Card animate={false}>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={15} className="text-emerald-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-dark-text">
                  {t('admin.costs.kinds.whatsapp')}
                </h4>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-dark-text">
                {ils(summary.variable.whatsapp.costILS)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('admin.costs.kinds.messages', { count: summary.variable.whatsapp.count })}
              </p>
            </Card>
            <Card animate={false}>
              <div className="flex items-center gap-2 mb-2">
                <Mail size={15} className="text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-dark-text">
                  {t('admin.costs.kinds.email')}
                </h4>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-dark-text">
                {ils(summary.variable.email.costILS)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('admin.costs.kinds.messages', { count: summary.variable.email.count })}
              </p>
            </Card>
            <Card animate={false}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={15} className="text-violet-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-dark-text">
                  {t('admin.costs.kinds.ai')}
                </h4>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-dark-text">
                {ils(summary.variable.ai.costILS)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('admin.costs.kinds.aiDetail', {
                  calls: summary.variable.ai.calls,
                  tokens: (summary.variable.ai.inputTokens + summary.variable.ai.outputTokens).toLocaleString(),
                })}
              </p>
            </Card>
          </div>
        </>
      )}

      {/* ── Top consumers ── */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-dark-text">
          {t('admin.costs.topConsumers')}
        </h3>
      </div>
      <DataTable
        columns={tenantColumns}
        rows={tenants}
        rowKey={(row) => row.userId}
        loading={loading}
        emptyMessage={t('admin.costs.noTenantData')}
      />
    </motion.div>
  );
};

export default AdminCosts;
