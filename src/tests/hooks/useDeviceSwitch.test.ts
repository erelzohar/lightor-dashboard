import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SWITCH_FADE_MS, SWITCH_SETTLE_MS, switchFade, useDeviceSwitch } from '../../hooks/useDeviceSwitch';

/** LT-320: the preview changes size unseen — fade out, resize, settle, fade in. */
describe('switching the preview between computer and phone', () => {
  afterEach(() => vi.useRealTimers());

  it('marks the button at once, resizes only once hidden, and shows the site after it settled', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDeviceSwitch<'desktop' | 'phone'>('desktop'));
    act(() => result.current.switchTo('phone'));
    expect(result.current).toMatchObject({ picked: 'phone', device: 'desktop', hidden: true });

    act(() => { vi.advanceTimersByTime(SWITCH_FADE_MS); });
    expect(result.current).toMatchObject({ device: 'phone', hidden: true });

    act(() => { vi.advanceTimersByTime(SWITCH_SETTLE_MS); });
    expect(result.current).toMatchObject({ device: 'phone', hidden: false });
  });

  it('follows the last click when the owner changes their mind mid-switch', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDeviceSwitch<'desktop' | 'phone'>('desktop'));
    act(() => result.current.switchTo('phone'));
    act(() => result.current.switchTo('desktop'));
    expect(result.current).toMatchObject({ picked: 'desktop', device: 'desktop', hidden: false });
    act(() => { vi.advanceTimersByTime(SWITCH_FADE_MS + SWITCH_SETTLE_MS); });
    expect(result.current).toMatchObject({ device: 'desktop', hidden: false });
  });

  it('hides the frame with a short fade', () => {
    expect(switchFade(true)).toEqual({ opacity: 0, transition: `opacity ${SWITCH_FADE_MS}ms ease` });
    expect(switchFade(false).opacity).toBe(1);
  });
});
