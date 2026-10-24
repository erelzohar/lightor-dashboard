import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import Select from '../ui/Select';
import { categoryName, fetchCategories, type CategoryList } from '../../services/categoriesApi';
import type { SiteCategory } from '../../types';

/**
 * LT-453: what the site is, and its search terms - set by the AI when it
 * built the site, changed here. A main category from the fixed list, a
 * sub-category under it (the list the AI also chooses from), and up to ten
 * keywords. For a directory of sites to come; nothing on the site shows them.
 */

export const KEYWORDS_MAX = 10;
const KEYWORD_MAX_CHARS = 40;

interface CategoryFieldsProps {
  category: SiteCategory | null | undefined;
  keywords: string[] | undefined;
  onCategoryChange: (category: SiteCategory | null) => void;
  onKeywordsChange: (keywords: string[]) => void;
}

const CategoryFields: React.FC<CategoryFieldsProps> = ({ category, keywords = [], onCategoryChange, onKeywordsChange }) => {
  const { t, i18n } = useTranslation();
  const [list, setList] = useState<CategoryList | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState('');

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

  const addKeyword = (raw: string) => {
    const word = raw.replace(/\s+/g, ' ').trim().slice(0, KEYWORD_MAX_CHARS);
    if (!word || keywords.length >= KEYWORDS_MAX) return;
    if (keywords.some((k) => k.toLowerCase() === word.toLowerCase())) return;
    onKeywordsChange([...keywords, word]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(draft);
      setDraft('');
    } else if (e.key === 'Backspace' && !draft && keywords.length) {
      onKeywordsChange(keywords.slice(0, -1));
    }
  };

  if (failed) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.category.loadFailed')}</p>;

  return (
    <div className="space-y-5" data-testid="category-fields">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
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

      <div className="max-w-2xl">
        <label htmlFor="site-keywords" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {t('settings.category.keywords')}
        </label>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30">
          {keywords.map((word) => (
            <span key={word} className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200 ps-3 pe-1 py-1 text-sm">
              {word}
              <button
                type="button"
                onClick={() => onKeywordsChange(keywords.filter((k) => k !== word))}
                aria-label={t('settings.category.removeKeyword', { word })}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-violet-100 dark:hover:bg-violet-800/50"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          {keywords.length < KEYWORDS_MAX && (
            <input
              id="site-keywords"
              value={draft}
              maxLength={KEYWORD_MAX_CHARS}
              onChange={(e) => setDraft(e.target.value.replace(',', ''))}
              onKeyDown={onKeyDown}
              onBlur={() => { if (draft.trim()) { addKeyword(draft); setDraft(''); } }}
              placeholder={keywords.length ? '' : t('settings.category.keywordsPlaceholder')}
              className="flex-1 min-w-[8rem] bg-transparent py-1 text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
            />
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{t('settings.category.keywordsHelp', { max: KEYWORDS_MAX })}</p>
      </div>
    </div>
  );
};

export default CategoryFields;
