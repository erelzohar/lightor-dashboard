import { fireEvent } from '@testing-library/react';

/**
 * LT-365: select boxes are `ui/dropdown` now, not native selects. These open
 * one from its trigger (what `getByLabelText` finds) and act on an option by
 * its value.
 */
export function optionOf(trigger: HTMLElement, value: string): HTMLElement {
  if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger);
  const list = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
  const option = list?.querySelector<HTMLElement>(`[role="option"][data-value="${value}"]`);
  if (!option) throw new Error(`no option "${value}" in the dropdown`);
  return option;
}

/** What a user does to change a select: open it, tap the option. */
export function choose(trigger: HTMLElement, value: string): void {
  fireEvent.click(optionOf(trigger, value));
}
