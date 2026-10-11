import React, { useState } from 'react';
import { type AxiosError } from 'axios';
import { Loader2, Sparkles, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { aiService, type ElementField } from '../../services/aiApi';

const QUICK = ['shorter', 'warmer', 'formal', 'fix'] as const;

interface AiBoxProps {
  /** The texts the AI may change — one field, or a section's texts. */
  fields: ElementField[];
  onApply: (values: Record<string, string>) => void;
  hint?: string;
}

/**
 * LT-249: AI for what the owner selected (lightor-ai-split-plan.md §4.5) —
 * quick actions or their own words; only the given texts can change, and the
 * answer lands in the draft like a hand edit (one undo step).
 */
const AiBox: React.FC<AiBoxProps> = ({ fields, onApply, hint }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const run = async (instruction: string) => {
    const ask = instruction.trim();
    if (!ask || busy || fields.length === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const { values, message } = await aiService.editElement(ask, fields);
      if (Object.keys(values).length > 0) {
        onApply(values);
        setNote({ tone: 'ok', text: message || t('siteEditor.ai.done') });
        setText('');
      } else {
        setNote({ tone: 'warn', text: message || t('siteEditor.ai.noChange') });
      }
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      setNote({ tone: 'error', text: t(status === 429 ? 'siteEditor.ai.budget' : 'siteEditor.ai.failed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200/70 dark:border-violet-800/40 bg-violet-50/60 dark:bg-violet-950/20 p-3" data-testid="ai-box">
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        {t('siteEditor.ai.title')}
      </div>
      {hint && <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK.map((key) => (
          <button
            key={key}
            type="button"
            disabled={busy}
            onClick={() => run(t(`siteEditor.ai.ask.${key}`))}
            className="px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800/50 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-50"
          >
            {t(`siteEditor.ai.quick.${key}`)}
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); void run(text); }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          disabled={busy}
          placeholder={t('siteEditor.ai.placeholder')}
          aria-label={t('siteEditor.ai.placeholder')}
          className="flex-1 min-w-0 rounded-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-300/50"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label={t('siteEditor.ai.send')}
          className="p-2 rounded-full bg-gradient-to-r from-primary to-violet-500 text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
      {busy && <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.ai.working')}</p>}
      {note && !busy && (
        <p
          role="status"
          className={`mt-2 text-xs ${note.tone === 'error' ? 'text-red-600 dark:text-red-400' : note.tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}
        >
          {note.text}
        </p>
      )}
    </div>
  );
};

export default AiBox;
