import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the preview takes to fade out, and how long the site inside gets to settle unseen. */
export const SWITCH_FADE_MS = 150;
export const SWITCH_SETTLE_MS = 300;

/**
 * LT-320: switching the preview between the computer and the phone resized
 * the frame at once, and the site inside laid itself out again in plain view
 * (a tester: "stuck, like a glitch"). Now the frame fades out, takes its new
 * size unseen, gives the site a moment to settle, and fades back in.
 * `picked` is what the buttons show; `device` is the size the frame has.
 */
export function useDeviceSwitch<T extends string>(initial: T) {
  const [device, setDevice] = useState<T>(initial);
  const [picked, setPicked] = useState<T>(initial);
  const [hidden, setHidden] = useState(false);
  const timers = useRef<number[]>([]);
  const deviceRef = useRef(device);
  deviceRef.current = device;

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const switchTo = useCallback((next: T) => {
    setPicked(next);
    clear();
    if (next === deviceRef.current) {
      setHidden(false);
      return;
    }
    setHidden(true);
    timers.current.push(window.setTimeout(() => {
      setDevice(next);
      timers.current.push(window.setTimeout(() => setHidden(false), SWITCH_SETTLE_MS));
    }, SWITCH_FADE_MS));
  }, []);

  return { device, picked, hidden, switchTo };
}

/** The frame's style while it switches: hidden, with a short fade either way. */
export const switchFade = (hidden: boolean): { opacity: number; transition: string } => ({
  opacity: hidden ? 0 : 1,
  transition: `opacity ${SWITCH_FADE_MS}ms ease`,
});
