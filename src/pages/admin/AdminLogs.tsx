import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { ScrollText, Trash2, RefreshCw, Lock, X } from 'lucide-react';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import DataTable, { DataTableColumn } from '../../components/ui/DataTable';
import StatusBadge from '../../components/admin/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  fetchLogFiles,
  fetchLogs,
  clearLogFile,
  LogFileInfo,
  LogEntry,
  LogsPage,
} from '../../services/adminApi';

/**
 * Admin → Logs (LT-153): the API's own winston files, read server-side and
 * filtered by level, text and date. Clearing truncates the live file (winston
 * holds it open) and drops the rotated siblings; the audit trail is read-only.
 */
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const AdminLogs: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [files, setFiles] = useState<LogFileInfo[]>([]);
  const [file, setFile] = useState('combined');
  const [result, setResult] = useState<LogsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selected, setSelected] = useState<LogEntry | null>(null);

  document.title = t('admin.logs.title');

  const loadFiles = useCallback(async () => {
    try {
      setFiles(await fetchLogFiles());
    } catch {
      /* the list is a header detail; the log itself is the page */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await fetchLogs({ file, level: level || undefined, q: search || undefined, page, limit: 100 }));
    } catch {
      toast.error(t('admin.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [file, level, search, page, t]);

  useEffect(() => { loadFiles(); }, [loadFiles]);
  useEffect(() => { load(); }, [load]);

  // Opt-in polling: a log page that reloads itself while you are reading is
  // worse than one you refresh yourself.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { load(); loadFiles(); }, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, load, loadFiles]);

  const active = files.find((f) => f.key === file);

  const doClear = async () => {
    setClearing(true);
    try {
      const res = await clearLogFile(file);
      toast.success(t('admin.logs.cleared', { size: formatBytes(res.freedBytes) }));
      setConfirmClear(false);
      setPage(1);
      await Promise.all([load(), loadFiles()]);
    } catch {
      toast.error(t('admin.errors.actionFailed'));
    } finally {
      setClearing(false);
    }
  };

  const locale = i18n.language === 'he' ? 'he-IL' : 'en-GB';
  const formatStamp = (value: string | null) => {
    if (!value) return '—';
    const iso = /^\d{4}-\d{2}-\d{2} /.test(value) ? value.replace(' ', 'T') : value;
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const columns: DataTableColumn<LogEntry>[] = [
    {
      key: 'timestamp',
      label: t('admin.logs.columns.time'),
      className: 'whitespace-nowrap align-top',
      render: (row) => <span className="text-xs text-gray-500" dir="ltr">{formatStamp(row.timestamp)}</span>,
    },
    {
      key: 'level',
      label: t('admin.logs.columns.level'),
      className: 'align-top',
      render: (row) => <StatusBadge status={row.level} i18nPrefix="admin.logs.levels" />,
    },
    {
      key: 'message',
      label: t('admin.logs.columns.message'),
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm text-gray-800 dark:text-gray-100 break-words">{row.message}</p>
          {Object.keys(row.meta).length > 0 && (
            <p className="text-[11px] text-gray-400 truncate" dir="ltr">{JSON.stringify(row.meta)}</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <ScrollText size={22} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{t('admin.logs.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {active
              ? t('admin.logs.subtitle', {
                  file: active.filename,
                  size: formatBytes(active.size + active.rotatedSize),
                })
              : t('admin.logs.subtitleEmpty')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw size={15} className={autoRefresh ? 'animate-spin' : ''} />}
          onClick={() => setAutoRefresh((v) => !v)}
        >
          {t(autoRefresh ? 'admin.logs.autoRefreshOn' : 'admin.logs.autoRefreshOff')}
        </Button>
        <Button
          variant="danger"
          size="sm"
          leftIcon={active?.clearable === false ? <Lock size={15} /> : <Trash2 size={15} />}
          disabled={!active || !active.clearable || active.size + active.rotatedSize === 0}
          title={active?.clearable === false ? t('admin.logs.notClearable') : undefined}
          onClick={() => setConfirmClear(true)}
        >
          {t('admin.logs.clear')}
        </Button>
      </div>

      {result?.truncated && (
        <div className="glass-card glass-tint-amber rounded-2xl p-3 text-xs text-amber-800 dark:text-amber-300">
          {t('admin.logs.truncated')}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey={(row) => String(row.line)}
        loading={loading}
        pagination={result?.pagination}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        searchPlaceholder={t('admin.logs.searchPlaceholder')}
        emptyMessage={t('admin.logs.empty')}
        onRowClick={setSelected}
        toolbar={
          <>
            <Select
              fullWidth={false}
              className="!py-2 text-sm min-w-[150px]"
              value={file}
              onChange={(e) => { setFile(e.target.value); setPage(1); setLevel(''); }}
              options={files.map((f) => ({
                value: f.key,
                label: `${f.filename} · ${formatBytes(f.size + f.rotatedSize)}`,
              }))}
            />
            <Select
              fullWidth={false}
              className="!py-2 text-sm min-w-[130px]"
              value={level}
              onChange={(e) => { setLevel(e.target.value); setPage(1); }}
              options={[
                { value: '', label: t('admin.logs.allLevels') },
                ...(result?.levels ?? []).map((l) => ({ value: l, label: t(`admin.logs.levels.${l}`, { defaultValue: l }) })),
              ]}
            />
          </>
        }
      />

      <ConfirmDialog
        open={confirmClear}
        danger
        loading={clearing}
        title={t('admin.logs.clearTitle')}
        message={t('admin.logs.clearMessage', {
          file: active?.filename ?? file,
          size: formatBytes((active?.size ?? 0) + (active?.rotatedSize ?? 0)),
        })}
        confirmLabel={t('admin.logs.clear')}
        onConfirm={doClear}
        onClose={() => setConfirmClear(false)}
      />

      {selected &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <div className="relative w-full max-w-2xl glass-modal rounded-2xl p-6 max-h-[80dvh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text">{t('admin.logs.entryTitle')}</h3>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label={t('admin.logs.close')}
                >
                  <X size={18} />
                </button>
              </div>
              <pre
                dir="ltr"
                className="text-xs whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/60 rounded-xl p-4"
              >
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(selected.raw), null, 2);
                  } catch {
                    return selected.raw;
                  }
                })()}
              </pre>
            </div>
          </div>,
          document.body
        )}
    </motion.div>
  );
};

export default AdminLogs;
