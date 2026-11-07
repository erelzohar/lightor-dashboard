import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Heading2, Heading3, ImagePlus, List, ListOrdered, Loader2, Pilcrow, Plus, Quote, Trash2, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';
import { uploadImage } from '../../services/imagesApi';
import type { PostBlock, PostBlockKind } from '../../services/postsApi';
import { pictureSrc } from './blogPictures';

/**
 * LT-610 (the LT-495 plan): a post's body as blocks - a heading, a paragraph,
 * a list, a quote, a picture with its caption - each one a plain text box, so
 * it writes as easily on a phone (and in the apps) as on a computer. Blocks
 * move with the arrows beside them (dnd-kit eats taps right after a drag).
 */

export const KIND_ICON: Record<PostBlockKind, typeof Pilcrow> = {
  p: Pilcrow, h2: Heading2, h3: Heading3, ul: List, ol: ListOrdered, quote: Quote, image: ImagePlus,
};
export const KINDS: PostBlockKind[] = ['p', 'h2', 'h3', 'ul', 'ol', 'quote', 'image'];

const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const iconButton = 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white';

/** A text box that grows with its text. */
const GrowingText: React.FC<{ value: string; onChange: (v: string) => void; label: string; big?: boolean }> = ({ value, onChange, label, big }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    aria-label={label}
    rows={Math.max(big ? 3 : 2, Math.min(14, value.split('\n').length + Math.ceil(value.length / 70)))}
    className={`${field} resize-y leading-relaxed`}
  />
);

export const emptyBlock = (kind: PostBlockKind): PostBlock =>
  kind === 'ul' || kind === 'ol' ? { kind, items: [''] } : kind === 'image' ? { kind, url: '' } : { kind, text: '' };

interface Props {
  blocks: PostBlock[];
  onChange: (blocks: PostBlock[]) => void;
  sitePictures: string[];
}

const BlocksEditor: React.FC<Props> = ({ blocks, onChange, sitePictures }) => {
  const { t } = useTranslation();
  const [picking, setPicking] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const set = (i: number, next: PostBlock) => onChange(blocks.map((b, j) => (j === i ? next : b)));
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(blocks.filter((_, j) => j !== i));
  const add = (kind: PostBlockKind) => onChange([...blocks, emptyBlock(kind)]);

  const upload = async (i: number, file: File | undefined) => {
    if (!file) return;
    setUploading(i);
    try {
      const small = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true, alwaysKeepResolution: true });
      const { imageName } = await uploadImage(small, 'photo');
      set(i, { ...blocks[i], url: imageName });
    } catch {
      toast.error(t('blog.editor.saveFailed'));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-3" data-testid="blocks-editor">
      {blocks.map((block, i) => {
        const Icon = KIND_ICON[block.kind];
        const name = t(`blog.editor.kinds.${block.kind}`);
        return (
          <div key={i} className="rounded-2xl border border-gray-200 bg-gray-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40" data-testid="post-block" data-kind={block.kind}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {name}
              </span>
              <span className="flex items-center gap-0.5">
                <button type="button" className={iconButton} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${t('blog.editor.up')}: ${name}`}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className={iconButton} onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label={`${t('blog.editor.down')}: ${name}`}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" className={iconButton} onClick={() => remove(i)} aria-label={`${t('blog.editor.remove')}: ${name}`}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
            {block.kind === 'h2' || block.kind === 'h3' ? (
              <input
                value={block.text ?? ''}
                onChange={(e) => set(i, { ...block, text: e.target.value })}
                aria-label={name}
                maxLength={160}
                className={`${field} ${block.kind === 'h2' ? 'text-lg font-bold' : 'font-semibold'}`}
              />
            ) : block.kind === 'ul' || block.kind === 'ol' ? (
              <div className="space-y-2">
                {(block.items ?? []).map((item, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center text-sm text-gray-400" aria-hidden="true">{block.kind === 'ol' ? `${k + 1}.` : '•'}</span>
                    <input
                      value={item}
                      onChange={(e) => set(i, { ...block, items: (block.items ?? []).map((x, m) => (m === k ? e.target.value : x)) })}
                      aria-label={t('blog.editor.item', { n: k + 1 })}
                      maxLength={400}
                      className={field}
                    />
                    <button type="button" className={iconButton} onClick={() => set(i, { ...block, items: (block.items ?? []).filter((_, m) => m !== k) })} aria-label={t('blog.editor.removeItem')} disabled={(block.items ?? []).length <= 1}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {(block.items ?? []).length < 20 && (
                  <button type="button" onClick={() => set(i, { ...block, items: [...(block.items ?? []), ''] })} className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    <Plus className="h-4 w-4" /> {t('blog.editor.addItem')}
                  </button>
                )}
              </div>
            ) : block.kind === 'image' ? (
              <div className="space-y-2">
                {block.url ? (
                  <img src={pictureSrc(block.url)} alt="" className="max-h-64 w-full rounded-xl object-cover" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-primary/40 px-3 py-2 text-sm font-medium text-primary">
                      {uploading === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {t('blog.editor.coverUpload')}
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(i, e.target.files?.[0])} />
                    </label>
                    {sitePictures.length > 0 && (
                      <button type="button" onClick={() => setPicking(picking === i ? null : i)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 dark:border-slate-600 dark:text-slate-200">
                        {t('blog.editor.coverSite')}
                      </button>
                    )}
                  </div>
                )}
                {picking === i && (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="group" aria-label={t('blog.editor.pickPicture')}>
                    {sitePictures.map((url) => (
                      <button key={url} type="button" onClick={() => { set(i, { ...block, url }); setPicking(null); }} className="overflow-hidden rounded-lg ring-primary focus:ring-2" aria-label={t('blog.editor.pickPicture')}>
                        <img src={pictureSrc(url)} alt="" className="aspect-square w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {block.url && (
                  <div className="flex items-center gap-2">
                    <input
                      value={block.caption ?? ''}
                      onChange={(e) => set(i, { ...block, caption: e.target.value })}
                      placeholder={t('blog.editor.caption')}
                      aria-label={t('blog.editor.caption')}
                      maxLength={200}
                      className={field}
                    />
                    <button type="button" className={iconButton} onClick={() => set(i, { kind: 'image', url: '' })} aria-label={t('blog.editor.coverRemove')}><X className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            ) : (
              <GrowingText value={block.text ?? ''} onChange={(text) => set(i, { ...block, text })} label={name} big={block.kind === 'p'} />
            )}
          </div>
        );
      })}

      <div className="rounded-2xl border border-dashed border-gray-300 p-3 dark:border-slate-600">
        <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-slate-400">{t('blog.editor.add')}</p>
        <div className="flex flex-wrap gap-2" data-testid="add-block">
          {KINDS.map((kind) => {
            const Icon = KIND_ICON[kind];
            return (
              <button key={kind} type="button" onClick={() => add(kind)} disabled={blocks.length >= 80} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-primary disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(`blog.editor.kinds.${kind}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BlocksEditor;
