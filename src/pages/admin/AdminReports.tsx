import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Check, ExternalLink, RotateCcw } from 'lucide-react';
import DataTable, { DataTableColumn } from '../../components/ui/DataTable';
import Select from '../../components/ui/Select';
import {
  fetchSiteReports,
  updateSiteReport,
  Paginated,
  SiteReportRow,
} from '../../services/adminApi';
import { siteUrlOf } from '../../utils/siteUrl';

type Filter = 'new' | 'handled' | '';

/**
 * The reported page — the visitor's own words, so linked only when it is a
 * Lightor site; else the site's home, when that is a real lightor.app
 * address (LT-315, L2); else nothing.
 */
export const reportLink = (row: Pick<SiteReportRow, 'subDomain' | 'pageUrl'>): string | null => {
  try {
    const url = new URL(row.pageUrl ?? '');
    if (url.protocol === 'https:' && (url.hostname === 'lightor.app' || url.hostname.endsWith('.lightor.app'))) return url.href;
  } catch {
    /* not a URL */
  }
  return siteUrlOf(row.subDomain);
};

/**
 * Admin → Site reports (LT-302): problems visitors reported through Lighty on
 * a business's site. They reach Lightor, never the owner (each one also
 * arrives by email, linking here). Open reports first; marking one handled
 * only files it away.
 */
const AdminReports: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [result, setResult] = useState<(Paginated<SiteReportRow> & { summary: { open: number } }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Filter>('new');
  const [busyId, setBusyId] = useState<string | null>(null);

  document.title = t('admin.reports.title');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await fetchSiteReports({ page, limit: 20, status: status || undefined }));
    } catch {
      toast.error(t('admin.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, status, t]);

  useEffect(() => {
    load();
  }, [load]);

  const setReportStatus = async (row: SiteReportRow, next: 'new' | 'handled') => {
    setBusyId(row._id);
    try {
      await updateSiteReport(row._id, next);
      toast.success(next === 'handled' ? t('admin.reports.markedHandled') : t('admin.reports.reopened'));
      await load();
    } catch {
      toast.error(t('admin.errors.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const columns: DataTableColumn<SiteReportRow>[] = [
    {
      key: 'createdAt',
      label: t('admin.reports.columns.when'),
      className: 'whitespace-nowrap',
      render: (row) => <span className="text-gray-500">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'site',
      label: t('admin.reports.columns.site'),
      render: (row) => {
        const href = reportLink(row);
        return href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-semibold"
          >
            {row.subDomain}
            <ExternalLink size={11} />
          </a>
        ) : (
          <span dir="ltr" className="text-xs text-gray-500">{row.subDomain}</span>
        );
      },
    },
    {
      key: 'message',
      label: t('admin.reports.columns.problem'),
      render: (row) => (
        <div className="min-w-[14rem] max-w-md">
          <p className="text-sm text-gray-900 dark:text-dark-text whitespace-pre-wrap break-words">{row.message}</p>
          {row.contact && (
            <p className="mt-1 text-xs text-gray-500">
              {t('admin.reports.contact')}: <span dir="ltr">{row.contact}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'browser',
      label: t('admin.reports.columns.browser'),
      className: 'hidden md:table-cell',
      render: (row) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {[row.browser, row.language].filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
    {
      key: 'action',
      label: '',
      render: (row) =>
        row.status === 'new' ? (
          <button
            type="button"
            disabled={busyId === row._id}
            onClick={() => setReportStatus(row, 'handled')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 disabled:opacity-50 whitespace-nowrap"
          >
            <Check size={13} />
            {t('admin.reports.markHandled')}
          </button>
        ) : (
          <button
            type="button"
            disabled={busyId === row._id}
            onClick={() => setReportStatus(row, 'new')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
          >
            <RotateCcw size={13} />
            {t('admin.reports.reopen')}
          </button>
        ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text flex items-center gap-2">
          {t('admin.reports.title')}
          {!!result?.summary.open && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {t('admin.reports.open', { count: result.summary.open })}
            </span>
          )}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.reports.subtitle')}</p>
      </div>

      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey={(row) => row._id}
        loading={loading}
        pagination={result?.pagination}
        onPageChange={setPage}
        emptyMessage={status === 'new' ? t('admin.reports.emptyOpen') : t('admin.reports.empty')}
        toolbar={
          <Select
            fullWidth={false}
            className="!py-2 text-sm min-w-[160px]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as Filter);
              setPage(1);
            }}
            options={[
              { value: 'new', label: t('admin.reports.filters.new') },
              { value: 'handled', label: t('admin.reports.filters.handled') },
              { value: '', label: t('admin.reports.filters.all') },
            ]}
          />
        }
      />
    </motion.div>
  );
};

export default AdminReports;
