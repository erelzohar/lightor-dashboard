import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { draftPost, postIdeas, type PostDraft, type PostIdea } from '../../services/postsApi';
import LightyIcon from '../lighty/LightyIcon';

interface Props {
  draftsLeft: number;
  draftsPerMonth: number;
  onDrafted: (draft: PostDraft, left: number) => void;
  onClose: () => void;
}

const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white';

/**
 * LT-610 (the plan's section 3): Lighty proposes five topics from the
 * business and the season, or the owner writes one; the owner may add what
 * they want said; Lighty writes the draft, which opens in the editor. A draft
 * that fails is handed back to the month by the server.
 */
const LightyWrites: React.FC<Props> = ({ draftsLeft, draftsPerMonth, onDrafted, onClose }) => {
  const { t, i18n } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const [ideas, setIdeas] = useState<PostIdea[] | null>(null);
  const [ideasFailed, setIdeasFailed] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [step, setStep] = useState<'topic' | 'words'>('topic');
  const [words, setWords] = useState('');
  const [writing, setWriting] = useState(false);
  const [failed, setFailed] = useState(false);
  useDialogFocus(true, box, () => { if (!writing) onClose(); });
  const rtl = i18n.dir() === 'rtl';
  const Back = rtl ? ArrowRight : ArrowLeft;
  const none = draftsLeft <= 0;

  const loadIdeas = async (more: string[]) => {
    setIdeas(null);
    setIdeasFailed(false);
    try {
      const next = await postIdeas(more);
      setIdeas(next);
      setSeen([...more, ...next.map((i) => i.title)].slice(-30));
    } catch {
      setIdeas([]);
      setIdeasFailed(true);
    }
  };
  useEffect(() => { if (!none) void loadIdeas([]); }, [none]);

  const write = async () => {
    setWriting(true);
    setFailed(false);
    try {
      const { draft, draftsLeft: left } = await draftPost(topic, words);
      onDrafted(draft, left);
    } catch {
      setFailed(true);
    } finally {
      setWriting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" role="presentation" onClick={() => { if (!writing) onClose(); }}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lighty-writes-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
        data-testid="lighty-writes"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <LightyIcon className="h-9 w-9" />
            <div>
              <h2 id="lighty-writes-title" className="text-lg font-bold text-gray-900 dark:text-white">{t('blog.lighty.title')}</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400" data-testid="drafts-left">{t('blog.draftsLeft', { left: draftsLeft, max: draftsPerMonth })}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={writing} aria-label={t('blog.editor.close')} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {none ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200" data-testid="drafts-used">{t('blog.lighty.used')}</p>
        ) : writing ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center" data-testid="lighty-writing">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-gray-600 dark:text-slate-300">{t('blog.lighty.writing')}</p>
          </div>
        ) : step === 'topic' ? (
          <div>
            <p className="mb-3 font-semibold text-gray-900 dark:text-white">{t('blog.lighty.ideas')}</p>
            {ideas === null ? (
              <p className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('blog.lighty.ideasLoading')}</p>
            ) : (
              <>
                {ideasFailed && <p className="mb-3 text-sm text-gray-500">{t('blog.lighty.ideasFailed')}</p>}
                <div className="space-y-2" role="list" data-testid="post-ideas">
                  {ideas.map((idea) => (
                    <button
                      key={idea.title}
                      type="button"
                      role="listitem"
                      onClick={() => { setTopic(idea.title); setStep('words'); }}
                      className="block w-full rounded-2xl border border-gray-200 px-4 py-3 text-start transition-colors hover:border-primary hover:bg-primary/5 dark:border-slate-700"
                    >
                      <span className="block font-medium text-gray-900 break-words dark:text-white">{idea.title}</span>
                      {idea.angle && <span className="mt-0.5 block text-sm text-gray-500 break-words dark:text-slate-400">{idea.angle}</span>}
                    </button>
                  ))}
                </div>
                {!ideasFailed && (
                  <button type="button" onClick={() => void loadIdeas(seen)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    <RefreshCw className="h-4 w-4" /> {t('blog.lighty.moreIdeas')}
                  </button>
                )}
              </>
            )}
            <div className="mt-5 border-t border-gray-100 pt-4 dark:border-slate-800">
              <label htmlFor="own-topic" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">{t('blog.lighty.own')}</label>
              <div className="flex gap-2">
                <input id="own-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder={t('blog.lighty.ownPlaceholder')} className={field} />
                <button type="button" disabled={topic.trim().length < 3} onClick={() => setStep('words')} className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {t('blog.lighty.next')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">{t('blog.lighty.topic')}</p>
            <p className="mb-4 font-semibold text-gray-900 break-words dark:text-white" data-testid="chosen-topic">{topic}</p>
            <label htmlFor="own-words" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">{t('blog.lighty.words')}</label>
            <textarea id="own-words" value={words} onChange={(e) => setWords(e.target.value)} maxLength={1500} rows={4} className={`${field} resize-y`} />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">{t('blog.lighty.wordsHint')}</p>
            {failed && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" data-testid="draft-failed">{t('blog.lighty.failed')}</p>}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setStep('topic')} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-slate-300">
                <Back className="h-4 w-4" /> {t('blog.lighty.back')}
              </button>
              <button type="button" onClick={() => void write()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4" /> {t('blog.lighty.write')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LightyWrites;
