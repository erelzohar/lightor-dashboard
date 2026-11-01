import { describe, it, expect, afterEach, vi } from 'vitest';
import { runMotionInJsOnAndroid } from '../../lib/androidMotion';

/** What framer asks to choose native animations (supports-waapi.mjs). */
const framerSeesNative = () => Object.hasOwnProperty.call(Element.prototype, 'animate');

describe('motion on Android (LT-509)', () => {
  const animate = vi.fn();

  const setUp = (userAgent: string) => {
    Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true });
    vi.stubGlobal('navigator', { ...navigator, userAgent });
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (Element.prototype as { animate?: unknown }).animate;
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
    delete (SVGElement.prototype as { animate?: unknown }).animate;
  });

  it('hides native animations from framer on Android, and element.animate still works', () => {
    setUp('Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/133.0 Mobile Safari/537.36');
    runMotionInJsOnAndroid();
    expect(framerSeesNative()).toBe(false);
    document.createElement('div').animate([], 100);
    document.createElementNS('http://www.w3.org/2000/svg', 'circle').animate([], 100);
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('leaves an iPhone and a desktop as they are', () => {
    setUp('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15');
    runMotionInJsOnAndroid();
    expect(framerSeesNative()).toBe(true);
  });
});
