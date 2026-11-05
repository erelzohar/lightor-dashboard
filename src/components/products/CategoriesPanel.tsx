import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Tags } from 'lucide-react';
import InlineEdit from '../ui/inline-edit';
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
 * LT-592 (Erel: "doesn't look good"): each category is his inline-edit pill,
 * its number of products small beside the name; one open at a time.
 */
const CategoriesPanel: React.FC<{ products: Product[]; onChanged: () => void }> = ({ products, onChanged }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const categories = categoryCounts(products);
  if (!categories.length) return null;

  const to = draft.trim();
  const joins = editing !== null && !!to && to !== editing && categories.some((c) => c.name === to);
  const save = async (from: string, next: string) => {
    try {
      const changed = await renameCategory(from, next);
      const joined = !!next && categories.some((c) => c.name === next);
      toast.success(t(next ? (joined ? 'products.categoriesPanel.joined' : 'products.categoriesPanel.renamed') : 'products.categoriesPanel.cleared', { count: changed, name: next }));
      setEditing(null);
      onChanged();
      return true;
    } catch {
      toast.error(t('products.saveError'));
      return false;
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60" data-testid="categories-panel">
      <h2 className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-slate-100">
        <Tags className="h-4 w-4 text-primary" aria-hidden="true" />
        {t('products.categoriesPanel.title', { count: categories.length })}
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('products.categoriesPanel.hint')}</p>
      <ul className="mt-3 flex flex-wrap gap-2.5">
        {categories.map((c) => (
          <li key={c.name} className="max-w-full">
            <InlineEdit
              value={c.name}
              maxLength={40}
              label={t('products.categoriesPanel.categoryName')}
              editLabel={t('products.categoriesPanel.renameOne', { name: c.name })}
              saveLabel={t('common.save')}
              suffix={<>
                <span aria-hidden="true">({c.count})</span>
                <span className="sr-only">{t('products.categoriesPanel.count', { count: c.count })}</span>
              </>}
              editing={editing === c.name}
              onEditingChange={(on) => setEditing(on ? c.name : (current) => (current === c.name ? null : current))}
              onDraftChange={setDraft}
              onSave={(next) => save(c.name, next)}
              testId="category-pill"
            />
          </li>
        ))}
      </ul>
      <div aria-live="polite">
        {joins && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300" data-testid="category-joins">{t('products.categoriesPanel.joins', { name: to })}</p>}
        {editing !== null && !to && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300" data-testid="category-clears">{t('products.categoriesPanel.clears')}</p>}
      </div>
    </section>
  );
};

export default CategoriesPanel;
