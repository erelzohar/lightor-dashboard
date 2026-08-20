import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CreditCard, Banknote, AlertTriangle, XCircle, ExternalLink } from 'lucide-react';
import DataTable, { DataTableColumn } from '../../components/ui/DataTable';
import Select from '../../components/ui/Select';
import StatCard from '../../components/ui/StatCard';
import StatusBadge from '../../components/admin/StatusBadge';
import {
  fetchSubscriptions,
  AdminUserRow,
  Paginated,
  SubscriptionsSummary,
} from '../../services/adminApi';

/**
 * Admin → Subscriptions (LT-058): every account that ever had a Paddle
 * subscription, with MRR summary. Money operations (refunds, plan changes)
 * deliberately live in Paddle — each row deep-links there.
 */
const AdminSubscriptions: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [result, setResult] = useState<(Paginated<AdminUserRow> & { summary: SubscriptionsSummary }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  document.title = t('admin.subscriptions.title');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await fetchSubscriptions({ page, limit: 20, status: status || undefined }));
    } catch {
      toast.error(t('admin.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, status, t]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = result?.summary;

  const paddleBase = summary?.paddleEnv === 'sandbox'
    ? 'https://sandbox-vendors.paddle.com'
    : 'https://vendors.paddle.com';

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';

  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      key: 'name',
      label: t('admin.users.columns.name'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-dark-text truncate">{row.name}</p>
          <p className="text-xs text-gray-400 truncate" dir="ltr">
            {row.email}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: t('admin.subscriptions.columns.status'),
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.subscription.status} />
          {row.subscription.cancelAtPeriodEnd && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 whitespace-nowrap">
              {t('admin.subscriptions.endingSoon')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'nextBillDate',
      label: t('admin.subscriptions.columns.nextBill'),
      className: 'hidden md:table-cell',
      render: (row) => (
        <span className="text-gray-500">{formatDate(row.subscription.nextBillDate)}</span>
      ),
    },
    {
      key: 'subscriptionId',
      label: t('admin.subscriptions.columns.paddleId'),
      className: 'hidden lg:table-cell',
      render: (row) => (
        <span className="font-mono text-xs text-gray-500" dir="ltr">
          {row.subscription.subscriptionId}
        </span>
      ),
    },
    {
      key: 'paddle',
      label: '',
      render: (row) =>
        row.subscription.subscriptionId ? (
          <a
            href={`${paddleBase}/subscriptions-v2/${row.subscription.subscriptionId}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
          >
            Paddle
            <ExternalLink size={11} />
          </a>
        ) : null,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
          {t('admin.subscriptions.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('admin.subscriptions.subtitle')}
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard
            label={t('admin.overview.kpi.mrr')}
            value={<span dir="ltr">₪{summary.mrrILS.toLocaleString()}</span>}
            subline={t('admin.overview.kpi.mrrDetail', {
              monthly: summary.activeMonthly,
              yearly: summary.activeYearly,
            })}
            icon={<Banknote size={20} className="text-violet-500" />}
            iconBg="bg-violet-100 dark:bg-violet-900/30"
            accent="bg-violet-500"
            delay={0.05}
          />
          <StatCard
            label={t('admin.status.active')}
            value={(summary.byStatus.active ?? 0).toLocaleString()}
            icon={<CreditCard size={20} className="text-emerald-500" />}
            iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            accent="bg-emerald-500"
            delay={0.1}
          />
          <StatCard
            label={t('admin.status.past_due')}
            value={(summary.byStatus.past_due ?? 0).toLocaleString()}
            icon={<AlertTriangle size={20} className="text-amber-500" />}
            iconBg="bg-amber-100 dark:bg-amber-900/30"
            accent="bg-amber-500"
            delay={0.15}
          />
          <StatCard
            label={t('admin.status.canceled')}
            value={(summary.byStatus.canceled ?? 0).toLocaleString()}
            icon={<XCircle size={20} className="text-red-500" />}
            iconBg="bg-red-100 dark:bg-red-900/30"
            accent="bg-red-500"
            delay={0.2}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey={(row) => row._id}
        loading={loading}
        pagination={result?.pagination}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/admin/users/${row._id}`)}
        emptyMessage={t('admin.subscriptions.empty')}
        toolbar={
          <Select
            fullWidth={false}
            className="!py-2 text-sm min-w-[160px]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: t('admin.subscriptions.filters.all') },
              { value: 'active', label: t('admin.status.active') },
              { value: 'past_due', label: t('admin.status.past_due') },
              { value: 'canceled', label: t('admin.status.canceled') },
              { value: 'deleted', label: t('admin.status.deleted') },
            ]}
          />
        }
      />
    </motion.div>
  );
};

export default AdminSubscriptions;
