import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FloatingAiAssistantProps {
  onSend: (message: string) => void;
  direction?: 'ltr' | 'rtl';
}

export function FloatingAiAssistant({ onSend, direction = 'ltr' }: FloatingAiAssistantProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [message, setMessage] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  const { t } = useTranslation();
  const isRtl = direction === 'rtl';

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setMessage('');
    setIsChatOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
      {/* Chat panel */}
      {isChatOpen && (
        <div
          ref={chatRef}
          className={`absolute bottom-20 w-[340px] max-w-[calc(100vw-3rem)] transition-all duration-300 ${
            isRtl ? 'left-0 origin-bottom-left' : 'right-0 origin-bottom-right'
          }`}
          style={{ animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
          dir={direction}
        >
          <div className="relative flex flex-col rounded-3xl bg-gradient-to-br from-zinc-800/80 to-zinc-900/90 border border-zinc-500/50 shadow-2xl backdrop-blur-3xl overflow-hidden">

            {/* Overlay gradient */}
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), transparent, rgba(147,51,234,0.06))' }}
            />

            {/* Header */}
            <div className="relative flex items-center justify-between px-5 pt-4 pb-2 z-10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-zinc-400">{t('floatingAssistant.label')}</span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-700/50 transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Textarea */}
            <div className="relative px-1 z-10">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                className="w-full px-5 py-3 bg-transparent border-none outline-none resize-none text-sm leading-relaxed text-zinc-100 placeholder-zinc-500 break-words overflow-wrap-anywhere"
                style={{ scrollbarWidth: 'none', overflowWrap: 'anywhere' }}
                placeholder="Ask me anything about your site..."
              />
            </div>

            {/* Send row */}
            <div className="relative px-4 pb-4 z-10">
              <div className={`flex items-center ${isRtl ? 'justify-start' : 'justify-end'}`}>
                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className="group p-3 bg-gradient-to-r from-violet-600 to-purple-500 rounded-xl text-white shadow-lg hover:from-violet-500 hover:to-purple-400 hover:scale-105 hover:shadow-purple-500/30 hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <Send className="w-4 h-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        className={`floating-ai-button relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ${
          isChatOpen ? 'rotate-90' : 'rotate-0'
        }`}
        onClick={() => setIsChatOpen((prev) => !prev)}
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.85) 0%, rgba(168,85,247,0.85) 100%)',
          boxShadow: '0 0 20px rgba(139,92,246,0.7), 0 0 40px rgba(124,58,237,0.5), 0 0 60px rgba(109,40,217,0.3)',
          border: '2px solid rgba(255,255,255,0.2)',
        }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-30" />
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="relative z-10">
          {isChatOpen ? <X className="w-6 h-6 text-white" /> : <Bot className="w-7 h-7 text-white" />}
        </div>
        <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-indigo-500" />
      </button>
    </div>
  );
}
