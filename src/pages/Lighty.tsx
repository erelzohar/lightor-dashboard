import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AxiosError } from 'axios';
import { Palette, RotateCcw, Send } from 'lucide-react';
import { assistantService, type LightyTurn } from '../services/assistantApi';
import { fetchMyEntitlements } from '../services/entitlementsApi';
import { useAppSelector } from '../hooks/useAppSelector';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';
import { isLeadsSite } from '../utils/siteMode';
import { LightyBubble, LightyTyping, OwnerBubble } from '../components/lighty/LightyChat';
import { lightTick } from '../lib/haptics';
import { LightyTyped } from '../components/lighty/LightyTyped';

// three.js and the model reach only this page.
const Lighty3D = lazy(() => import('../components/lighty/Lighty3D'));

const BOOKING_SUGGESTIONS = ['today', 'tomorrowFree', 'week', 'leads', 'regulars', 'howBlock'] as const;
const LEADS_SUGGESTIONS = ['leads', 'month', 'services', 'howHours'] as const;

/**
 * LT-253 — Lighty, the owner's business chat (lightor-ai-split-plan.md §3):
 * questions about the calendar, free time, customers, leads and the setup,
 * answered from the business's own data. The live 3D Lighty heads the page —
 * big and waving on an empty conversation, small once it starts; he runs
 * while he thinks (LT-258) and cheers when an answer lands. A website
 * request comes back with a button to the site editor; a question typed into
 * the floating Lighty arrives here and is sent at once.
 */
const LightyPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const keyboardOpen = useVirtualKeyboard();
  const webConfig = useAppSelector((state) => state.webConfig.data);
  const suggestions = isLeadsSite(webConfig) ? LEADS_SUGGESTIONS : BOOKING_SUGGESTIONS;

  const [turns, setTurns] = useState<LightyTurn[]>([]);
  // The answer that just arrived types itself out (LT-271); the thread loaded
  // from the server shows whole.
  const [freshTurn, setFreshTurn] = useState<LightyTurn | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cheer, setCheer] = useState(0);
  const [usage, setUsage] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [initial] = useState(() => (location.state as { lightyMessage?: string } | null)?.lightyMessage);
  const started = useRef(false);
  const empty = loaded && turns.length === 0 && !busy;

  useEffect(() => {
    let alive = true;
    assistantService.thread()
      .then((past) => { if (alive) setTurns(past); })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const refreshUsage = useCallback(async () => {
    const e = await fetchMyEntitlements();
    const limit = e?.limits.aiTokensPerMonth;
    if (e && limit) setUsage(Math.min(100, Math.round((e.usage.aiTokensThisMonth / limit) * 100)));
  }, []);
  useEffect(() => { void refreshUsage(); }, [refreshUsage]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns, busy, error]);

  const scrollToEnd = () => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  };

  const send = async (text: string) => {
    const ask = text.trim();
    if (!ask || busy) return;
    setInput('');
    setError(null);
    setTurns((all) => [...all, { role: 'user', content: ask }]);
    setBusy(true);
    try {
      const { reply, handoff } = await assistantService.chat(ask);
      const answer: LightyTurn = { role: 'assistant', content: reply, ...(handoff ? { handoff } : {}) };
      setTurns((all) => [...all, answer]);
      setFreshTurn(answer);
      lightTick();
      setCheer((n) => n + 1);
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      setError(t(status === 429 ? 'lighty.budget' : 'lighty.failed'));
    } finally {
      setBusy(false);
      void refreshUsage();
    }
  };

  // A question from the floating Lighty, once the conversation so far is in.
  useEffect(() => {
    if (!initial || !loaded || started.current) return;
    started.current = true;
    window.history.replaceState({}, '');
    void send(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, loaded]);

  const clear = async () => {
    setTurns([]);
    setError(null);
    await assistantService.clear().catch(() => undefined);
    inputRef.current?.focus();
  };

  const chips = (
    <div className={`flex gap-2 ${empty ? 'flex-wrap justify-center' : 'overflow-x-auto pb-1 [scrollbar-width:none]'}`}>
      {suggestions.map((key) => (
        <button
          key={key}
          type="button"
          disabled={busy}
          onClick={() => void send(t(`lighty.suggest.${key}`))}
          className="shrink-0 px-3.5 py-2 rounded-full text-sm bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800/60 text-violet-700 dark:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-50 whitespace-nowrap"
        >
          {t(`lighty.suggest.${key}`)}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className={`h-full max-w-3xl w-full mx-auto flex flex-col ${keyboardOpen ? '' : 'pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0'}`}
      data-testid="lighty-page"
    >
      {/* Lighty himself: big on an empty conversation, small at the top once it runs. */}
      <header className={empty ? 'flex flex-col items-center text-center gap-2 pt-2 md:pt-8' : 'flex items-center gap-3 pb-3 border-b border-gray-200/70 dark:border-slate-700/60'}>
        <div className={`shrink-0 transition-all duration-500 ${empty ? 'w-44 h-48 md:w-52 md:h-56' : 'w-12 h-14'}`}>
          <Suspense fallback={null}>
            <Lighty3D thinking={busy} cheerKey={cheer} className="w-full h-full" />
          </Suspense>
        </div>
        <div className={empty ? 'max-w-md' : 'flex-1 min-w-0'}>
          <h1 className={`font-bold text-gray-800 dark:text-white ${empty ? 'text-2xl' : 'text-base'}`}>{empty ? t('lighty.hello') : 'Lighty'}</h1>
          <p className={`text-gray-500 dark:text-slate-400 ${empty ? 'mt-1 text-sm' : 'text-xs truncate'}`} aria-live="polite">
            {busy ? t('lighty.thinking') : empty ? t('lighty.intro') : t('lighty.subtitle')}
          </p>
        </div>
        {!empty && (
          <div className="flex items-center gap-2 shrink-0">
            {usage !== null && (
              <span className="hidden sm:inline text-[11px] text-gray-400 dark:text-slate-500" title={t('lighty.usage', { percent: usage })}>{usage}%</span>
            )}
            <button
              type="button"
              onClick={() => void clear()}
              disabled={busy || turns.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-primary/50 disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              {t('lighty.newChat')}
            </button>
          </div>
        )}
      </header>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-3" role="log" aria-label={t('lighty.conversation')}>
        {empty && <div className="mt-2">{chips}</div>}
        {turns.map((turn, i) => turn.role === 'user' ? (
          <OwnerBubble key={i}>{turn.content}</OwnerBubble>
        ) : (
          <LightyBubble key={i}>
            <LightyTyped text={turn.content} animate={turn === freshTurn} onType={scrollToEnd} />
            {turn.handoff && (
              <button
                type="button"
                onClick={() => navigate('/design', { state: { floatingMessage: turn.handoff } })}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-primary to-violet-500 text-white shadow-sm"
              >
                <Palette className="w-3.5 h-3.5" aria-hidden="true" />
                {t('lighty.toEditor')}
              </button>
            )}
          </LightyBubble>
        ))}
        {busy && <LightyTyping />}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
      </div>

      {!empty && turns.length > 0 && !busy && <div className="pb-2">{chips}</div>}

      <form
        className="flex items-end gap-2 rounded-3xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-sm focus-within:ring-2 focus-within:ring-violet-300/50"
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder={t('lighty.placeholder')}
          aria-label={t('lighty.placeholder')}
          className="flex-1 min-w-0 max-h-32 resize-none bg-transparent px-2 py-2 text-[0.9375rem] text-gray-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label={t('lighty.send')}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-primary to-violet-500 text-white disabled:opacity-40"
        >
          <Send className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
};

export default LightyPage;
