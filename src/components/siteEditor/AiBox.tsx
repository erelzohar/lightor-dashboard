import React, { useState } from 'react';
import { type AxiosError } from 'axios';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { aiService, type ElementField } from '../../services/aiApi';
import { LightyBubble, LightyTyping, OwnerBubble } from '../lighty/LightyChat';

const QUICK = ['shorter', 'warmer', 'formal', 'fix'] as const;

interface AiBoxProps {
  /** The texts the AI may change — one field, or a section's texts. */
  fields: ElementField[];
  onApply: (values: Record<string, string>) => void;
  /** Lighty's opening line; the one-text greeting when absent. */
  hint?: string;
}

interface Exchange { ask: string; answer: string; tone: 'ok' | 'warn' | 'error' }

/**
 * LT-249: AI for what the owner selected (lightor-ai-split-plan.md §4.5) —
 * quick actions or their own words; only the given texts can change, and the
 * answer lands in the draft like a hand edit (one undo step).
 * LT-253: told as a short conversation with Lighty — his greeting, the
 * owner's request, his answer.
 */
const AiBox: React.FC<AiBoxProps> = ({ fields, onApply, hint }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState<string | null>(null);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  const run = async (instruction: string, shown: string) => {
    const ask = instruction.trim();
    if (!ask || busy || fields.length === 0) return;
    setBusy(true);
    setAsked(shown.trim());
    let answer: Exchange;
    try {
      const { values, message } = await aiService.editElement(ask, fields);
      if (Object.keys(values).length > 0) {
        onApply(values);
        answer = { ask: shown.trim(), answer: message || t('siteEditor.ai.done'), tone: 'ok' };
        setText('');
      } else {
        answer = { ask: shown.trim(), answer: message || t('siteEditor.ai.noChange'), tone: 'warn' };
      }
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      answer = { ask: shown.trim(), answer: t(status === 429 ? 'siteEditor.ai.budget' : 'siteEditor.ai.failed'), tone: 'error' };
    }
    setExchanges((all) => [...all, answer].slice(-3));
    setAsked(null);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-violet-200/70 dark:border-violet-800/40 bg-white/70 dark:bg-slate-900/40 p-3" data-testid="ai-box" aria-label="Lighty">
      <LightyBubble avatar={36}>{hint ?? t('siteEditor.ai.greetText')}</LightyBubble>
      <div className="flex flex-wrap gap-1.5 ps-11">
        {QUICK.map((key) => (
          <button
            key={key}
            type="button"
            disabled={busy}
            onClick={() => void run(t(`siteEditor.ai.ask.${key}`), t(`siteEditor.ai.quick.${key}`))}
            className="px-3 py-1 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800/50 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-50"
          >
            {t(`siteEditor.ai.quick.${key}`)}
          </button>
        ))}
      </div>
      {exchanges.map((e, i) => (
        <React.Fragment key={i}>
          <OwnerBubble>{e.ask}</OwnerBubble>
          <LightyBubble>
            <span
              role={i === exchanges.length - 1 ? 'status' : undefined}
              className={e.tone === 'error' ? 'text-red-600 dark:text-red-400' : e.tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : undefined}
            >
              {e.answer}
            </span>
          </LightyBubble>
        </React.Fragment>
      ))}
      {busy && asked && <OwnerBubble>{asked}</OwnerBubble>}
      {busy && <LightyTyping />}
      <form
        className="flex items-center gap-2 mt-1"
        onSubmit={(e) => { e.preventDefault(); void run(text, text); }}
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
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-gradient-to-r from-primary to-violet-500 text-white disabled:opacity-40"
        >
          <Send className="w-4 h-4 rtl:-scale-x-100" />
        </button>
      </form>
    </div>
  );
};

export default AiBox;
