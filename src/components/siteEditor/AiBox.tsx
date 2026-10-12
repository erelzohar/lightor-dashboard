import React, { useState } from 'react';
import { type AxiosError } from 'axios';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { aiService, type ElementField } from '../../services/aiApi';
import { LightyAvatar, LightyBubble, LightyTyping, OwnerBubble } from '../lighty/LightyChat';

const QUICK = ['shorter', 'warmer', 'formal', 'fix'] as const;

interface AiBoxProps {
  /** The texts the AI may change — one field, or a section's texts. */
  fields: ElementField[];
  onApply: (values: Record<string, string>) => void;
  /** What Lighty's line asks; the one-text question when absent. */
  placeholder?: string;
}

interface Exchange { ask: string; answer: string; tone: 'ok' | 'warn' | 'error' }

/**
 * LT-249: AI for what the owner selected (lightor-ai-split-plan.md §4.5) —
 * quick actions or their own words; only the given texts can change, and the
 * answer lands in the draft like a hand edit (one undo step).
 * LT-253: told as a short conversation with Lighty — the owner's request,
 * his answer. LT-256: his line opens the panel and stays at its top while it
 * scrolls, so asking him is never a scroll away.
 */
const AiBox: React.FC<AiBoxProps> = ({ fields, onApply, placeholder }) => {
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

  const ask = placeholder ?? t('siteEditor.ai.askHere');
  return (
    // Two siblings, not one box: a sticky element only sticks within its
    // parent, so Lighty's line must sit in the panel itself to stay on top.
    <>
      <div className="sticky -top-4 z-10 -mx-4 px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-violet-100 dark:border-violet-900/40" data-testid="ai-box" aria-label="Lighty">
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void run(text, text); }}>
          <LightyAvatar size={36} thinking={busy} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            disabled={busy}
            placeholder={ask}
            aria-label={ask}
            className="flex-1 min-w-0 rounded-full border border-violet-200 dark:border-violet-800/60 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300/50"
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
        <div className="flex flex-wrap gap-1.5 mt-2 ps-11">
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
      </div>
      {(exchanges.length > 0 || busy) && (
        <div className="flex flex-col gap-2">
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
        </div>
      )}
    </>
  );
};

export default AiBox;
