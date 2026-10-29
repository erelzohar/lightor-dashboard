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
 *
 * LT-485: newer iOS Safari shrinks the window with the keyboard too, so the
 * window was never a quarter taller and the keyboard never "opened" (the room
 * kept for the tab bar stayed, a black band above the keys). The measure is
 * the tallest height seen at this width instead; turning the phone starts it
 * again.
 */
export const useVirtualKeyboard = (): boolean => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let width = window.innerWidth;
    let tallest = 0;
    const onResize = () => {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        tallest = 0;
      }
      tallest = Math.max(tallest, window.innerHeight, vv.height);
      setOpen(vv.height < tallest * 0.75);
    };
    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return open;
};
