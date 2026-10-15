import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Open dialogs, innermost last: only the top one answers Escape and Tab. */
const stack: symbol[] = [];

const focusablesIn = (node: HTMLElement) =>
  Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest('[inert],[aria-hidden="true"]'));

/**
 * LT-362 (from lightor-front, LT-346): what a popup owes keyboard and
 * screen-reader users. While `open`: focus moves into it (the first control,
 * else the box itself, which then needs tabIndex={-1}); Escape closes it; Tab
 * cycles inside it instead of wandering into the page behind. On close,
 * focus goes back to whatever opened it.
 *
 * Popups here open over other popups (the booking window over a customer's
 * drawer or a class's roster, a confirm question over the booking window):
 * a key pressed inside another modal is that modal's, and the Escape this
 * one handles stops here, so the popup below does not close with it.
 */
export function useDialogFocus(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const id = Symbol('dialog');
    stack.push(id);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    if (node && !node.contains(document.activeElement)) (focusablesIn(node)[0] ?? node).focus();

    const onKey = (e: KeyboardEvent) => {
      const box = ref.current;
      if (stack[stack.length - 1] !== id || !box) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target && !box.contains(target) && target.closest('[aria-modal="true"]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusablesIn(box);
      if (!els.length) { e.preventDefault(); return; }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !box.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !box.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = stack.indexOf(id);
      if (at !== -1) stack.splice(at, 1);
      if (opener && opener.isConnected) opener.focus();
    };
  // `ref` is a stable ref object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
