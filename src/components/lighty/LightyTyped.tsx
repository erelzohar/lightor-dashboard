import React, { useEffect, useRef, useState } from 'react';
import { LightyText } from './LightyChat';

/**
 * Lighty writes his answer out (LT-271) instead of dropping it in whole — the
 * way every AI chat does. The API returns the full answer at once; this is
 * presentation only.
 *
 * Fast enough not to make anyone wait: at least 70 characters a second, and
 * never longer than 2.5 s however long the answer. Reduced motion shows it
 * whole. A hidden tab pauses the frames; coming back finishes the line.
 */
const MIN_CPS = 70;
const MAX_SECONDS = 2.5;

/** Tests read the finished text; the typing has its own test (see setup.ts). */
export const typewriterConfig = { enabled: true };

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

// The same tokens LightyText draws: [label](/page) and **bold**.
const INLINE = /\[([^\]\n]{1,80})\]\(((?:[^()\s]|\([^()\s]*\)){1,200})\)|\*\*([^*\n]{1,200})\*\*/g;

/**
 * The first `n` characters of Lighty's markdown, never broken mid-token: a
 * link (an in-app button) appears whole once it is reached, and half-typed
 * bold is closed so it reads bold as it grows instead of showing "**".
 */
export function revealMarkdown(text: string, n: number): string {
  if (n >= text.length) return text;
  if (n <= 0) return '';
  for (const m of text.matchAll(INLINE)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (n <= start) break;
    if (n >= end) continue;
    if (m[3] === undefined) return text.slice(0, start);
    if (n - start <= 2) return text.slice(0, start);
    const typed = revealMarkdown(m[3], n - start - 2);
    return typed ? `${text.slice(0, start)}**${typed}**` : text.slice(0, start);
  }
  return text.slice(0, n);
}

/** How many characters to show now; `onType` runs after each step (to keep the list scrolled). */
export function useTypewriter(text: string, animate: boolean, onType?: () => void): number {
  const run = animate && typewriterConfig.enabled && !prefersReducedMotion();
  const [shown, setShown] = useState(run ? 0 : text.length);
  const onTypeRef = useRef(onType);
  onTypeRef.current = onType;

  useEffect(() => {
    if (!run) return;
    setShown(0);
    const cps = Math.max(MIN_CPS, text.length / MAX_SECONDS);
    let raf = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const next = Math.min(text.length, Math.ceil(((now - start) / 1000) * cps));
      setShown(next);
      onTypeRef.current?.();
      if (next < text.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, run]);

  return run ? shown : text.length;
}

interface LightyTypedProps {
  text: string;
  /** Only an answer that just arrived types; history and older answers show whole. */
  animate: boolean;
  /** Lighty's markdown (default) or plain text (the editor's AI box). */
  plain?: boolean;
  onType?: () => void;
}

/**
 * An answer from Lighty, typed out. While it types, screen readers get the
 * whole answer once (sr-only) rather than every partial line.
 */
export const LightyTyped: React.FC<LightyTypedProps> = ({ text, animate, plain = false, onType }) => {
  const shown = useTypewriter(text, animate, onType);
  const draw = (value: string) => (plain ? value : <LightyText text={value} />);
  if (shown >= text.length) return <>{draw(text)}</>;
  const partial = plain ? text.slice(0, shown) : revealMarkdown(text, shown);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{draw(partial)}</span>
    </>
  );
};
