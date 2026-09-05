import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { UsersRound, UserPlus, Download, Ban, Repeat, Sparkles } from 'lucide-react';
import DataTable, { DataTableColumn } from '../components/ui/DataTable';
import StatCard from '../components/ui/StatCard';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/admin/StatusBadge';
import TopCustomers from '../components/customers/TopCustomers';
import CustomerDetailDrawer from '../components/customers/CustomerDetailDrawer';
import AddCustomerModal from '../components/customers/AddCustomerModal';
import {
  fetchCustomers,
  fetchCustomerStats,
  exportCustomersCsv,
  CustomerRow,
  CustomersOverview,
  CustomerSort,
} from '../services/customersApi';
import { Paginated } from '../services/adminApi';
import { formatPhoneForDisplay } from '../utils/phone';

/**
 * Customers (LT-122): every person who has booked with this business, keyed
 * by phone number — searchable, sortable, blockable — plus who comes back
 * most. Server-paginated like the admin tables; a row opens the drawer.
 */
const Customers: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [result, setResult] = useState<Paginated<CustomerRow> | null>(null);
  const [overview, setOverview] = useState<CustomersOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [blocked, setBlocked] = useState<'' | 'true' | 'false'>('');
  const [sort, setSort] = useState<CustomerSort>('lastSeenAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);

  document.title = t('customers.title');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomers({
        page,
        limit: 20,
        search: search || undefined,
        blocked: blocked || undefined,
        sort,
        order,
      });
      setResult(data);
    } catch {
      toast.error(t('customers.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, search, blocked, sort, order, t]);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await fetchCustomerStats(5));
    } catch {
      /* the list is the page; the overview is decoration */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const refreshAll = useCallback(() => {
    load();
    loadOverview();
  }, [load, loadOverview]);

  const locale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';
  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportCustomersCsv({ search: search || undefined, blocked: blocked || undefined });
    } catch {
      toast.error(t('customers.export.failed'));
    } finally {
      setExporting(false);
    }
  };

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      key: 'name',
      label: t('customers.columns.name'),
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-dark-text truncate">{row.name}</p>
          <p className="text-xs text-gray-400 truncate" dir="ltr">
            {formatPhoneForDisplay(row.phone)}
          </p>
        </div>
      ),
    },
    {
      key: 'visits',
      label: t('customers.columns.visits'),
      sortable: true,
      render: (row) => (
        <span className="font-medium text-gray-800 dark:text-gray-100">
          {row.visits}
          {row.upcoming > 0 && (
            <span className="ms-1.5 text-[11px] text-primary">+{row.upcoming}</span>
          )}
        </span>
      ),
    },
    {
      key: 'lastVisit',
      label: t('customers.columns.lastVisit'),
      sortable: true,
      className: 'hidden sm:table-cell',
      render: (row) => <span className="text-gray-500">{formatDate(row.lastVisit)}</span>,
    },
    {
      key: 'revenue',
      label: t('customers.columns.revenue'),
      className: 'hidden lg:table-cell',
      render: (row) => (
        <span className="text-gray-500">
          {t('appointments.currencySymbol')}{Math.round(row.revenue).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('customers.columns.status'),
      render: (row) => <StatusBadge status={row.isBlocked ? 'blocked' : 'active'} i18nPrefix="customers.status" />,
    },
  ];

  const totals = overview?.totals;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <UsersRound size={22} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{t('customers.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('customers.subtitle', { count: result?.pagination.total ?? 0 })}
          </p>
        </div>
        <Button variant="outline" size="sm" leftIcon={<Download size={15} />} onClick={handleExport} isLoading={exporting}>
          {t('customers.export.button')}
        </Button>
        <Button variant="primary" size="sm" leftIcon={<UserPlus size={15} />} onClick={() => setAdding(true)}>
          {t('customers.add.title')}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={t('customers.stats.total')} value={totals?.customers ?? '—'} icon={<UsersRound size={20} />} />
        <StatCard
          label={t('customers.stats.newThisMonth')}
          value={totals?.newThisMonth ?? '—'}
          icon={<Sparkles size={20} />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          accent="text-emerald-600 dark:text-emerald-400"
          delay={0.05}
        />
        <StatCard
          label={t('customers.stats.returning')}
          value={totals?.returning ?? '—'}
          subline={t('customers.stats.returningHint')}
          icon={<Repeat size={20} />}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          accent="text-blue-600 dark:text-blue-400"
          delay={0.1}
        />
        <StatCard
          label={t('customers.stats.blocked')}
          value={totals?.blocked ?? '—'}
          icon={<Ban size={20} />}
          iconBg="bg-red-100 dark:bg-red-900/30"
          accent="text-red-600 dark:text-red-400"
          delay={0.15}
        />
      </div>

      <TopCustomers
        byVisits={overview?.top.byVisits ?? []}
        byRevenue={overview?.top.byRevenue ?? []}
        onSelect={setSelectedId}
      />

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
          setSort(nextSort as CustomerSort);
          setOrder(nextOrder);
          setPage(1);
        }}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder={t('customers.search')}
        emptyMessage={t('customers.empty')}
        onRowClick={(row) => setSelectedId(row._id)}
        toolbar={
          <Select
            fullWidth={false}
            className="!py-2 text-sm min-w-[150px]"
            value={blocked}
            onChange={(e) => {
              setBlocked(e.target.value as '' | 'true' | 'false');
              setPage(1);
            }}
            options={[
              { value: '', label: t('customers.filter.all') },
              { value: 'false', label: t('customers.filter.active') },
              { value: 'true', label: t('customers.filter.blocked') },
            ]}
          />
        }
      />

      <CustomerDetailDrawer customerId={selectedId} onClose={() => setSelectedId(null)} onChanged={refreshAll} />
      <AddCustomerModal
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(id) => {
          refreshAll();
          setSelectedId(id);
        }}
        onExists={(id) => setSelectedId(id)}
      />
    </motion.div>
  );
};

export default Customers;
