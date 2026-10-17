import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';
const now = (): boolean =>
  typeof window === 'undefined' ? false : window.matchMedia ? window.matchMedia(QUERY).matches : window.innerWidth < 768;

/**
 * Below Tailwind's `md` (LT-380): where the phone's tab bar shows. Follows
 * resizes and rotation. Without matchMedia (jsdom) it reads the width.
 */
export const useIsPhone = (): boolean => {
  const [phone, setPhone] = useState(now);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return phone;
};
