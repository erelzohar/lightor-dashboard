import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CalendarRange, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Card from '../../components/ui/Card';
import DataTable, { DataTableColumn } from '../../components/ui/DataTable';
import Select from '../../components/ui/Select';
import StatusBadge from '../../components/admin/StatusBadge';
import { useTheme } from '../../contexts/ThemeContext';
import {
  fetchAppointments,
  fetchAppointmentsSeries,
  AdminAppointmentRow,
  AppointmentSeriesPoint,
  Paginated,
} from '../../services/adminApi';

/**
 * Admin → Appointments (LT-058): cross-tenant appointment browsing with a
 * scheduled-volume chart. Reachable pre-filtered from a user detail via
 * ?userId=.
 */
const AdminAppointments: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { darkMode, direction } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const userId = searchParams.get('userId') ?? '';

  const [result, setResult] = useState<Paginated<AdminAppointmentRow> | null>(null);
  const [series, setSeries] = useState<AppointmentSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [range, setRange] = useState<'upcoming' | 'past30' | 'all'>('upcoming');

  document.title = t('admin.appointments.title');

  // 'upcoming' shows what is about to happen — the operator's default
  // question. 'past30' is scheduled time in the last 30 days.
  const rangeToQuery = useCallback((): { from?: string; to?: string; order: 'asc' | 'desc' } => {
    const now = new Date();
    if (range === 'upcoming') {
      return { from: now.toISOString(), order: 'asc' };
    }
    if (range === 'past30') {
      return {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: now.toISOString(),
        order: 'desc',
      };
    }
    return { order: 'desc' };
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to, order } = rangeToQuery();
      const [rows, seriesData] = await Promise.all([
        fetchAppointments({
          page,
          limit: 20,
          userId: userId || undefined,
          status: status || undefined,
          from,
          to,
          sort: 'timestamp',
          order,
        }),
        fetchAppointmentsSeries(
          'day',
          new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          userId || undefined
        ),
      ]);
      setResult(rows);
      setSeries(seriesData);
    } catch {
      toast.error(t('admin.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, status, userId, rangeToQuery, t]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDateTime = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const chartData = series.map((point) => ({
    ...point,
    label: new Date(point.date).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
    }),
  }));

  const columns: DataTableColumn<AdminAppointmentRow>[] = [
    {
      key: 'scheduledAt',
      label: t('admin.appointments.columns.when'),
      render: (row) => (
        <span className="text-gray-800 dark:text-gray-200 font-medium" dir="ltr">
          {formatDateTime(row.scheduledAt)}
        </span>
      ),
    },
    {
      key: 'customer',
      label: t('admin.appointments.columns.customer'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{row.name}</p>
          <p className="text-xs text-gray-400" dir="ltr">
            {row.phone}
          </p>
        </div>
      ),
    },
    {
      key: 'business',
      label: t('admin.appointments.columns.business'),
      className: 'hidden md:table-cell',
      render: (row) => (
        <div className="min-w-0">
          <Link
            to={`/admin/users/${row.user_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-gray-800 dark:text-gray-200 hover:text-primary truncate block"
          >
            {row.businessName || row.ownerName || '—'}
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
      key: 'typeName',
      label: t('admin.appointments.columns.service'),
      className: 'hidden lg:table-cell',
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.typeName ?? '—'}
          {row.typePrice ? (
            <span className="text-gray-400 text-xs ms-1" dir="ltr">
              ₪{row.typePrice}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('admin.appointments.columns.status'),
      render: (row) => <StatusBadge status={row.status} i18nPrefix="admin.appointmentStatus" />,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <CalendarRange size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
            {t('admin.appointments.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('admin.appointments.subtitle', { count: result?.pagination.total ?? 0 })}
          </p>
        </div>
      </div>

      {userId && (
        <button
          onClick={() => {
            searchParams.delete('userId');
            setSearchParams(searchParams);
            setPage(1);
          }}
          className="inline-flex items-center gap-1.5 mb-4 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          {t('admin.appointments.filteredByBusiness')}
          <X size={12} />
        </button>
      )}

      <Card animate={false} className="mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">
          {t('admin.appointments.volumeChart')}
        </h3>
        <div className="h-52">
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
                interval={2}
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
                formatter={(value: number, name: string) => [
                  value,
                  name === 'scheduled'
                    ? t('admin.appointments.scheduledSeries')
                    : t('admin.appointments.cancelledSeries'),
                ]}
              />
              <Legend
                formatter={(value) =>
                  value === 'scheduled'
                    ? t('admin.appointments.scheduledSeries')
                    : t('admin.appointments.cancelledSeries')
                }
                wrapperStyle={{ paddingTop: '8px', fontSize: '0.85rem' }}
              />
              <Bar dataKey="scheduled" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="cancelled" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey={(row) => row._id}
        loading={loading}
        pagination={result?.pagination}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/admin/users/${row.user_id}`)}
        emptyMessage={t('admin.appointments.empty')}
        toolbar={
          <>
            <Select
              fullWidth={false}
              className="!py-2 text-sm min-w-[150px]"
              value={range}
              onChange={(e) => {
                setRange(e.target.value as 'upcoming' | 'past30' | 'all');
                setPage(1);
              }}
              options={[
                { value: 'upcoming', label: t('admin.appointments.ranges.upcoming') },
                { value: 'past30', label: t('admin.appointments.ranges.past30') },
                { value: 'all', label: t('admin.appointments.ranges.all') },
              ]}
            />
            <Select
              fullWidth={false}
              className="!py-2 text-sm min-w-[150px]"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: t('admin.appointments.filters.allStatuses') },
                { value: 'scheduled', label: t('admin.appointmentStatus.scheduled') },
                { value: 'completed', label: t('admin.appointmentStatus.completed') },
                { value: 'cancelled', label: t('admin.appointmentStatus.cancelled') },
              ]}
            />
          </>
        }
      />
    </motion.div>
  );
};

export default AdminAppointments;
