/**
 * LT-509: on a real Android phone every framer animation that runs natively
 * (WAAPI: opacity and whole-string transforms) showed one frame of its old
 * state at the end. Filmed at 60 fps, the dim under the "More" menu and the
 * menu's sheet each jump for one frame when they land, on every open and
 * close. Desktop Chrome and the Android emulator do not reproduce it, so the
 * cause inside the phone's browser is unknown; the jump is always at the end
 * of a native animation.
 *
 * framer picks native animations with `Element.prototype.hasOwnProperty('animate')`,
 * and otherwise writes the style every frame itself, which has no last step
 * to flash. So `animate` moves one level down: framer no longer sees it, and
 * anything else that calls `element.animate()` still works.
 *
 * Must run before the first animation: framer remembers the answer.
 */
export const runMotionInJsOnAndroid = (): void => {
  if (!/Android/i.test(navigator.userAgent)) return;
  const animate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
  if (!animate) return;
  delete (Element.prototype as { animate?: unknown }).animate;
  Object.defineProperty(HTMLElement.prototype, 'animate', animate);
  Object.defineProperty(SVGElement.prototype, 'animate', animate);
};
