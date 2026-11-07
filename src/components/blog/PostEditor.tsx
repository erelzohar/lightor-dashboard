import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, ExternalLink, Loader2, MessageCircle, Sparkles, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useConfirm } from '../../hooks/useConfirm';
import { createPost, deletePost, updatePost, type Post, type PostBlock, type PostInput } from '../../services/postsApi';
import BlocksEditor from './BlocksEditor';
import CoverPicker from './CoverPicker';
import PostPreview from './PostPreview';

interface Props {
  /** null: a new post the owner writes; a post (Lighty's draft is saved before it opens). */
  post: Post | null;
  siteUrl: string | null;
  config: Record<string, unknown> | null;
  sitePictures: string[];
  onClose: () => void;
  onSaved: (post: Post) => void;
  onDeleted: (id: string) => void;
}

const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const label = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300';

const errorCode = (error: unknown): string | undefined =>
  (error as { response?: { data?: { code?: string } } })?.response?.data?.code;

/** What a save sends: the empty blocks left out, as the server would drop them anyway. */
const bodyOf = (blocks: PostBlock[]): PostBlock[] =>
  blocks.filter((b) => (b.kind === 'ul' || b.kind === 'ol' ? (b.items ?? []).some((i) => i.trim()) : b.kind === 'image' ? !!b.url : !!b.text?.trim()))
    .map((b) => (b.kind === 'ul' || b.kind === 'ol' ? { ...b, items: (b.items ?? []).filter((i) => i.trim()) } : b));

/**
 * LT-610: one post, full screen (it is long, and it is written on phones):
 * its title, line and topic, its main picture, its blocks; saved as a draft,
 * published, taken off the site or deleted; seen in the site's own look
 * before it goes up.
 */
