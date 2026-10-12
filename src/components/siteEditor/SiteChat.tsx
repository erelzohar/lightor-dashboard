import { useEffect, useRef, useState } from 'react';
import { LightyAvatar, LightyBubble, LightyTyping, OwnerBubble } from '../lighty/LightyChat';
import { useTranslation } from 'react-i18next';
import { aiService, trimHistory, type AiSiteConfig, type ChatTurn } from '../../services/aiApi';
import { changedLabels } from '../../utils/editorDiff';
import { fieldLabel } from './labels';
import { lightTick } from '../../lib/haptics';
import { LightyTyped } from '../lighty/LightyTyped';
import { LightySendIcon, lightySendButton } from '../lighty/LightySendIcon';

interface SiteChatProps<T> {
  config: T;
  onApply: (next: T) => void;
  /** A request typed in the floating assistant before arriving here. */
  initialMessage?: string;
}

/**
 * LT-249: today's whole-site AI chat, moved into the editor's page panel
 * (LT-253: a conversation with Lighty; LT-256: his line at the top of the
 * design tab, staying there while it scrolls).
 * The answer replaces the draft (one undo step) and the owner is told what
 * changed. Services, vacations and booking questions stay as the draft has
 * them: the editor does not save those, so the preview must not show them
 * changed either.
 */
function SiteChat<T>({ config, onApply, initialMessage }: SiteChatProps<T>) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [fresh, setFresh] = useState<ChatTurn | null>(null); // types out (LT-271)
  const listRef = useRef<HTMLDivElement>(null);
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
      const answer: ChatTurn = { role: 'assistant', content: [result.message, summary].filter(Boolean).join('\n') };
      setMessages((m) => [...m, answer]);
      setFresh(answer);
      lightTick();
    } catch {
      const answer: ChatTurn = { role: 'assistant', content: t('siteEditor.ai.failed') };
      setMessages((m) => [...m, answer]);
      setFresh(answer);
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
    // Two siblings (the line in the panel itself), so the line stays on top.
    <>
      <div className="sticky -top-4 z-10 -mx-4 px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-violet-100 dark:border-violet-900/40" data-testid="site-chat" aria-label={t('siteEditor.chat.title')}>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <LightyAvatar size={36} thinking={busy} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder={t('siteEditor.chat.placeholder')}
            aria-label={t('siteEditor.chat.placeholder')}
            className="flex-1 min-w-0 rounded-full border border-violet-200 dark:border-violet-800/60 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300/50"
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label={t('siteEditor.ai.send')} className={`w-9 h-9 ${lightySendButton}`}>
            <LightySendIcon />
          </button>
        </form>
      </div>
      {messages.length > 0 && (
        <div ref={listRef} className="flex flex-col gap-2 max-h-72 overflow-y-auto">
          {messages.map((m, i) => (m.role === 'user'
            ? <OwnerBubble key={i}>{m.content}</OwnerBubble>
            : <LightyBubble key={i}><LightyTyped text={m.content} animate={m === fresh} onType={() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }} /></LightyBubble>))}
        </div>
      )}
      {busy && <LightyTyping />}
    </>
  );
}

export default SiteChat;
