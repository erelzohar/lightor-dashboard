import { useEffect, useState } from 'react';

const QUERY = '(min-width: 1024px)';
const now = (): boolean =>
  typeof window === 'undefined' ? true : window.matchMedia ? window.matchMedia(QUERY).matches : window.innerWidth >= 1024;

/**
 * Tailwind's `lg` and up (LT-627): where a page's desktop side panel shows.
 * Below it such a panel was drawn anyway and only hidden by CSS. Follows
 * resizes and rotation. Without matchMedia (jsdom) it reads the width.
 */
export const useIsWide = (): boolean => {
  const [wide, setWide] = useState(now);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return wide;
};
