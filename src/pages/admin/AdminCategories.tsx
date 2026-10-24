import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Pencil, Merge, Trash2, Sparkles } from 'lucide-react';
import DataTable, { DataTableColumn } from '../../components/ui/DataTable';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  AdminCategoryRow,
  deleteAdminCategory,
  fetchAdminCategories,
  mergeAdminCategory,
  updateAdminCategory,
} from '../../services/adminApi';
import { categoryName, forgetCategories } from '../../services/categoriesApi';

/**
 * Admin → Categories (LT-453): the sub-categories sites are placed in. The
 * AI adds one, with its five names, when none fits a new site; here the
 * admin fixes a name or a translation, moves one under another main
 * category, merges a duplicate into the one it repeats (its sites move), or
 * deletes one no site uses.
 */

const LANGS = ['he', 'en', 'ar', 'fr', 'es'] as const;
type Names = AdminCategoryRow['names'];

const AdminCategories: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminCategories>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [main, setMain] = useState('');
  const [onlyAi, setOnlyAi] = useState(false);
  const [editing, setEditing] = useState<{ row: AdminCategoryRow; names: Names; main: string } | null>(null);
  const [merging, setMerging] = useState<{ row: AdminCategoryRow; into: string } | null>(null);
  const [deleting, setDeleting] = useState<AdminCategoryRow | null>(null);
  const [busy, setBusy] = useState(false);

  document.title = t('admin.categories.title');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAdminCategories());
    } catch {
      toast.error(t('admin.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const mainName = useCallback(
    (key: string) => categoryName(data?.mains.find((m) => m.key === key)?.names, i18n.language) || key,
    [data, i18n.language]
  );
  const mainOptions = (data?.mains ?? []).map((m) => ({ value: m.key, label: categoryName(m.names, i18n.language) }));

  const rows = useMemo(
    () => (data?.subs ?? [])
      .filter((row) => (!main || row.main === main) && (!onlyAi || row.source === 'ai'))
      .sort((a, b) => mainName(a.main).localeCompare(mainName(b.main), i18n.language) || categoryName(a.names, i18n.language).localeCompare(categoryName(b.names, i18n.language), i18n.language)),
    [data, main, onlyAi, mainName, i18n.language]
  );

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      forgetCategories();
      toast.success(done);
      setEditing(null);
      setMerging(null);
      setDeleting(null);
      await load();
    } catch {
      toast.error(t('admin.categories.failed'));
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<AdminCategoryRow>[] = [
    {
      key: 'name',
      label: t('admin.categories.columns.name'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-dark-text flex items-center gap-1.5">
            {row.names.he}
            {row.source === 'ai' && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                <Sparkles size={10} aria-hidden="true" />
                {t('admin.categories.fromAi')}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400" dir="ltr">{row.names.en} · {row.key}</p>
        </div>
      ),
    },
    { key: 'main', label: t('admin.categories.columns.main'), render: (row) => mainName(row.main) },
    { key: 'sites', label: t('admin.categories.columns.sites'), render: (row) => row.sites.toLocaleString() },
    {
      key: 'actions',
      label: t('admin.categories.columns.actions'),
      render: (row) => (
        <div className="flex items-center gap-1">
          <button type="button" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" aria-label={t('admin.categories.edit', { name: row.names.he })}
            onClick={() => setEditing({ row, names: { ...row.names }, main: row.main })}>
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button type="button" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800" aria-label={t('admin.categories.merge', { name: row.names.he })}
            onClick={() => setMerging({ row, into: '' })}>
            <Merge size={15} aria-hidden="true" />
          </button>
          <button type="button" className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={t('admin.categories.delete', { name: row.names.he })} disabled={row.sites > 0 || row.key === 'other'}
            title={row.sites > 0 ? t('admin.categories.inUse') : undefined}
            onClick={() => setDeleting(row)}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{t('admin.categories.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.categories.subtitle')}</p>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        loading={loading}
        emptyMessage={t('admin.categories.empty')}
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              aria-label={t('admin.categories.columns.main')}
              fullWidth={false}
              className="!py-2 text-sm min-w-[180px]"
              value={main}
              onChange={(e) => setMain(e.target.value)}
              options={[{ value: '', label: t('admin.categories.allMains') }, ...mainOptions]}
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={onlyAi} onChange={(e) => setOnlyAi(e.target.checked)} />
              {t('admin.categories.onlyAi')}
            </label>
          </div>
        }
      />

      <ConfirmDialog
        open={!!editing}
        title={t('admin.categories.editTitle')}
        confirmLabel={t('admin.categories.save')}
        loading={busy}
        message={editing ? (
          <div className="space-y-3 text-start">
            <Select
              label={t('admin.categories.columns.main')}
              value={editing.main}
              options={mainOptions}
              onChange={(e) => setEditing({ ...editing, main: e.target.value })}
            />
            {LANGS.map((lang) => (
              <Input
                key={lang}
                label={t(`admin.categories.lang.${lang}`)}
                value={editing.names[lang]}
                dir={lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr'}
                maxLength={60}
                onChange={(e) => setEditing({ ...editing, names: { ...editing.names, [lang]: e.target.value } })}
              />
            ))}
          </div>
        ) : null}
        onConfirm={() => editing && LANGS.every((l) => editing.names[l].trim()) && run(
          () => updateAdminCategory(editing.row.key, { names: editing.names, ...(editing.main !== editing.row.main ? { main: editing.main } : {}) }),
          t('admin.categories.saved')
        )}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={!!merging}
        title={t('admin.categories.mergeTitle', { name: merging?.row.names.he ?? '' })}
        confirmLabel={t('admin.categories.mergeConfirm')}
        loading={busy}
        message={merging ? (
          <div className="space-y-3 text-start">
            <p>{t('admin.categories.mergeBody', { count: merging.row.sites })}</p>
            <Select
              label={t('admin.categories.mergeInto')}
              value={merging.into}
              placeholder={t('admin.categories.choose')}
              options={(data?.subs ?? []).filter((s) => s.key !== merging.row.key)
                .map((s) => ({ value: s.key, label: `${s.names.he} (${mainName(s.main)})` }))
                .sort((a, b) => a.label.localeCompare(b.label, i18n.language))}
              onChange={(e) => setMerging({ ...merging, into: e.target.value })}
            />
          </div>
        ) : null}
        onConfirm={() => merging?.into && run(() => mergeAdminCategory(merging.row.key, merging.into), t('admin.categories.merged'))}
        onClose={() => setMerging(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        danger
        title={t('admin.categories.deleteTitle', { name: deleting?.names.he ?? '' })}
        message={t('admin.categories.deleteBody')}
        confirmLabel={t('admin.categories.deleteConfirm')}
        loading={busy}
        onConfirm={() => deleting && run(() => deleteAdminCategory(deleting.key), t('admin.categories.deleted'))}
        onClose={() => setDeleting(null)}
      />
    </motion.div>
  );
};

export default AdminCategories;
