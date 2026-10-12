import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { X, ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LightyAvatar, LightyBubble } from '../lighty/LightyChat';
import { LightySendIcon, lightySendButton } from '../lighty/LightySendIcon';

// three.js and the 1.8 MB model load after the page, never in its way.
const Lighty3D = lazy(() => import('../lighty/Lighty3D'));

interface FloatingAiAssistantProps {
  /** A question for Lighty: his page opens and sends it. */
  onSend: (message: string) => void;
  /** Open Lighty's page without a question. */
  onOpenPage?: () => void;
  direction?: 'ltr' | 'rtl';
  /** Said in his speech bubble while the card is closed (the home page's greeting, LT-269). */
  greeting?: string;
}

const QUICK = ['today', 'week', 'leads'] as const;

// His greeting says hello, then gets out of the way (LT-283).
export const GREETING_MS = 5000;
const GREETING_FADE_MS = 350;

/**
 * LT-253: Lighty, a tap away on every page; a short card with his greeting,
 * two or three ready questions and a box to ask your own. A question goes to
 * his page, where the answer comes.
 * LT-269: the button is the 3D Lighty himself (his 2D face stands in until
 * the model is on screen, or for good without WebGL), and on the home page he
 * talks — a speech bubble with the greeting the page used to print at its top.
 * Tapping him or the bubble opens the card, as before.
 */
export function FloatingAiAssistant({ onSend, onOpenPage, direction = 'ltr', greeting }: FloatingAiAssistantProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  // 'on' → 'fading' after GREETING_MS → 'off'. Each arrival on the page that
  // carries a greeting (the home page) says it again.
  const [bubble, setBubble] = useState<'on' | 'fading' | 'off'>('on');
  useEffect(() => {
    if (!greeting) return;
    setBubble('on');
    const fade = setTimeout(() => setBubble('fading'), GREETING_MS);
    const gone = setTimeout(() => setBubble('off'), GREETING_MS + GREETING_FADE_MS);
    return () => { clearTimeout(fade); clearTimeout(gone); };
  }, [greeting]);
  const [message, setMessage] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const isRtl = direction === 'rtl';
  const Open = isRtl ? ArrowUpLeft : ArrowUpRight;

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setMessage('');
    setIsChatOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        chatRef.current &&
        !chatRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('.floating-ai-button')
      ) {
        setIsChatOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      // Phones: sit above the BottomTabBar + home indicator (LT-127); md+ has no bar.
      className={`fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 z-50 ${isRtl ? 'left-6' : 'right-6'}`}
    >
      {isChatOpen && (
        <div
          ref={chatRef}
          className={`absolute bottom-[6.5rem] w-[340px] max-w-[calc(100vw-3rem)] ${isRtl ? 'left-0 origin-bottom-left' : 'right-0 origin-bottom-right'}`}
          style={{ animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
          dir={direction}
          role="dialog"
          aria-label="Lighty"
        >
          <div className="flex flex-col gap-3 rounded-3xl bg-white dark:bg-slate-900 border border-violet-100 dark:border-violet-900/50 shadow-2xl p-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800 dark:text-white">Lighty</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="flex-1" />
              {onOpenPage && (
                <button
                  type="button"
                  onClick={() => { setIsChatOpen(false); onOpenPage(); }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline"
                >
                  {t('lighty.openPage')}
                  <Open className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
              <button type="button" onClick={() => setIsChatOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800" aria-label={t('lighty.close')}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <LightyBubble avatar={36}>{t('lighty.floatingHello')}</LightyBubble>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => ask(t(`lighty.suggest.${key}`))}
                  className="px-3 py-1.5 rounded-full text-xs bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800/50 text-violet-700 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/50"
                >
                  {t(`lighty.suggest.${key}`)}
                </button>
              ))}
            </div>
            <form className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-slate-700 p-1.5" onSubmit={(e) => { e.preventDefault(); ask(message); }}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    ask(message);
                  }
                }}
                // One line (LT-277); grows only for a long question, like his page's box.
                rows={1}
                maxLength={1000}
                placeholder={t('lighty.placeholder')}
                aria-label={t('lighty.placeholder')}
                className="flex-1 min-w-0 max-h-24 resize-none bg-transparent px-2 py-2 text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none [field-sizing:content]"
              />
              <button
                type="submit"
                disabled={!message.trim()}
                aria-label={t('lighty.send')}
                className={`w-9 h-9 ${lightySendButton}`}
              >
                <LightySendIcon />
              </button>
            </form>
          </div>
        </div>
      )}

      {greeting && !isChatOpen && bubble !== 'off' && (
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          dir={direction}
          className={`floating-ai-button absolute bottom-14 ${isRtl ? 'left-[4.75rem]' : 'right-[4.75rem]'} w-max max-w-[min(240px,calc(100vw-8rem))] px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-violet-100 dark:border-violet-900/50 shadow-lg text-sm font-semibold text-gray-800 dark:text-white text-start`}
          style={{
            animation: bubble === 'fading'
              ? `lightyBubbleOut ${GREETING_FADE_MS}ms ease-in forwards`
              : 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          }}
          data-testid="lighty-greeting"
        >
          {greeting}
          {/* the tail, pointing at Lighty */}
          <span
            aria-hidden="true"
            className={`absolute bottom-3 w-3 h-3 rotate-45 bg-white dark:bg-slate-900 border-violet-100 dark:border-violet-900/50 ${isRtl ? '-left-1.5 border-b border-l' : '-right-1.5 border-t border-r'}`}
          />
        </button>
      )}

      <button
        type="button"
        className="floating-ai-button relative block w-20 h-24 transition-transform duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-2xl"
        onClick={() => setIsChatOpen((prev) => !prev)}
        aria-label={isChatOpen ? t('lighty.close') : t('lighty.ask')}
        aria-expanded={isChatOpen}
      >
        {!modelReady && (
          <span className="absolute inset-x-0 bottom-1 flex justify-center">
            <span className="w-14 h-14 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 shadow-[0_8px_24px_rgba(124,58,237,0.35)] ring-2 ring-violet-200 dark:ring-violet-700/60">
              <LightyAvatar size={52} className="ring-0" />
            </span>
          </span>
        )}
        <Suspense fallback={null}>
          <Lighty3D
            thinking={false}
            cheerKey={0}
            onReady={() => setModelReady(true)}
            className="absolute inset-0 pointer-events-none drop-shadow-[0_6px_10px_rgba(124,58,237,0.35)]"
          />
        </Suspense>
      </button>
    </div>
  );
}
