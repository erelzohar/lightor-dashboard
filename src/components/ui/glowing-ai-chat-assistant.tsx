import { useState, useRef, useEffect } from 'react';
import { Send, X, ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LightyAvatar, LightyBubble } from '../lighty/LightyChat';

interface FloatingAiAssistantProps {
  /** A question for Lighty: his page opens and sends it. */
  onSend: (message: string) => void;
  /** Open Lighty's page without a question. */
  onOpenPage?: () => void;
  direction?: 'ltr' | 'rtl';
}

const QUICK = ['today', 'week', 'leads'] as const;

/**
 * LT-253: Lighty, a tap away on every page — his face on the button; a short
 * card with his greeting, two or three ready questions and a box to ask your
 * own. A question goes to his page, where the answer comes.
 */
export function FloatingAiAssistant({ onSend, onOpenPage, direction = 'ltr' }: FloatingAiAssistantProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
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
          className={`absolute bottom-20 w-[340px] max-w-[calc(100vw-3rem)] ${isRtl ? 'left-0 origin-bottom-left' : 'right-0 origin-bottom-right'}`}
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
            <form className="flex items-end gap-2 rounded-2xl border border-gray-200 dark:border-slate-700 p-1.5" onSubmit={(e) => { e.preventDefault(); ask(message); }}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    ask(message);
                  }
                }}
                rows={2}
                maxLength={1000}
                placeholder={t('lighty.placeholder')}
                aria-label={t('lighty.placeholder')}
                className="flex-1 min-w-0 resize-none bg-transparent px-2 py-1.5 text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!message.trim()}
                aria-label={t('lighty.send')}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-r from-primary to-violet-500 text-white disabled:opacity-40"
              >
                <Send className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        className="floating-ai-button relative w-14 h-14 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 shadow-[0_8px_24px_rgba(124,58,237,0.35)] ring-2 ring-violet-200 dark:ring-violet-700/60 transition-transform duration-300 hover:scale-105 active:scale-95"
        onClick={() => setIsChatOpen((prev) => !prev)}
        aria-label={isChatOpen ? t('lighty.close') : t('lighty.ask')}
        aria-expanded={isChatOpen}
      >
        {isChatOpen ? <X className="w-6 h-6 text-violet-600" /> : <LightyAvatar size={52} className="ring-0" />}
        {!isChatOpen && <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-violet-400 pointer-events-none" aria-hidden="true" />}
      </button>
    </div>
  );
}
