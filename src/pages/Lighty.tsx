import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AxiosError } from 'axios';
import { ImagePlus, Loader2, Palette, RotateCcw, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { assistantService, type LightyAction, type LightyTurn } from '../services/assistantApi';
import { uploadImage } from '../services/imagesApi';
import globals from '../services/globals';
import { isAiBusy } from '../lib/aiErrors';
import { fetchMyEntitlements } from '../services/entitlementsApi';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAuth } from '../contexts/AuthContext';
import { fetchWebConfig } from '../store/slices/webConfigSlice';
import { fetchVacations } from '../store/slices/vacationsSlice';
import { fetchAppointments, fetchAppointmentTypes } from '../store/slices/appointmentsSlice';
import { LightyActionCard } from '../components/lighty/LightyActionCard';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';
import { useLightySuggestions } from '../hooks/useLightySuggestions';
import { SuggestionChip } from '../components/lighty/SuggestionChip';
import { LightyBubble, LightyThreadLoading, LightyTyping, OwnerBubble } from '../components/lighty/LightyChat';
import { lightTick } from '../lib/haptics';
import { isNativeApp } from '../lib/platform';
import { lazyOr } from '../lib/lazyOr';
import { useMomentum } from '../hooks/useMomentum';
import { LightyTyped } from '../components/lighty/LightyTyped';
import { LightySendIcon, lightySendButton } from '../components/lighty/LightySendIcon';

// three.js and the model reach only this page. When their chunk cannot load
// (a deploy since the tab opened, a dropped connection), the still Lighty
// stands in rather than the page failing (LT-315).
const StillLighty: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img src="/lighty-avatar.webp" alt="" draggable={false} data-testid="lighty-still" className={`object-contain select-none ${className}`} />
);
const Lighty3D = lazyOr(() => import('../components/lighty/Lighty3D'), StillLighty);

/**
 * LT-253 — Lighty, the owner's business chat (lightor-ai-split-plan.md §3):
 * questions about the calendar, free time, customers, leads and the setup,
 * answered from the business's own data. The live 3D Lighty heads the page —
 * big and waving on an empty conversation, small once it starts; he runs
 * while he thinks (LT-258) and cheers when an answer lands. A website
 * request comes back with a button to the site editor; a question typed into
 * the floating Lighty arrives here and is sent at once. LT-561: a change he
 * proposes comes as a card under his answer, done only on the owner's
 * confirm; what it changed is read again for the other pages.
 */
// LT-568: a message carries at most a product's pictures.
const MAX_PICTURES = 6;

