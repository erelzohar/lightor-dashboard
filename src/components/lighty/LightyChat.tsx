import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * LT-253 — Lighty's face and voice wherever the owner talks to the AI: the
 * Lighty page, the site editor's boxes, the floating button. The avatar is
 * the 3D Lighty rendered small (public/lighty-avatar.webp; casting while he
 * thinks, public/lighty-thinking.webp — the site editor's line only), so the
 * little one and the live one on his page are the same character.
 */

export const LightyAvatar: React.FC<{ size?: number; thinking?: boolean; className?: string }> = ({ size = 32, thinking = false, className = '' }) => (
  <span
    className={`relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-violet-100 via-white to-fuchsia-100 dark:from-violet-900/60 dark:via-slate-800 dark:to-fuchsia-900/40 ring-1 ring-violet-200/80 dark:ring-violet-700/50 ${className}`}
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <img src={thinking ? '/lighty-thinking.webp' : '/lighty-avatar.webp'} alt="" draggable={false} className="w-full h-full object-contain select-none" />
  </span>
);

/** The dashboard pages a reply may link to (the server keeps only these too). */
const PAGES = ['/appointments', '/customers', '/leads', '/schedule-vacations', '/appointment-types', '/settings', '/account', '/portfolio', '/design'];
const INLINE = /\[([^\]\n]{1,80})\]\(((?:[^()\s]|\([^()\s]*\)){1,200})\)|\*\*([^*\n]{1,200})\*\*/g;

// "09:00–10:00" in a right-to-left line reads backwards ("10:00–09:00"):
// a dash between two numbers takes the line's direction. Kept left to right.
// (A hyphen between digits already stays with them; an en or em dash does not.)
const RANGE = /(?<!\d)\d{1,2}(?::\d{2})?\s*[–—]\s*\d{1,2}(?::\d{2})?(?!\d)/g;
const ltrRanges = (text: string, keyBase: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(RANGE)) {
    if (m.index! > at) out.push(text.slice(at, m.index));
    out.push(<bdi key={`${keyBase}-r${m.index}`} dir="ltr">{m[0]}</bdi>);
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
};

const inline = (text: string, keyBase: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let at = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > at) out.push(...ltrRanges(text.slice(at, m.index), `${keyBase}-t${n}`));
    if (m[3] !== undefined) {
      // A link may sit inside the bold ("**[the hours](/schedule-vacations)**").
      out.push(<strong key={`${keyBase}-${n++}`} className="font-semibold">{inline(m[3], `${keyBase}-b${n}`)}</strong>);
    } else {
      const href = m[2];
      const ok = PAGES.includes(href.split(/[?#]/)[0]) && /^[\w/?=&.-]+$/.test(href);
      out.push(ok ? (
        <Link
          key={`${keyBase}-${n++}`}
          to={href}
          className="inline-flex items-center mx-0.5 px-2.5 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/60 border border-violet-200 dark:border-violet-700/60 text-violet-700 dark:text-violet-200 text-[0.8125rem] font-medium no-underline hover:bg-white dark:hover:bg-slate-900"
        >
          {m[1]}
        </Link>
      ) : m[1]);
    }
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push(...ltrRanges(text.slice(at), `${keyBase}-end`));
  return out;
};

/**
 * What Lighty wrote, safely: paragraphs, "- " lists, **bold**, and links to
 * the dashboard's own pages as in-app buttons. Never HTML.
 */
export const LightyText: React.FC<{ text: string }> = ({ text }) => {
  const blocks: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`ul-${blocks.length}`} className="my-1 ps-4 list-disc space-y-0.5">{list}</ul>);
    list = [];
  };
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const item = line.match(/^[-•*]\s+(.*)$/);
    if (item) { list.push(<li key={`li-${i}`}>{inline(item[1], `li-${i}`)}</li>); return; }
    flush();
    if (line) blocks.push(<p key={`p-${i}`} className="my-0.5">{inline(line, `p-${i}`)}</p>);
  });
  flush();
  return <div className="leading-relaxed break-words">{blocks}</div>;
};

/** Lighty's side of a conversation: his face, and a bubble. */
export const LightyBubble: React.FC<{ children: React.ReactNode; thinking?: boolean; avatar?: number; className?: string }> = ({ children, thinking = false, avatar = 32, className = '' }) => (
  <div className={`flex items-end gap-2 max-w-full ${className}`}>
    <LightyAvatar size={avatar} thinking={thinking} />
    <div className="min-w-0 max-w-[85%] rounded-2xl rounded-es-md bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/50 px-3 py-2 text-sm text-gray-800 dark:text-slate-100">
      {children}
    </div>
  </div>
);

/** The owner's side. */
export const OwnerBubble: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex justify-end">
    <div className="max-w-[85%] whitespace-pre-line break-words rounded-2xl rounded-ee-md bg-primary text-white px-3 py-2 text-sm">{children}</div>
  </div>
);

/**
 * Lighty is writing: three dots beside his still face. One animation per
 * screen (LT-258) — the moving Lighty is the 3D one on his page, the
 * editor line's face elsewhere — so the bubble's face keeps still.
 */
export const LightyTyping: React.FC<{ avatar?: number }> = ({ avatar = 32 }) => {
  const { t } = useTranslation();
  return (
    <LightyBubble avatar={avatar}>
      <span className="inline-flex items-center gap-1 py-1" role="status" aria-label={t('lighty.thinking')}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-300 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
    </LightyBubble>
  );
};
