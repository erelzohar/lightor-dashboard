import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import { setAt } from '../../utils/editorPaths';
import { BLOG_PAGE_LAYOUTS, POST_PAGE_LAYOUTS, optionLabel } from '../../utils/editorOptions';
import { blogLooksOf } from '../../utils/blogLooks';
import { vocabLang } from './labels';
import DesignChoices from './DesignChoices';

/**
 * LT-610 (Erel's blog pastes): the blog's own pages in the editor - the
 * blog's page in one of three looks, a post's page in one of two - shown when
 * the preview is on one of them, as the products' pages are (LT-545).
 */

interface PanelProps<T> {
  config: T;
  onUpdate: (next: T | ((prev: T) => T), mergeKey?: string) => void;
}

const label = 'mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300';

const designOf = (config: unknown): Record<string, unknown> =>
  ((config as { design?: Record<string, unknown> } | null)?.design ?? {});

/** The posts the preview can open: the newest the site shows. */
export const previewPostsOf = (config: unknown): { slug: string; title: string }[] =>
  (((config as { blog?: { latest?: unknown[] } } | null)?.blog?.latest ?? []) as unknown[]).flatMap((p) => {
    const r = p as Record<string, unknown> | null;
    return r && typeof r.slug === 'string' && typeof r.title === 'string' ? [{ slug: r.slug, title: r.title }] : [];
  });

const ManagePosts: React.FC = () => {
  const { t } = useTranslation();
  const { guardLinkClick } = useLeaveGuard();
  return (
    <Link
      to="/blog"
      onClick={(e) => guardLinkClick(e, '/blog')}
      data-testid="manage-posts"
      className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
    >
      <Newspaper className="h-4 w-4" aria-hidden="true" />
      {t('siteEditor.pages.managePosts')}
    </Link>
  );
};

export function BlogPagePanel<T>({ config, onUpdate }: PanelProps<T>) {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  return (
    <div className="flex flex-col gap-5" data-testid="blog-page-panel">
      <div>
        <p className={label}>{t('siteEditor.pages.blogLayout')}</p>
        <DesignChoices
          name={t('siteEditor.pages.blogLayout')}
          group="blogPage"
          values={Object.keys(BLOG_PAGE_LAYOUTS)}
          current={blogLooksOf(designOf(config)).page}
          labelOf={(value) => optionLabel(BLOG_PAGE_LAYOUTS, value, lang)}
          onPick={(value) => onUpdate((prev) => setAt(prev, 'design.blogLayout', value))}
          language={i18n.language || 'he'}
          testId="blog-page-choices"
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.pages.blogHint')}</p>
      </div>
      <ManagePosts />
    </div>
  );
}

export function PostPagePanel<T>({ config, onUpdate }: PanelProps<T>) {
  const { t, i18n } = useTranslation();
  const lang = vocabLang(i18n.language);
  return (
    <div className="flex flex-col gap-5" data-testid="post-page-panel">
      <div>
        <p className={label}>{t('siteEditor.pages.postLayout')}</p>
        <DesignChoices
          name={t('siteEditor.pages.postLayout')}
          group="postPage"
          values={Object.keys(POST_PAGE_LAYOUTS)}
          current={blogLooksOf(designOf(config)).post}
          labelOf={(value) => optionLabel(POST_PAGE_LAYOUTS, value, lang)}
          onPick={(value) => onUpdate((prev) => setAt(prev, 'design.postLayout', value))}
          language={i18n.language || 'he'}
          testId="post-page-choices"
        />
      </div>
      <ManagePosts />
    </div>
  );
}