const PostEditor: React.FC<Props> = ({ post, siteUrl, config, sitePictures, onClose, onSaved, onDeleted }) => {
  const { t } = useTranslation();
  const { confirm, dialog } = useConfirm();
  const box = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<Post | null>(post);
  const [title, setTitle] = useState(post?.title ?? '');
  const [summary, setSummary] = useState(post?.summary ?? '');
  const [category, setCategory] = useState(post?.category ?? '');
  const [cover, setCover] = useState<string | null>(post?.cover?.url ?? null);
  const [blocks, setBlocks] = useState<PostBlock[]>(post?.body?.length ? post.body : [{ kind: 'p', text: '' }]);
  const [busy, setBusy] = useState<'save' | 'publish' | 'unpublish' | 'delete' | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const current = useMemo(() => JSON.stringify({ title, summary, category, cover, body: bodyOf(blocks) }), [title, summary, category, cover, blocks]);
  const [clean, setClean] = useState(current);
  const dirty = current !== clean;

  const close = async () => {
    if (dirty && !(await confirm({ title: t('blog.editor.close'), message: t('blog.editor.leave'), confirmLabel: t('blog.editor.close'), danger: true }))) return;
    onClose();
  };
  useDialogFocus(true, box, () => { void close(); });

  const out = saved?.status === 'published';
  const liveUrl = siteUrl && saved?.slug && out ? `${siteUrl}/blog/${saved.slug}` : null;

  const save = async (status: 'draft' | 'published', kind: 'save' | 'publish' | 'unpublish') => {
    if (!title.trim()) { toast.error(t('blog.editor.needsTitle')); return; }
    const body = bodyOf(blocks);
    if (status === 'published' && !body.some((b) => b.kind === 'p')) { toast.error(t('blog.editor.needsBody')); return; }
    setBusy(kind);
    const input: PostInput = { title: title.trim(), summary: summary.trim(), category: category.trim(), cover, body, status };
    try {
      const next = saved ? await updatePost(saved._id, input) : await createPost({ ...input, title: title.trim() });
      setSaved(next);
      setClean(JSON.stringify({ title, summary, category, cover: next.cover?.url ?? null, body }));
      if (next.cover?.url !== cover) setCover(next.cover?.url ?? null);
      onSaved(next);
      toast.success(kind === 'publish' ? t('blog.editor.publishedToast') : kind === 'unpublish' ? t('blog.editor.unpublishedToast') : t('blog.editor.saved'));
    } catch (error) {
      toast.error(errorCode(error) === 'POST_PUBLISH_CAP' ? t('blog.editor.publishCap') : t('blog.editor.saveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!saved) { onClose(); return; }
    if (!(await confirm({ title: t('blog.editor.delete'), message: t('blog.deleteConfirm'), confirmLabel: t('blog.editor.delete'), danger: true }))) return;
    setBusy('delete');
    try {
      await deletePost(saved._id);
      onDeleted(saved._id);
      toast.success(t('blog.deleted'));
    } catch {
      toast.error(t('blog.editor.saveFailed'));
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:p-6" role="presentation">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-editor-title"
        tabIndex={-1}
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
        data-testid="post-editor"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-slate-700">
          <h2 id="post-editor-title" className="min-w-0 break-words font-semibold text-gray-900 dark:text-white">
            {title.trim() || t('blog.untitled')}
          </h2>
          <button type="button" onClick={() => void close()} aria-label={t('blog.editor.close')} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
          {saved?.byLighty && (
            <p className="flex items-start gap-2 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:bg-violet-500/10 dark:text-violet-200" data-testid="post-by-lighty">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t('blog.editor.byLighty')}
            </p>
          )}
          {saved?.hiddenByAdmin && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{t('blog.hiddenNote')}</p>}
          <div>
            <label htmlFor="post-title" className={label}>{t('blog.editor.title')}</label>
            <input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t('blog.editor.titlePlaceholder')} className={`${field} text-lg font-bold`} />
          </div>
          <div>
            <label htmlFor="post-summary" className={label}>{t('blog.editor.summary')}</label>
            <textarea id="post-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={200} rows={2} className={`${field} resize-y`} aria-describedby="post-summary-hint" />
            <p id="post-summary-hint" className="mt-1 flex justify-between gap-2 text-xs text-gray-500 dark:text-slate-400">
              <span>{t('blog.editor.summaryHint')}</span><span className="tabular-nums">{summary.length}/200</span>
            </p>
          </div>
          <div>
            <label htmlFor="post-category" className={label}>{t('blog.editor.category')}</label>
            <input id="post-category" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={30} className={field} aria-describedby="post-category-hint" />
            <p id="post-category-hint" className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('blog.editor.categoryHint')}</p>
          </div>
          <div>
            <p className={label}>{t('blog.editor.cover')}</p>
            <CoverPicker value={cover} onChange={setCover} sitePictures={sitePictures} subject={[title, summary].filter(Boolean).join('. ')} />
          </div>
          <div>
            <p className={label}>{t('blog.editor.body')}</p>
            <BlocksEditor blocks={blocks} onChange={setBlocks} sitePictures={sitePictures} />
          </div>
          {liveUrl && (
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-slate-700" data-testid="post-address">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('blog.editor.address')}</p>
              <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 break-all text-sm text-primary" dir="ltr">
                {liveUrl} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('blog.editor.addressNote')}</p>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${saved?.title ?? ''} ${liveUrl}`)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300">
                <MessageCircle className="h-4 w-4" /> {t('blog.editor.share')}
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-3 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPreviewing(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-slate-600 dark:text-slate-200" data-testid="post-preview-open">
              <Eye className="h-4 w-4" /> {t('blog.editor.preview')}
            </button>
            {saved && (
              <button type="button" onClick={() => void remove()} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-500/10">
                {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {t('blog.editor.delete')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {out ? (
              <>
                <button type="button" onClick={() => void save('draft', 'unpublish')} disabled={!!busy} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200">
                  {busy === 'unpublish' ? <Loader2 className="h-4 w-4 animate-spin" /> : t('blog.editor.unpublish')}
                </button>
                <button type="button" onClick={() => void save('published', 'save')} disabled={!!busy} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" data-testid="post-update">
                  {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : t('blog.editor.update')}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => void save('draft', 'save')} disabled={!!busy} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200" data-testid="post-save-draft">
                  {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : t('blog.editor.saveDraft')}
                </button>
                <button type="button" onClick={() => void save('published', 'publish')} disabled={!!busy} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" data-testid="post-publish">
                  {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : t('blog.editor.publish')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {previewing && (
        <PostPreview
          post={{ _id: saved?._id, slug: saved?.slug, title, summary, category, cover, body: bodyOf(blocks), publishedAt: saved?.publishedAt }}
          config={config}
          onClose={() => setPreviewing(false)}
        />
      )}
      {dialog}
    </div>
  );
};

export default PostEditor;
