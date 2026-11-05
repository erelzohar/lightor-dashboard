import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Check, ChevronDown, Loader2, Pencil, Tags, X } from 'lucide-react';
import { renameCategory, type Product } from '../../services/productsApi';

/** The categories in use, in the order the products have them, each with how many it holds. */
export const categoryCounts = (products: Pick<Product, 'category'>[]): { name: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const p of products) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
};

/**
 * LT-587 (Erel): the site's categories in one place, each renamed once for
 * every product in it. A name another category has joins the two; an empty
 * name takes the category off its products.
 */
const CategoriesPanel: React.FC<{ products: Product[]; onChanged: () => void }> = ({ products, onChanged }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const categories = categoryCounts(products);
  if (!categories.length) return null;

  const start = (category: string) => { setEditing(category); setName(category); };
  const to = name.trim();
  const joins = !!to && to !== editing && categories.some((c) => c.name === to);
  const save = async () => {
    if (editing === null || to === editing) { setEditing(null); return; }
    setSaving(true);
    try {
      const changed = await renameCategory(editing, to);
      toast.success(t(to ? (joins ? 'products.categoriesPanel.joined' : 'products.categoriesPanel.renamed') : 'products.categoriesPanel.cleared', { count: changed, name: to }));
      setEditing(null);
      onChanged();
    } catch {
      toast.error(t('products.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60" data-testid="categories-panel">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-slate-100">
          <Tags className="h-4 w-4 text-primary" aria-hidden="true" />
          {t('products.categoriesPanel.title', { count: categories.length })}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-2 dark:border-slate-700">
          <p className="mb-2 text-xs text-gray-500 dark:text-slate-400">{t('products.categoriesPanel.hint')}</p>
          <ul className="divide-y divide-gray-100 dark:divide-slate-700">
            {categories.map((c) => (
              <li key={c.name} className="flex flex-wrap items-center gap-2 py-2">
                {editing === c.name ? (
                  <>
                    <input
                      autoFocus
                      value={name}
                      maxLength={40}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } if (e.key === 'Escape') setEditing(null); }}
                      aria-label={t('products.categoriesPanel.newName', { name: c.name })}
                      className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <button type="button" onClick={() => void save()} disabled={saving} aria-label={t('common.save')} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-60">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => setEditing(null)} aria-label={t('common.cancel')} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700">
                      <X className="h-4 w-4" />
                    </button>
                    {joins && <p className="w-full text-xs text-amber-700 dark:text-amber-300" data-testid="category-joins">{t('products.categoriesPanel.joins', { name: to })}</p>}
                    {!to && <p className="w-full text-xs text-amber-700 dark:text-amber-300">{t('products.categoriesPanel.clears')}</p>}
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 break-words text-sm text-gray-800 dark:text-slate-100">{c.name}</span>
                    <span className="text-xs tabular-nums text-gray-500 dark:text-slate-400">{t('products.categoriesPanel.count', { count: c.count })}</span>
                    <button type="button" onClick={() => start(c.name)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('products.categoriesPanel.rename')}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default CategoriesPanel;
