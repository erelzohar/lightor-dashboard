import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Users, BadgeCheck, Clock } from 'lucide-react';
import DataTable, { DataTableColumn } from '../../components/ui/DataTable';
import Select from '../../components/ui/Select';
import StatusBadge from '../../components/admin/StatusBadge';
import { fetchUsers, AdminUserRow, Paginated } from '../../services/adminApi';

/**
 * Admin → Users (LT-058): every business account, server-paginated and
 * searchable by name / email / subdomain. Row click opens the user detail.
 */
const AdminUsers: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [result, setResult] = useState<Paginated<AdminUserRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [verified, setVerified] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  document.title = t('admin.users.title');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers({
        page,
        limit: 20,
        search: search || undefined,
        subscriptionStatus: subscriptionStatus || undefined,
        verified: (verified || undefined) as 'true' | 'false' | undefined,
        sort,
        order,
      });
      setResult(data);
    } catch {
      toast.error(t('admin.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, search, subscriptionStatus, verified, sort, order, t]);

  useEffect(() => {
    load();
  }, [load]);

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
      sortable: true,
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
      key: 'subDomain',
      label: t('admin.users.columns.site'),
      className: 'hidden md:table-cell',
      render: (row) =>
        row.subDomain ? (
          <a
            href={`https://${row.subDomain}.lightor.app`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline"
            dir="ltr"
          >
            {row.subDomain}
          </a>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">—</span>
        ),
    },
    {
      key: 'plan',
      label: t('admin.users.columns.plan'),
      render: (row) => <StatusBadge status={row.subscription?.status ?? 'free'} />,
    },
    {
      key: 'isVerified',
      label: t('admin.users.columns.verified'),
      className: 'hidden lg:table-cell',
      render: (row) =>
        row.isVerified ? (
          <BadgeCheck size={16} className="text-emerald-500" />
        ) : (
          <Clock size={16} className="text-amber-500" />
        ),
    },
    {
      key: 'boardingStatus',
      label: t('admin.users.columns.boarding'),
      className: 'hidden lg:table-cell',
      render: (row) => <StatusBadge status={row.boardingStatus} i18nPrefix="admin.boarding" />,
    },
    {
      key: 'createdAt',
      label: t('admin.users.columns.created'),
      sortable: true,
      className: 'hidden sm:table-cell',
      render: (row) => <span className="text-gray-500">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'updatedAt',
      label: t('admin.users.columns.lastActivity'),
      sortable: true,
      className: 'hidden xl:table-cell',
      render: (row) => <span className="text-gray-500">{formatDate(row.updatedAt)}</span>,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Users size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
            {t('admin.users.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('admin.users.subtitle', { count: result?.pagination.total ?? 0 })}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey={(row) => row._id}
        loading={loading}
        pagination={result?.pagination}
        onPageChange={setPage}
        sort={sort}
        order={order}
        onSortChange={(nextSort, nextOrder) => {
          setSort(nextSort);
          setOrder(nextOrder);
          setPage(1);
        }}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder={t('admin.users.searchPlaceholder')}
        onRowClick={(row) => navigate(`/admin/users/${row._id}`)}
        toolbar={
          <>
            <Select
              fullWidth={false}
              className="!py-2 text-sm min-w-[150px]"
              value={subscriptionStatus}
              onChange={(e) => {
                setSubscriptionStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: t('admin.users.filters.allPlans') },
                { value: 'active', label: t('admin.status.active') },
                { value: 'free', label: t('admin.status.free') },
                { value: 'past_due', label: t('admin.status.past_due') },
                { value: 'canceled', label: t('admin.status.canceled') },
              ]}
            />
            <Select
              fullWidth={false}
              className="!py-2 text-sm min-w-[150px]"
              value={verified}
              onChange={(e) => {
                setVerified(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: t('admin.users.filters.allVerification') },
                { value: 'true', label: t('admin.users.filters.verified') },
                { value: 'false', label: t('admin.users.filters.unverified') },
              ]}
            />
          </>
        }
      />
    </motion.div>
  );
};

export default AdminUsers;
