import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { LightyBubble, LightyText, LightyTyping, OwnerBubble } from '../lighty/LightyChat';
import { useTranslation } from 'react-i18next';
import { aiService, trimHistory, type AiSiteConfig, type ChatTurn } from '../../services/aiApi';
import { changedLabels } from '../../utils/editorDiff';
import { fieldLabel } from './labels';

interface SiteChatProps<T> {
  config: T;
  onApply: (next: T) => void;
  /** A request typed in the floating assistant before arriving here. */
  initialMessage?: string;
}

/**
 * LT-249: today's whole-site AI chat, moved into the editor's page panel
 * (LT-253: a conversation with Lighty).
 * The answer replaces the draft (one undo step) and the owner is told what
 * changed. Services, vacations and booking questions stay as the draft has
 * them: the editor does not save those, so the preview must not show them
 * changed either.
 */
function SiteChat<T>({ config, onApply, initialMessage }: SiteChatProps<T>) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const latest = useRef(config);
  useEffect(() => { latest.current = config; }, [config]);

  const send = async (prompt: string) => {
    const ask = prompt.trim();
    if (!ask || busy) return;
    setInput('');
    const history = trimHistory(messages);
    setMessages((m) => [...m, { role: 'user', content: ask }]);
    setBusy(true);
    try {
      const before = latest.current as unknown as AiSiteConfig;
      const result = await aiService.editSite(ask, before, null, history);
      const kept = before as Record<string, unknown>;
      const next = {
        ...result.config,
        appointmentTypes: kept.appointmentTypes,
        vacations: kept.vacations,
        bookingFields: kept.bookingFields,
        leadFields: kept.leadFields,
      } as unknown as T;
      const changed = changedLabels(before, next, (p) => fieldLabel(t, p), t('siteEditor.chat.look'));
      onApply(next);
      const summary = changed.length ? t('siteEditor.chat.changed', { list: changed.slice(0, 6).join(', ') }) : t('siteEditor.chat.nothingChanged');
      setMessages((m) => [...m, { role: 'assistant', content: [result.message, summary].filter(Boolean).join('\n') }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: t('siteEditor.ai.failed') }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialMessage && !started.current) {
      started.current = true;
      void send(initialMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-violet-200/70 dark:border-violet-800/40 bg-white/70 dark:bg-slate-900/40 p-3" data-testid="site-chat" aria-label={t('siteEditor.chat.title')}>
      <LightyBubble avatar={36}>{t('siteEditor.chat.greet')}</LightyBubble>
      {messages.length > 0 && (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
          {messages.map((m, i) => (m.role === 'user'
            ? <OwnerBubble key={i}>{m.content}</OwnerBubble>
            : <LightyBubble key={i}><LightyText text={m.content} /></LightyBubble>))}
          {busy && <LightyTyping />}
        </div>
      )}
      {messages.length === 0 && busy && <LightyTyping />}
      <form className="flex items-center gap-2 mt-1" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder={t('siteEditor.chat.placeholder')}
          aria-label={t('siteEditor.chat.placeholder')}
          className="flex-1 min-w-0 rounded-full border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-300/50"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label={t('siteEditor.ai.send')} className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-gradient-to-r from-primary to-violet-500 text-white disabled:opacity-40">
          <Send className="w-4 h-4 rtl:-scale-x-100" />
        </button>
      </form>
    </div>
  );
}

export default SiteChat;
