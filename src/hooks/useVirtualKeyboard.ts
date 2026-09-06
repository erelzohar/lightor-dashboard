import { useEffect, useState } from 'react';

/**
 * Is the on-screen keyboard up? (LT-127)
 *
 * Fixed bottom chrome (the tab bar) must get out of the way while typing —
 * on iOS the layout viewport does not shrink for the keyboard, only the
 * visual viewport does, so a fixed bar would float above the keys covering
 * the field. A visual viewport at least a quarter shorter than the window
 * is the keyboard; nothing else in this app shrinks it that much. Browsers
 * without `visualViewport` (jsdom, very old WebViews) report "closed".
 */
export const useVirtualKeyboard = (): boolean => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setOpen(vv.height < window.innerHeight * 0.75);
    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return open;
};
