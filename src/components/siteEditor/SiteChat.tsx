import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { LightyAvatar, LightyBubble, LightyTyping, OwnerBubble } from '../lighty/LightyChat';
import { useTranslation } from 'react-i18next';
import { aiService, trimHistory, type AiSiteConfig, type ChatTurn } from '../../services/aiApi';
import { applyAiAnswer, changedLabels } from '../../utils/editorDiff';
import { fieldLabel } from './labels';
import { lightTick } from '../../lib/haptics';
import { LightyTyped } from '../lighty/LightyTyped';
import { LightySendIcon, lightySendButton } from '../lighty/LightySendIcon';
import { addImages, IMAGE_TYPES, MAX_IMAGES } from '../../lib/ownerImages';

/** A turn in the panel; an owner's may show the pictures it carried (never sent back as history). */
type Turn = ChatTurn & { images?: string[] };

type Service = { _id?: string; name?: string; image?: string };

/**
 * The draft's services, each with the picture the answer gave it (LT-426: a
 * chat picture the AI said shows one service). Everything else about the
 * services stays as the draft has it: the editor saves only their picture.
 */
const withServicePictures = (kept: unknown, answered: unknown): unknown => {
  if (!Array.isArray(kept) || !Array.isArray(answered)) return kept;
  return (kept as Service[]).map((service) => {
    const match = (answered as Service[]).find((a) => (service._id && a._id === service._id) || (!a._id && a.name === service.name));
    return match?.image && match.image !== service.image ? { ...service, image: match.image } : service;
  });
};

interface SiteChatProps<T> {
  config: T;
  /** Gets an updater: the answer lands on the draft as it is by then (LT-315). */
  onApply: (update: (prev: T) => T) => void;
  /** A request typed in the floating assistant before arriving here. */
  initialMessage?: string;
  /**
   * The floating request has been sent (LT-315). The editor forgets it then:
   * this panel re-mounts on every tab switch or field selection, and a ref
   * here reset with it, so the same whole-site rewrite ran again each time.
   */
  onInitialMessageSent?: () => void;
}

/**
 * LT-249: today's whole-site AI chat, moved into the editor's page panel
 * (LT-253: a conversation with Lighty; LT-256: his line at the top of the
 * design tab, staying there while it scrolls).
 * The answer lands on the draft (one undo step) and the owner is told what
 * changed — only the parts it changed, on the draft as it is when it
 * arrives (LT-315: replacing the whole draft undid edits made meanwhile). Services, vacations and booking questions stay as the draft has
 * them: the editor does not save those, so the preview must not show them
 * changed either.
 */
