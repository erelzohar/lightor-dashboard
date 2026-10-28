import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';

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
// (A hyphen between digits already stays with them; an en or em dash does not,
// nor a spaced hyphen, which is what the server makes of an em-dash (LT-350).)
// No lookbehind assertion (LT-315): WebKit before 16.4 cannot parse one, esbuild
// turns the literal into a top-level `new RegExp` in the main chunk, and the
// whole dashboard — the iOS 15 app included — died on a SyntaxError at load.
// "Not after a digit" is the leading `(^|\D)` group instead; the range itself
// is group 2 and starts `m[1].length` past the match. A match always ends on a
// digit and `(?!\d)` consumes nothing, so the next range's leading non-digit
// is never eaten by the previous match.
const RANGE = /(^|\D)(\d{1,2}(?::\d{2})?\s*[–—-]\s*\d{1,2}(?::\d{2})?)(?!\d)/g;
const ltrRanges = (text: string, keyBase: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(RANGE)) {
    const start = m.index! + m[1].length;
    if (start > at) out.push(text.slice(at, start));
    out.push(<bdi key={`${keyBase}-r${start}`} dir="ltr">{m[2]}</bdi>);
    at = start + m[2].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
};

type LinkClick = (event: React.MouseEvent<HTMLAnchorElement>, to: string) => void;

const inline = (text: string, keyBase: string, onLinkClick: LinkClick): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let at = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > at) out.push(...ltrRanges(text.slice(at, m.index), `${keyBase}-t${n}`));
    if (m[3] !== undefined) {
      // A link may sit inside the bold ("**[the hours](/schedule-vacations)**").
      out.push(<strong key={`${keyBase}-${n++}`} className="font-semibold">{inline(m[3], `${keyBase}-b${n}`, onLinkClick)}</strong>);
    } else {
      const href = m[2];
      const ok = PAGES.includes(href.split(/[?#]/)[0]) && /^[\w/?=&.-]+$/.test(href);
      out.push(ok ? (
        <Link
          key={`${keyBase}-${n++}`}
          to={href}
          onClick={(event) => onLinkClick(event, href)}
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
  // In the site editor's chat a link leaves the editor: unsaved work asks first (LT-267).
  const { guardLinkClick } = useLeaveGuard();
  const blocks: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`ul-${blocks.length}`} className="my-1 ps-4 list-disc space-y-0.5">{list}</ul>);
    list = [];
  };
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const item = line.match(/^[-•*]\s+(.*)$/);
    if (item) { list.push(<li key={`li-${i}`}>{inline(item[1], `li-${i}`, guardLinkClick)}</li>); return; }
    flush();
    if (line) blocks.push(<p key={`p-${i}`} className="my-0.5">{inline(line, `p-${i}`, guardLinkClick)}</p>);
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
 * The conversation so far is on its way (LT-479, Erel): a few bubbles in
 * Lighty's and the owner's colours, pulsing gently, and a line that says so.
 * Only while it loads; still under reduced motion.
 */
export const LightyThreadLoading: React.FC = () => {
  const { t } = useTranslation();
  const line = 'h-2.5 rounded-full bg-violet-200/80 dark:bg-violet-800/50';
  const lightyRow = (widths: string[], bubble: string) => (
    <div className="flex items-end gap-2" aria-hidden="true">
      <LightyAvatar size={32} />
      <div className={`${bubble} space-y-2 rounded-2xl rounded-es-md bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/50 px-3 py-3`}>
        {widths.map((width, i) => <div key={i} className={`${line} ${width}`} />)}
      </div>
    </div>
  );
  return (
    <div role="status" data-testid="lighty-thread-loading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 motion-safe:animate-pulse">
        {lightyRow(['w-full', 'w-2/3'], 'w-3/5')}
        <div className="flex justify-end" aria-hidden="true">
          <div className="w-2/5 h-9 rounded-2xl rounded-ee-md bg-primary/20" />
        </div>
        {lightyRow(['w-full', 'w-full', 'w-1/2'], 'w-3/4')}
      </div>
      <p className="text-xs text-center text-gray-400 dark:text-slate-500">{t('lighty.loadingThread')}</p>
    </div>
  );
};

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