const LightyPage: React.FC = () => {
  const { t } = useTranslation();
  // Every page names the window (LT-444): without this the tab kept the
  // previous page's title. "Lighty" is a name, the same in every language.
  document.title = 'Lighty';
  const navigate = useNavigate();
  const location = useLocation();
  const keyboardOpen = useVirtualKeyboard();
  const webConfig = useAppSelector((state) => state.webConfig.data);
  const { auth, refreshUser } = useAuth();
  const userId = auth.user?._id;
  const dispatch = useAppDispatch();
  // LT-566: the ready questions follow the business - what applies, and what is happening now.
  const suggestions = useLightySuggestions();

  const [turns, setTurns] = useState<LightyTurn[]>([]);
  // The answer that just arrived types itself out (LT-271); the thread loaded
  // from the server shows whole.
  const [freshTurn, setFreshTurn] = useState<LightyTurn | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  // LT-568: pictures for the next message, uploaded as the products page does (a product's six at most).
  const [pictures, setPictures] = useState<string[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [busy, setBusy] = useState(false);
  // LT-385: his mood here too - how the week is going.
  const momentum = useMomentum();
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

  // In the app the keyboard stayed up over the answer (LT-479, Erel): it goes
  // down once the message is sent, on any touch screen. A computer keeps the
  // focus for the next question.
  const closeKeyboard = () => {
    const touch = isNativeApp() || window.matchMedia?.('(pointer: coarse)').matches === true;
    if (touch && document.activeElement === inputRef.current) inputRef.current?.blur();
  };

  const attachFiles = async (files: File[]) => {
    if (!files.length || attaching || busy) return;
    const room = MAX_PICTURES - pictures.length;
    setError(files.length > room ? t('lighty.attach.tooMany', { max: MAX_PICTURES }) : null);
    setAttaching(true);
    try {
      for (const file of files.slice(0, Math.max(0, room))) {
        const small = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true });
        const { imageName } = await uploadImage(small, 'photo');
        setPictures((all) => (all.length < MAX_PICTURES ? [...all, imageName] : all));
      }
    } catch {
      setError(t('lighty.attach.failed'));
    } finally {
      setAttaching(false);
    }
  };

  const attach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    void attachFiles(files);
  };

  // LT-578 (Erel): a picture pasted into the box is attached, as the button does. Text pastes as text;
  // a copy that carries both (a picture from a web page) keeps its text and attaches the picture.
  const pasteFiles = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    if (!e.clipboardData.getData('text/plain')) e.preventDefault();
    void attachFiles(files);
  };

  const send = async (text: string) => {
    // Pictures with no words still say what they are for (LT-568).
    const images = pictures;
    const ask = text.trim() || (images.length ? t('lighty.attach.defaultMessage') : '');
    // Not before the conversation so far is in (LT-479): it would replace
    // the message just sent.
    if (!ask || busy || !loaded || attaching) return;
    closeKeyboard();
    setInput('');
    setPictures([]);
    setError(null);
    setTurns((all) => [...all, { role: 'user', content: ask, ...(images.length ? { images } : {}) }]);
    setBusy(true);
    try {
      const { reply, handoff, actions } = await assistantService.chat(ask, images);
      const answer: LightyTurn = { role: 'assistant', content: reply, ...(handoff ? { handoff } : {}), ...(actions?.length ? { actions } : {}) };
      setTurns((all) => [...all, answer]);
      setFreshTurn(answer);
      lightTick();
      setCheer((n) => n + 1);
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      setError(t(isAiBusy(err) ? 'common.aiBusy' : status === 429 ? 'lighty.budget' : 'lighty.failed'));
      // The pictures wait for the next try.
      if (images.length) setPictures(images);
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

  // A card's new state in its turn; a change done or undone is read again for the other pages.
  const updateAction = (next: LightyAction) => {
    setTurns((all) => all.map((turn) => (turn.actions?.some((a) => a.id === next.id)
      ? { ...turn, actions: turn.actions.map((a) => (a.id === next.id ? next : a)) }
      : turn)));
    if (next.status !== 'done' && next.status !== 'undone') return;
    if (['vacation_add', 'vacation_remove', 'hours', 'booking_rules'].includes(next.kind) && webConfig?._id) void dispatch(fetchWebConfig(webConfig._id));
    if (next.kind === 'vacation_add' || next.kind === 'vacation_remove') void dispatch(fetchVacations());
    if (next.kind.startsWith('appointment_') || next.kind === 'customer_block') {
      if (userId) void dispatch(fetchAppointments({ user_id: userId, limit: 5000 }));
    }
    // LT-564: the services, the site's details, the owner's alerts.
    if ((next.kind === 'service_add' || next.kind === 'service_edit') && webConfig?._id) void dispatch(fetchAppointmentTypes({ webConfig_id: webConfig._id }));
    if (next.kind === 'business_details' && webConfig?._id) void dispatch(fetchWebConfig(webConfig._id));
    if (next.kind === 'alerts') void refreshUser();
  };

  const clear = async () => {
    setTurns([]);
    setError(null);
    await assistantService.clear().catch(() => undefined);
    inputRef.current?.focus();
  };

  const chips = (
    <div data-tour="lighty-chips" className={`flex gap-2 ${empty ? 'flex-wrap justify-center' : 'overflow-x-auto pb-1 [scrollbar-width:none]'}`}>
      {suggestions.map((s) => (
        <SuggestionChip
          key={s.key}
          suggestion={s}
          disabled={busy}
          onAsk={(text) => void send(text)}
          className="shrink-0 px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border-violet-200 dark:border-violet-800/60 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-50"
        />
      ))}
    </div>
  );

  return (
    <div
      className={`h-full max-w-3xl w-full mx-auto flex flex-col ${keyboardOpen ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0'}`}
      data-testid="lighty-page"
    >
      {/* Lighty himself: big on an empty conversation, small at the top once it runs. */}
      <header className={empty ? 'flex flex-col items-center text-center gap-2 pt-2 md:pt-8' : 'flex items-center gap-3 pb-3 border-b border-gray-200/70 dark:border-slate-700/60'}>
        <div className={`shrink-0 transition-all duration-500 ${empty ? 'w-44 h-48 md:w-52 md:h-56' : 'w-12 h-14'}`}>
          <Suspense fallback={null}>
            <Lighty3D thinking={busy} cheerKey={cheer} mood={momentum.mood} className="w-full h-full" />
          </Suspense>
        </div>
        <div className={empty ? 'max-w-md' : 'flex-1 min-w-0'}>
          <h1 className={`font-bold text-gray-800 dark:text-white ${empty ? 'text-2xl' : 'text-base'}`}>{empty ? t('lighty.hello') : 'Lighty'}</h1>
          <p className={`text-gray-500 dark:text-slate-400 ${empty ? 'mt-1 text-sm' : 'text-xs truncate'}`} aria-live="polite">
            {empty ? t('lighty.intro') : t('lighty.subtitle')}
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
        {!loaded && <LightyThreadLoading />}
        {empty && <div className="mt-2">{chips}</div>}
        {turns.map((turn, i) => turn.role === 'user' ? (
          <OwnerBubble key={i} images={turn.images}>{turn.content}</OwnerBubble>
        ) : (
          <React.Fragment key={i}>
          <LightyBubble>
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
          {turn.actions?.map((action) => (
            // On a phone as wide as the answer; wider screens keep the card compact (LT-562).
            <div key={action.id} className="ms-10 max-w-[85%] sm:max-w-sm">
              <LightyActionCard action={action} onChange={updateAction} />
            </div>
          ))}
          </React.Fragment>
        ))}
        {busy && <LightyTyping />}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
      </div>

      {!empty && turns.length > 0 && !busy && <div className="pb-2">{chips}</div>}

      {pictures.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2" data-testid="lighty-attached">
          {pictures.map((name) => (
            <div key={name} className="relative h-14 w-14 overflow-hidden rounded-xl bg-gray-100 dark:bg-slate-800">
              <img src={`${globals.imagesUrl}${name}`} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setPictures((all) => all.filter((n) => n !== name))}
                aria-label={t('lighty.attach.remove')}
                className="absolute end-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        data-tour="lighty-input"
        className="flex items-end gap-2 rounded-3xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-sm focus-within:ring-2 focus-within:ring-violet-300/50"
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
      >
        <label
          className={`w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-full text-gray-500 dark:text-slate-400 hover:text-primary hover:bg-violet-50 dark:hover:bg-slate-800 focus-within:ring-2 focus-within:ring-violet-300 ${attaching || busy || pictures.length >= MAX_PICTURES ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
        >
          {attaching ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-5 h-5" aria-hidden="true" />}
          <span className="sr-only">{t('lighty.attach.button')}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={attach}
            disabled={attaching || busy || pictures.length >= MAX_PICTURES}
            data-testid="lighty-attach"
          />
        </label>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={pasteFiles}
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
          disabled={busy || !loaded || attaching || (!input.trim() && !pictures.length)}
          aria-label={t('lighty.send')}
          className={`w-10 h-10 ${lightySendButton}`}
        >
          <LightySendIcon className="w-6 h-6" />
        </button>
      </form>
    </div>
  );
};

export default LightyPage;
