import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { aiService } from '../../services/aiApi';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases } from '../../lib/platform';
import { resolveImage } from '../../utils/images';
import { Diff, DiffItem1, DiffItem2, DiffResizer } from '../ui/diff';

export type AiAspect = '16:9' | '4:3' | '1:1';

const ASPECT_CLASS: Record<AiAspect, string> = { '16:9': 'aspect-video', '4:3': 'aspect-[4/3]', '1:1': 'aspect-square' };

/**
 * LT-582 (Erel): a side's label shows only while that side is in sight. Within
 * this much (in percent) of an edge only one picture is left, and its own
 * label with it - the line has gone past the other one's label by then.
 */
const LABEL_EDGE = 15;

interface AiPictureBoxProps {
  /** The picture there now ('' = none): what "edit with AI" changes. */
  value: string;
  aspect: AiAspect;
  /** The picture the owner keeps: a temporary URL, kept for good when the site or the gallery is saved. */
  onUse: (url: string) => void;
  /** LT-581: the gallery's card offers only "edit with AI", open at once. */
  editOnly?: boolean;
}

/**
 * LT-366, LT-519: a picture made or changed by AI from the owner's words, one
 * of the plan's monthly pictures. LT-581: one box for the site editor and the
 * gallery, and a changed picture is shown against the original on Erel's
 * before/after slider.
 */
const AiPictureBox: React.FC<AiPictureBoxProps> = ({ value, aspect, onUse, editOnly = false }) => {
  const { t } = useTranslation();
  const [aiOpen, setAiOpen] = useState(editOnly);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<'failed' | 'limit' | 'tooBig' | null>(null);
  // LT-519: the same box changes the picture that is there, by the owner's words.
  const [aiEditing, setAiEditing] = useState(editOnly);
  // LT-489: on the free plan the month's AI pictures are the build's; the editor makes none.
  const [aiLocked, setAiLocked] = useState(false);
  // Where the before/after line is, 0 (all "after") to 100 (all "before"); every new picture starts in the middle.
  const [split, setSplit] = useState(50);

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
      const url = await (aiEditing ? aiService.editImage(value, aiPrompt.trim()) : aiService.createImage(aiPrompt.trim(), aspect));
      setSplit(50);
      setAiResult(url);
    } catch (err) {
      const response = (err as { response?: { status?: number; data?: { code?: string } } })?.response;
      if (response?.data?.code === 'AI_IMAGES_PLUS') setAiLocked(true);
      else if (response?.data?.code === 'IMAGE_TOO_LARGE') setAiError('tooBig');
      else setAiError(response?.status === 429 ? 'limit' : 'failed');
    } finally {
      setAiBusy(false);
    }
  };

  // In the app a locked option is hidden rather than pointing at the plans (LT-130).
  if (aiLocked) {
    return canOfferPurchases() ? (
      <p className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm text-gray-600 dark:text-slate-300" data-testid="ai-image-plus">
        <Wand2 className="w-4 h-4 shrink-0 text-primary" />
        {t('siteEditor.image.aiPlusOnly')}
      </p>
    ) : null;
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3" data-testid="ai-image">
      {!aiOpen ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => { setAiEditing(false); setAiOpen(true); }}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary"
          >
            <Wand2 className="w-4 h-4" />
            {t('siteEditor.image.aiOpen')}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => { setAiEditing(true); setAiOpen(true); }}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              <Sparkles className="w-4 h-4" />
              {t('siteEditor.image.aiEditOpen')}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300" htmlFor="ai-image-prompt">
            {t(aiEditing ? 'siteEditor.image.aiEditLabel' : 'siteEditor.image.aiLabel')}
          </label>
          <textarea
            id="ai-image-prompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder={t(aiEditing ? 'siteEditor.image.aiEditPlaceholder' : 'siteEditor.image.aiPlaceholder')}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100"
          />
          {aiBusy && (
            <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-primary/30" aria-live="polite">
              <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[ai-sweep_1.6s_ease-in-out_infinite]" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-primary">
                <Sparkles className="w-8 h-8 animate-pulse" />
                <span className="text-xs font-medium">{t(aiEditing ? 'siteEditor.image.aiEditing' : 'siteEditor.image.aiCreating')}</span>
              </div>
            </div>
          )}
          {aiResult && !aiBusy && (aiEditing ? (
            // LT-581 (Erel): the change against the original, on one picture with a line to drag.
            <div className="flex flex-col gap-1">
              <Diff
                className={`${ASPECT_CLASS[aspect]} rounded-xl bg-gray-100 dark:bg-slate-800`}
                label={t('siteEditor.image.aiCompare')}
                handleLabel={t('siteEditor.image.aiCompareHandle')}
                value={split}
                onValueChange={setSplit}
                data-testid="ai-before-after"
              >
                <DiffItem1><img src={resolveImage(value)} alt={t('siteEditor.image.aiBefore')} /></DiffItem1>
                <DiffItem2><img src={resolveImage(aiResult)} alt={t('siteEditor.image.aiAfter')} /></DiffItem2>
                <DiffResizer />
                {split > LABEL_EDGE && (
                  <span aria-hidden="true" data-testid="ai-before-label" className="pointer-events-none absolute left-2 top-2 z-[3] rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
                    {t('siteEditor.image.aiBefore')}
                  </span>
                )}
                {split < 100 - LABEL_EDGE && (
                  <span aria-hidden="true" data-testid="ai-after-label" className="pointer-events-none absolute right-2 top-2 z-[3] rounded-full bg-primary/85 px-2 py-0.5 text-xs font-medium text-white">
                    {t('siteEditor.image.aiAfter')}
                  </span>
                )}
              </Diff>
              <p className="text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.image.aiCompareHint')}</p>
            </div>
          ) : (
            <img src={resolveImage(aiResult)} alt="" className="w-full max-h-48 object-contain rounded-xl bg-gray-100 dark:bg-slate-800" />
          ))}
          <div className="flex flex-wrap gap-2">
            {aiResult && !aiBusy && (
              <button
                type="button"
                onClick={() => { onUse(aiResult); setAiResult(null); setAiOpen(editOnly); setAiPrompt(''); }}
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
              {aiEditing
                ? t(aiBusy ? 'siteEditor.image.aiEditing' : aiResult ? 'siteEditor.image.aiEditAgain' : 'siteEditor.image.aiEditRun')
                : aiBusy ? t('siteEditor.image.aiCreating') : aiResult ? t('siteEditor.image.aiAgain') : t('siteEditor.image.aiCreate')}
            </button>
          </div>
          {aiError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {t(
                aiError === 'limit'
                  ? 'siteEditor.image.aiLimit'
                  : aiError === 'tooBig'
                    ? 'siteEditor.image.aiEditTooBig'
                    : aiEditing
                      ? 'siteEditor.image.aiEditFailed'
                      : 'siteEditor.image.aiFailed'
              )}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t(aiEditing ? 'siteEditor.image.aiEditHint' : 'siteEditor.image.aiHint')}
          </p>
        </div>
      )}
    </div>
  );
};

export default AiPictureBox;
