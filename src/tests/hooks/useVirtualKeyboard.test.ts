import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualKeyboard } from '../../hooks/useVirtualKeyboard';

/**
 * LT-485 (Erel's iPhone): newer iOS Safari shrinks the window along with the
 * keyboard, so "a quarter shorter than the window" never held and the room
 * kept for the tab bar stayed above the keys. A stand-in visual viewport.
 */
const listeners = new Set<() => void>();
const viewport = { height: 760, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) };
const had = Object.getOwnPropertyDescriptor(window, 'visualViewport');
const size = (width: number, inner: number, visible: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: inner });
  viewport.height = visible;
  act(() => listeners.forEach((fn) => fn()));
};
const start = (width: number, height: number) => {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  viewport.height = height;
  return renderHook(() => useVirtualKeyboard());
};

afterEach(() => {
  listeners.clear();
  if (had) Object.defineProperty(window, 'visualViewport', had);
  else delete (window as { visualViewport?: unknown }).visualViewport;
});

describe('useVirtualKeyboard', () => {
  it('sees the keyboard when only the visible part shrinks (the app, older iOS)', () => {
    const { result } = start(402, 760);
    expect(result.current).toBe(false);
    size(402, 760, 420);
    expect(result.current).toBe(true);
    size(402, 760, 760);
    expect(result.current).toBe(false);
  });

  it('sees the keyboard when the window shrinks with it (newer iOS Safari)', () => {
    const { result } = start(402, 760);
    size(402, 438, 404);
    expect(result.current).toBe(true);
    size(402, 760, 760);
    expect(result.current).toBe(false);
  });

  it("takes the browser's bars folding away for no keyboard", () => {
    const { result } = start(402, 690);
    size(402, 760, 760);
    size(402, 690, 690);
    expect(result.current).toBe(false);
  });

  it('measures again after the phone turns', () => {
    const { result } = start(402, 760);
    size(874, 330, 330);
    expect(result.current).toBe(false);
    size(874, 330, 200);
    expect(result.current).toBe(true);
  });
});