function SiteChat<T>({ config, onApply, initialMessage, onInitialMessageSent }: SiteChatProps<T>) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Turn[]>([]);
  const [fresh, setFresh] = useState<ChatTurn | null>(null); // types out (LT-271)
  // LT-426: up to three pictures for the next message - chosen, pasted or
  // dropped on the chat. The AI says what each is and the server places it.
  const [images, setImages] = useState<File[]>([]);
  const [imagesRefused, setImagesRefused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const thumbs = useMemo(
    () => images.map((file) => (typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '')),
    [images]
  );
  // A sent message keeps its thumbnails for the chat's life; the URLs go with the panel.
  const sentThumbs = useRef<string[]>([]);
  useEffect(() => () => thumbs.forEach((url) => url && !sentThumbs.current.includes(url) && URL.revokeObjectURL(url)), [thumbs]);
  useEffect(() => () => sentThumbs.current.forEach((url) => url && URL.revokeObjectURL(url)), []);
  const takeImages = (files: File[]) => {
    if (busy || !files.length) return;
    const added = addImages(images, files);
    setImages(added.images);
    setImagesRefused(added.refused);
  };
  const dropImage = (index: number) => {
    setImages((list) => list.filter((_, i) => i !== index));
    setImagesRefused(false);
  };
  const listRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const latest = useRef(config);
  useEffect(() => { latest.current = config; }, [config]);

  const send = async (prompt: string, attached: File[] = []) => {
    // Pictures alone are a request too: put them on the site.
    const ask = prompt.trim() || (attached.length ? t('siteEditor.chat.picturesOnly') : '');
    if (!ask || busy) return;
    setInput('');
    const history = trimHistory(messages).map(({ role, content }) => ({ role, content }));
    const shown = attached.length ? thumbs.slice(0, attached.length) : undefined;
    if (shown) sentThumbs.current.push(...shown);
    setImages([]);
    setImagesRefused(false);
    setMessages((m) => [...m, { role: 'user', content: prompt.trim(), ...(shown ? { images: shown } : {}) }]);
    setBusy(true);
    try {
      const before = latest.current as unknown as AiSiteConfig;
      const result = await aiService.editSite(ask, before, attached, history);
      const kept = before as Record<string, unknown>;
      const next = {
        ...result.config,
        appointmentTypes: withServicePictures(kept.appointmentTypes, result.config.appointmentTypes),
        vacations: kept.vacations,
        bookingFields: kept.bookingFields,
        leadFields: kept.leadFields,
      } as unknown as T;
      const changed = changedLabels(before, next, (p) => fieldLabel(t, p), t('siteEditor.chat.look'));
      onApply((prev) => applyAiAnswer(prev, before as unknown as T, next));
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
      onInitialMessageSent?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  return (
    // Two siblings (the line in the panel itself), so the line stays on top.
    <>
      <div
        className={`sticky -top-4 z-10 -mx-4 px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b ${dragging ? 'border-violet-400 ring-2 ring-inset ring-violet-300/60' : 'border-violet-100 dark:border-violet-900/40'}`}
        data-testid="site-chat"
        aria-label={t('siteEditor.chat.title')}
        onDragOver={(e) => { if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(e) => {
          if (!e.dataTransfer?.files?.length) return;
          e.preventDefault();
          setDragging(false);
          takeImages(Array.from(e.dataTransfer.files));
        }}
      >
        {images.length > 0 && (
          <div className="flex items-center gap-2 mb-2 ps-11" data-testid="site-chat-images">
            {images.map((file, i) => (
              <div key={`${file.name}-${i}`} className="relative">
                <img src={thumbs[i]} alt="" className="w-11 h-11 rounded-lg object-cover border border-violet-100 dark:border-violet-900/50" />
                <button
                  type="button"
                  onClick={() => dropImage(i)}
                  aria-label={t('siteEditor.chat.removeImage', { name: file.name })}
                  className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center shadow"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
        {(dragging || imagesRefused) && (
          <p className="mb-2 ps-11 text-xs text-violet-700 dark:text-violet-300" role="status">
            {dragging ? t('siteEditor.chat.dropImages', { count: MAX_IMAGES }) : t('siteEditor.chat.imagesLimit', { count: MAX_IMAGES })}
          </p>
        )}
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(input, images); }}>
          <LightyAvatar size={36} thinking={busy} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData?.files ?? []).filter((f) => IMAGE_TYPES.includes(f.type));
              if (!files.length) return;
              e.preventDefault();
              takeImages(files);
            }}
            placeholder={t('siteEditor.chat.placeholder')}
            aria-label={t('siteEditor.chat.placeholder')}
            className="flex-1 min-w-0 rounded-full border border-violet-200 dark:border-violet-800/60 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300/50"
          />
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="site-chat-file"
            onChange={(e) => { takeImages(Array.from(e.target.files ?? [])); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy || images.length >= MAX_IMAGES}
            aria-label={t('siteEditor.chat.addImages', { count: MAX_IMAGES })}
            title={t('siteEditor.chat.addImages', { count: MAX_IMAGES })}
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-40 transition-colors"
          >
            <ImagePlus className="w-5 h-5" aria-hidden="true" />
          </button>
          <button type="submit" disabled={busy || (!input.trim() && !images.length)} aria-label={t('siteEditor.ai.send')} className={`w-9 h-9 ${lightySendButton}`}>
            <LightySendIcon />
          </button>
        </form>
      </div>
      {messages.length > 0 && (
        <div ref={listRef} className="flex flex-col gap-2 max-h-72 overflow-y-auto">
          {messages.map((m, i) => (m.role === 'user'
            ? (
              <OwnerBubble key={i}>
                {m.images?.length ? (
                  <span className={`flex gap-1 ${m.content ? 'mb-1' : ''}`}>
                    {m.images.map((url, k) => <img key={k} src={url} alt="" className="w-10 h-10 rounded-md object-cover" />)}
                  </span>
                ) : null}
                {m.content}
              </OwnerBubble>
            )
            : <LightyBubble key={i}><LightyTyped text={m.content} animate={m === fresh} onType={() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }} /></LightyBubble>))}
        </div>
      )}
      {busy && <LightyTyping />}
    </>
  );
}

export default SiteChat;
