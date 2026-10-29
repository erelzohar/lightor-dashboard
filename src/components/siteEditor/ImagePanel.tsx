import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { uploadImage } from '../../services/imagesApi';
import { aiService } from '../../services/aiApi';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases } from '../../lib/platform';
import { resolveImage } from '../../utils/images';
import { fieldLabel } from './labels';
import AddPhotoButton from './AddPhotoButton';
import { pop } from '../ui/pop-button';

interface ImagePanelProps {
  path: string;
  value: string;
  /** The pictures already on the site, to reuse one. */
  siteImages: string[];
  onChange: (imageName: string) => void;
  /** A fresh upload this session (for clean-up if it is never kept). */
  onUploaded: (imageName: string) => void;
  /** Gallery photos can leave the gallery; the hero image and the logo cannot. */
  onRemove?: () => void;
  /** LT-320: on a gallery photo, another photo can join the gallery. */
  onAddPhoto?: (imageName: string) => void;
}

/** LT-249: one picture — upload a new one, reuse one from the site, or take a gallery photo out. */
const ImagePanel: React.FC<ImagePanelProps> = ({ path, value, siteImages, onChange, onUploaded, onRemove, onAddPhoto }) => {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // The logo is contained in a square on the server; every other picture keeps its shape.
  const shape = path === 'logoImageName' ? undefined : 'photo';
  // LT-366: a picture made by AI from the owner's words, kept when the site is saved.
  const aspect = path === 'logoImageName' ? '1:1' : path === 'components.hero.heroImageSrc' ? '16:9' : '4:3';
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<'failed' | 'limit' | null>(null);
  // LT-489: on the free plan the month's AI pictures are the build's; the editor makes none.
  const [aiLocked, setAiLocked] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchMyEntitlements().then((e) => {
      if (alive && e?.limits?.aiImagesInEditor === false) setAiLocked(true);
    });
    return () => { alive = false; };
  }, []);

  const createWithAi = async () => {
    if (aiBusy || aiPrompt.trim().length < 3) return;
    setAiBusy(true);
    setAiError(null);
    setAiResult(null);
    try {
      setAiResult(await aiService.createImage(aiPrompt.trim(), aspect));
    } catch (err) {
      const response = (err as { response?: { status?: number; data?: { code?: string } } })?.response;
      if (response?.data?.code === 'AI_IMAGES_PLUS') setAiLocked(true);
      else setAiError(response?.status === 429 ? 'limit' : 'failed');
    } finally {
      setAiBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      const { imageName } = await uploadImage(file, shape);
      onUploaded(imageName);
      onChange(imageName);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const choices = siteImages.filter((name) => name && name !== value);

  return (
    <div className="flex flex-col gap-4" data-testid="image-panel">
      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{fieldLabel(t, path)}</p>
      {value ? (
        <img src={resolveImage(value)} alt="" className="w-full max-h-48 object-contain rounded-xl bg-gray-100 dark:bg-slate-800" />
      ) : (
        <div className="w-full h-32 rounded-xl bg-gray-100 dark:bg-slate-800" />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${pop()} text-sm font-medium disabled:opacity-60`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {busy ? t('siteEditor.image.uploading') : t('siteEditor.image.replace')}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            {t('siteEditor.image.removeFromGallery')}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" data-testid="image-input" onChange={(e) => void upload(e.target.files?.[0])} />
      {onAddPhoto && <AddPhotoButton onAdded={onAddPhoto} />}
      {/* In the app a locked option is hidden rather than pointing at the plans (LT-130). */}
      {aiLocked ? (
        canOfferPurchases() && (
          <p className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm text-gray-600 dark:text-slate-300" data-testid="ai-image-plus">
            <Wand2 className="w-4 h-4 shrink-0 text-primary" />
            {t('siteEditor.image.aiPlusOnly')}
          </p>
        )
      ) : (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3" data-testid="ai-image">
          {!aiOpen ? (
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              <Wand2 className="w-4 h-4" />
              {t('siteEditor.image.aiOpen')}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300" htmlFor="ai-image-prompt">
                {t('siteEditor.image.aiLabel')}
              </label>
              <textarea
                id="ai-image-prompt"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder={t('siteEditor.image.aiPlaceholder')}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100"
              />
              {aiBusy && (
                <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-primary/30" aria-live="polite">
                  <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[ai-sweep_1.6s_ease-in-out_infinite]" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-primary">
                    <Sparkles className="w-8 h-8 animate-pulse" />
                    <span className="text-xs font-medium">{t('siteEditor.image.aiCreating')}</span>
                  </div>
                </div>
              )}
              {aiResult && !aiBusy && (
                <img src={resolveImage(aiResult)} alt="" className="w-full max-h-48 object-contain rounded-xl bg-gray-100 dark:bg-slate-800" />
              )}
              <div className="flex flex-wrap gap-2">
                {aiResult && !aiBusy && (
                  <button
                    type="button"
                    onClick={() => { onChange(aiResult); setAiResult(null); setAiOpen(false); setAiPrompt(''); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm font-medium"
                  >
                    {t('siteEditor.image.aiUse')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void createWithAi()}
                  disabled={aiBusy || aiPrompt.trim().length < 3}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/40 text-primary text-sm font-medium disabled:opacity-50"
                >
                  {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiBusy ? t('siteEditor.image.aiCreating') : aiResult ? t('siteEditor.image.aiAgain') : t('siteEditor.image.aiCreate')}
                </button>
              </div>
              {aiError && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {t(aiError === 'limit' ? 'siteEditor.image.aiLimit' : 'siteEditor.image.aiFailed')}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.image.aiHint')}</p>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t('siteEditor.image.uploadFailed')}</p>}
      {choices.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{t('siteEditor.image.choose')}</p>
          <div className="grid grid-cols-4 gap-2">
            {choices.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onChange(name)}
                className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary focus:border-primary"
                aria-label={t('siteEditor.image.use')}
              >
                <img src={resolveImage(name)} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagePanel;
