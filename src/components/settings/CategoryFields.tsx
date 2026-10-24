import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Select from '../ui/Select';
import { categoryName, fetchCategories, type CategoryList } from '../../services/categoriesApi';
import type { SiteCategory } from '../../types';

/**
 * LT-453: what the site is - set by the AI when it built the site, changed
 * here. A main category from the fixed list and a sub-category under it (the
 * list the AI also chooses from). The site's keywords are the AI's and stay
 * off this page (Erel). For a directory of sites to come; nothing on the
 * site shows them.
 */

interface CategoryFieldsProps {
  category: SiteCategory | null | undefined;
  onCategoryChange: (category: SiteCategory | null) => void;
}

const CategoryFields: React.FC<CategoryFieldsProps> = ({ category, onCategoryChange }) => {
  const { t, i18n } = useTranslation();
  const [list, setList] = useState<CategoryList | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetchCategories()
      .then((value) => { if (live) setList(value); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  const mainOptions = useMemo(
    () => (list?.mains ?? []).map((m) => ({ value: m.key, label: categoryName(m.names, i18n.language) })),
    [list, i18n.language]
  );
  const subOptions = useMemo(
    () => (list?.subs ?? [])
      .filter((s) => s.main === category?.main)
      .map((s) => ({ value: s.key, label: categoryName(s.names, i18n.language) }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language)),
    [list, category?.main, i18n.language]
  );

  if (failed) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.category.loadFailed')}</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl" data-testid="category-fields">
      <Select
        label={t('settings.category.main')}
        value={category?.main ?? ''}
        placeholder={t('settings.category.choose')}
        options={mainOptions}
        disabled={!list}
        onChange={(e) => onCategoryChange(e.target.value ? { main: e.target.value } : null)}
      />
      <Select
        label={t('settings.category.sub')}
        value={category?.sub ?? ''}
        placeholder={t('settings.category.choose')}
        options={subOptions}
        disabled={!list || !category?.main || subOptions.length === 0}
        onChange={(e) => category?.main && onCategoryChange({ main: category.main, sub: e.target.value || undefined })}
      />
    </div>
  );
};

export default CategoryFields;
