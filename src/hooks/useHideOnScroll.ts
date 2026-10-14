import { useEffect, useState } from 'react';

/**
 * LT-342: true while the owner is scrolling down — the phone's floating tab
 * bar steps out of the way, and comes back on a scroll up, near the top, or a
 * new page (`resetKey`). Any scroller counts, not only the page's: the
 * calendar scrolls inside its own box (LT-307). A horizontal strip moves no
 * scrollTop, so it never hides the bar.
 */
export const HIDE_AFTER_PX = 24; // near the top the bar always shows
const STEP_PX = 6; // smaller moves are a finger's jitter, not a direction

export function useHideOnScroll(resetKey?: unknown): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => { setHidden(false); }, [resetKey]);

  useEffect(() => {
    const last = new WeakMap<Element, number>();
    const onScroll = (event: Event) => {
      const el = event.target === document ? document.scrollingElement : event.target;
      if (!(el instanceof Element)) return;
      const top = el.scrollTop;
      const prev = last.get(el);
      last.set(el, top);
      if (top < HIDE_AFTER_PX) { setHidden(false); return; }
      if (prev === undefined) return;
      const dy = top - prev;
      if (dy > STEP_PX) setHidden(true);
      else if (dy < -STEP_PX) setHidden(false);
    };
    // Scroll events do not bubble; capture sees every scroller's.
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  return hidden;
}
