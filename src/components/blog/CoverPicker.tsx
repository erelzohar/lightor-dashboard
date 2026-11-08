import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Images, Loader2, Sparkles, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';
import { uploadImage } from '../../services/imagesApi';
import { aiService } from '../../services/aiApi';
import { isAiBusy } from '../../lib/aiErrors';
import { pictureSrc } from './blogPictures';

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  sitePictures: string[];
  /** What the AI picture starts from: the post's title and line. */
  subject: string;
  /** LT-610: Lighty is still making this draft's main picture. */
  pending?: boolean;
}

const choice = 'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50';

/**
 * LT-610: a post's main picture - one already on the site, an upload, or one
 * made with AI out of the plan's pictures of the month (Pro has 40). A
 * picture made with AI is temporary until the post is saved.
 */
const CoverPicker: React.FC<Props> = ({ value, onChange, sitePictures, subject, pending = false }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState<'site' | 'ai' | null>(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const small = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true, alwaysKeepResolution: true });
      onChange((await uploadImage(small, 'photo')).imageName);
      setOpen(null);
    } catch {
      toast.error(t('blog.editor.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const make = async () => {
    const words = (prompt || subject).trim();
    if (!words) return;
    setBusy(true);
    try {
      onChange(await aiService.createImage(words, '16:9'));
      setOpen(null);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      toast.error(status === 429 && !isAiBusy(error) ? t('blog.editor.coverLimit') : t('blog.editor.coverFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="cover-picker">
      {value ? (
        <div className="relative overflow-hidden rounded-2xl">
          <img src={pictureSrc(value)} alt="" className="aspect-video w-full object-cover" />
          <button type="button" onClick={() => onChange(null)} className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
            <X className="h-3.5 w-3.5" /> {t('blog.editor.coverRemove')}
          </button>
        </div>
      ) : pending ? (
        <div role="status" className="flex aspect-video w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300 bg-violet-50 px-4 text-center text-sm font-medium text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200" data-testid="cover-pending">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> {t('blog.editor.coverPending')}
        </div>
      ) : null}
      <div className={`flex flex-wrap gap-2 ${value || pending ? 'mt-3' : ''}`}>
        <button type="button" disabled={busy || !sitePictures.length} onClick={() => setOpen(open === 'site' ? null : 'site')} className={`${choice} border-gray-200 text-gray-700 dark:border-slate-600 dark:text-slate-200`}>
          <Images className="h-4 w-4" /> {t('blog.editor.coverSite')}
        </button>
        <label className={`${choice} cursor-pointer border-primary/40 text-primary ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          {busy && open !== 'ai' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {t('blog.editor.coverUpload')}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} disabled={busy} />
        </label>
        <button type="button" disabled={busy} onClick={() => { setOpen(open === 'ai' ? null : 'ai'); setPrompt((p) => p || subject); }} className={`${choice} border-violet-300 text-violet-700 dark:border-violet-500/40 dark:text-violet-300`}>
          <Sparkles className="h-4 w-4" /> {t('blog.editor.coverAi')}
        </button>
      </div>
      {open === 'site' && (
        sitePictures.length ? (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6" role="group" aria-label={t('blog.editor.pickPicture')}>
            {sitePictures.map((url) => (
              <button key={url} type="button" onClick={() => { onChange(url); setOpen(null); }} className={`overflow-hidden rounded-lg ring-primary focus:ring-2 ${value === url ? 'ring-2' : ''}`} aria-label={t('blog.editor.pickPicture')}>
                <img src={pictureSrc(url)} alt="" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-gray-500">{t('blog.editor.noSitePictures')}</p>
      )}
      {open === 'ai' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={300}
            aria-label={t('blog.editor.coverAiPrompt')}
            placeholder={t('blog.editor.coverAiPrompt')}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
          <button type="button" onClick={() => void make()} disabled={busy || !(prompt || subject).trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t('blog.editor.coverAiMake')}
          </button>
        </div>
      )}
    </div>
  );
};

export default CoverPicker;
