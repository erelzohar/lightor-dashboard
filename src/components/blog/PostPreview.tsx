import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { siteUrlOf } from '../../utils/siteUrl';
import type { PostBlock } from '../../services/postsApi';

const CLIENT_APP_URL = (import.meta.env.VITE_CLIENT_APP_URL as string | undefined) || 'http://localhost:5174';
/** An older site build never says LT_READY; after this long the preview talks anyway. */
const READY_FALLBACK_MS = 4000;

export interface PreviewPost {
  _id?: string;
  slug?: string;
  title: string;
  summary?: string;
  category?: string;
  cover?: string | null;
  body: PostBlock[];
  publishedAt?: string | null;
}

const minutesOf = (post: PreviewPost): number => {
  const words = [post.title, post.summary, ...post.body.flatMap((b) => [b.text, ...(b.items ?? []), b.caption])]
    .filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

/** What the site's post page draws a draft from (lightor-front App: `previewPost` in PREVIEW_DATA). */
export const previewPostOf = (post: PreviewPost, now = new Date()): Record<string, unknown> => ({
  id: post._id || 'preview',
  slug: post.slug || 'preview',
  title: post.title || '...',
  ...(post.summary ? { summary: post.summary } : {}),
  ...(post.category ? { category: post.category } : {}),
  ...(post.cover ? { cover: post.cover } : {}),
  publishedAt: post.publishedAt || now.toISOString(),
  updatedAt: now.toISOString(),
  minutes: minutesOf(post),
  body: post.body,
});

/**
 * LT-610: the post as the site will show it, before it is published: the
 * site itself in a frame, given the site's config and the draft (as the site
 * editor gives it the page's draft). Visitors never see it.
 */
const PostPreview: React.FC<{ post: PreviewPost; config: Record<string, unknown> | null; onClose: () => void }> = ({ post, config, onClose }) => {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useDialogFocus(true, box, onClose);
  const live = siteUrlOf(typeof config?.subDomain === 'string' ? config.subDomain : null);
  const base = import.meta.env.PROD && live ? live : CLIENT_APP_URL;
  const origin = new URL(base).origin;
  const slug = post.slug || 'preview';

  useEffect(() => {
    if (!config) return;
    const send = () => frame.current?.contentWindow?.postMessage({ type: 'PREVIEW_DATA', config: { ...config, previewPost: previewPostOf(post) } }, origin);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      if ((event.data as { type?: string } | null)?.type === 'LT_READY') send();
    };
    window.addEventListener('message', onMessage);
    const fallback = window.setTimeout(send, READY_FALLBACK_MS);
    return () => { window.removeEventListener('message', onMessage); window.clearTimeout(fallback); };
  }, [config, post, origin]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-0 sm:p-6" role="presentation" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={t('blog.preview.title')}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:bg-slate-900 sm:h-[90vh] sm:rounded-2xl sm:pb-0"
        data-testid="post-preview"
      >
        {/* LT-636: on a phone the preview is the whole screen; its bar starts under the status bar. */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-slate-700 sm:pt-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white">{t('blog.preview.title')}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{t('blog.preview.note')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('blog.editor.close')} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <iframe ref={frame} src={`${base}/blog/${encodeURIComponent(slug)}`} title={t('blog.preview.title')} className="w-full flex-1 border-0" />
      </div>
    </div>
  );
};

export default PostPreview;
