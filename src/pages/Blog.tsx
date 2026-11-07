import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, Loader2, Lock, Newspaper, PenLine, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppSelector } from '../hooks/useAppSelector';
import { useConfirm } from '../hooks/useConfirm';
import { canOfferPurchases } from '../lib/platform';
import { siteUrlOf } from '../utils/siteUrl';
import {
  createPost, deletePost, getPost, listPosts, type BlogLimits, type Post, type PostDraft,
} from '../services/postsApi';
import PostEditor from '../components/blog/PostEditor';
import LightyWrites from '../components/blog/LightyWrites';
import { pictureSrc, sitePicturesOf } from '../components/blog/blogPictures';

const dateLocale = (lang: string): string =>
  lang === 'he' ? 'he-IL' : lang === 'ar' ? 'ar-u-nu-latn' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB';

/**
 * LT-610 (the LT-495 plan, Erel 2026-11-07): the blog's page. On Pro: the
 * posts, a new one by Lighty or by hand, and the editor. On any other plan the
 * menu's link is locked and this page says what the blog is, with the way to
 * the plans where the build may sell one (never in the apps); posts kept from
 * Pro are listed and can be deleted, and come back with Pro.
 */
const Blog: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { confirm, dialog } = useConfirm();
  const webConfig = useAppSelector((state) => state.webConfig.data) as unknown as Record<string, unknown> | null;
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [limits, setLimits] = useState<BlogLimits | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<Post | 'new' | null>(null);
  const [writing, setWriting] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const siteUrl = siteUrlOf(typeof webConfig?.subDomain === 'string' ? webConfig.subDomain : null);
  const sitePictures = sitePicturesOf(webConfig);

  const load = useCallback(async () => {
    try {
      const { posts: list, limits: plan } = await listPosts();
      setPosts(list);
      setLimits(plan);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (post: Post) => {
    setOpening(post._id);
    try {
      setEditing(await getPost(post._id));
    } catch {
      toast.error(t('blog.loadFailed'));
    } finally {
      setOpening(null);
    }
  };

  // Lighty's draft is saved at once, so a draft of the month is never lost.
  const drafted = async (draft: PostDraft, left: number) => {
    setWriting(false);
    setLimits((l) => (l ? { ...l, draftsLeft: left } : l));
    try {
      const post = await createPost({ ...draft, cover: draft.cover || null, status: 'draft', byLighty: true });
      setPosts((list) => [post, ...(list ?? [])]);
      setEditing(post);
    } catch {
      toast.error(t('blog.editor.saveFailed'));
    }
  };

  const saved = (post: Post) => {
    setPosts((list) => {
      const rest = (list ?? []).filter((p) => p._id !== post._id);
      return [post, ...rest];
    });
    void listPosts().then(({ limits: plan }) => setLimits(plan)).catch(() => undefined);
  };
  const removed = (id: string) => {
    setPosts((list) => (list ?? []).filter((p) => p._id !== id));
    setEditing(null);
  };

  const removeKept = async (post: Post) => {
    if (!(await confirm({ title: t('blog.editor.delete'), message: t('blog.deleteConfirm'), confirmLabel: t('blog.editor.delete'), danger: true }))) return;
    try {
      await deletePost(post._id);
      removed(post._id);
      toast.success(t('blog.deleted'));
    } catch {
      toast.error(t('blog.editor.saveFailed'));
    }
  };

  const format = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(dateLocale(i18n.language), { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const locked = limits !== null && !limits.blog;
  const published = (posts ?? []).filter((p) => p.status === 'published' && !p.hiddenByAdmin).length;

  const statusOf = (post: Post) => post.hiddenByAdmin
    ? { text: t('blog.status.hidden'), cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' }
    : post.status === 'published'
      ? { text: t('blog.status.published'), cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200' }
      : { text: t('blog.status.draft'), cls: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200' };

  return (
    <div className="mx-auto w-full max-w-5xl p-6 md:p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-3">
            <Newspaper className="h-6 w-6 shrink-0 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t('blog.title')}</h1>
            {locked && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"><Lock className="h-3 w-3" /> {t('blog.pro')}</span>}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('blog.description')}</p>
          {limits?.blog && (
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300" data-testid="blog-drafts-left">{t('blog.draftsLeft', { left: limits.draftsLeft, max: limits.draftsPerMonth })}</p>
          )}
        </div>
        {limits?.blog && (
          <div className="flex flex-wrap items-center gap-2">
            {siteUrl && published > 0 && (
              <a href={`${siteUrl}/blog`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-slate-700 dark:text-slate-200">
                <ExternalLink className="h-4 w-4" /> {t('blog.seeOnSite')}
              </a>
            )}
            <button type="button" data-tour="blog-new" onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary">
              <PenLine className="h-4 w-4" /> {t('blog.iWrite')}
            </button>
            <button type="button" data-tour="blog-lighty" onClick={() => setWriting(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4" /> {t('blog.lightyWrites')}
            </button>
          </div>
        )}
      </div>

      {locked && (
        <div className="mb-8 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 dark:border-amber-500/30 dark:from-amber-500/10 dark:to-transparent" data-testid="blog-locked">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('blog.locked.title')}</h2>
          <p className="mt-1 text-sm text-gray-700 dark:text-slate-300">{t('blog.locked.body')}</p>
          <ul className="mt-4 space-y-2">
            {(['point1', 'point2', 'point3'] as const).map((k) => (
              <li key={k} className="flex items-start gap-2 text-sm text-gray-800 dark:text-slate-200">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {t(`blog.locked.${k}`)}
              </li>
            ))}
          </ul>
          {(posts?.length ?? 0) > 0 && <p className="mt-4 text-sm font-medium text-gray-800 dark:text-slate-200" data-testid="blog-kept">{t('blog.locked.kept', { count: posts!.length })}</p>}
          {/* The app states the fact and sells nothing (LT-130). */}
          {canOfferPurchases() && (
            <Link to="/account" className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white" data-testid="blog-upgrade">
              {t('blog.locked.upgrade')}
            </Link>
          )}
        </div>
      )}

      {failed ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{t('blog.loadFailed')}</p>
      ) : posts === null ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : posts.length === 0 ? (
        !locked && (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 px-6 py-16 text-center dark:border-slate-600" data-tour="blog-posts" data-testid="blog-empty">
            <Newspaper className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="font-medium text-gray-900 dark:text-white">{t('blog.empty.title')}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('blog.empty.body')}</p>
            <button type="button" onClick={() => setWriting(true)} className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4" /> {t('blog.lightyWrites')}
            </button>
          </div>
        )
      ) : (
        <ul className="space-y-3" data-tour="blog-posts" data-testid="blog-posts">
          {posts.map((post) => {
            const status = statusOf(post);
            const row = (
              <>
                {post.cover?.url ? (
                  <img src={pictureSrc(post.cover.url)} alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Newspaper className="h-6 w-6" /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-gray-900 break-words dark:text-white">{post.title || t('blog.untitled')}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${status.cls}`}>{status.text}</span>
                    {post.byLighty && <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Lighty</span>}
                    <span>{post.status === 'published' && post.publishedAt ? t('blog.publishedOn', { date: format(post.publishedAt) }) : t('blog.updatedOn', { date: format(post.updatedAt) })}</span>
                  </span>
                </span>
              </>
            );
            return (
              <li key={post._id} className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/60" data-testid="blog-post-row">
                {locked ? (
                  <div className="flex min-w-0 flex-1 items-center gap-4">{row}</div>
                ) : (
                  <button type="button" onClick={() => void open(post)} className="flex min-w-0 flex-1 items-center gap-4 text-start" aria-label={`${t('blog.editor.title')}: ${post.title}`}>
                    {row}
                    {opening === post._id && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
                  </button>
                )}
                {locked && (
                  <button type="button" onClick={() => void removeKept(post)} aria-label={`${t('blog.editor.delete')}: ${post.title}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null && (
        <PostEditor
          post={editing === 'new' ? null : editing}
          siteUrl={siteUrl}
          config={webConfig}
          sitePictures={sitePictures}
          onClose={() => setEditing(null)}
          onSaved={saved}
          onDeleted={removed}
        />
      )}
      {writing && limits && (
        <LightyWrites draftsLeft={limits.draftsLeft} draftsPerMonth={limits.draftsPerMonth} onDrafted={(d, left) => void drafted(d, left)} onClose={() => setWriting(false)} />
      )}
      {dialog}
    </div>
  );
};

export default Blog;
