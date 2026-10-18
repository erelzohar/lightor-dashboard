/**
 * Where a tour step points (LT-389). Kept apart so tests can stand in for
 * layout, which jsdom does not do.
 */

/** On screen: laid out with a size, and not hidden by CSS. */
export const isVisible = (el: Element): boolean => {
  if (!(el instanceof HTMLElement) || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05;
};

/** The first visible element for any of these selectors, in their order. */
export const findTarget = (selectors: string[]): HTMLElement | null => {
  for (const selector of selectors) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (isVisible(el)) return el;
    }
  }
  return null;
};
