import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Diff, DiffItem1, DiffItem2, DiffResizer } from '../../components/ui/diff';

/**
 * LT-581 — Erel's before/after slider: the line starts in the middle, the
 * arrow keys (Shift for bigger steps), Home and End move it, dragging the
 * handle puts it under the pointer, and it never leaves the frame.
 */
const slider = () =>
  render(
    <Diff label="The original against the edit" handleLabel="Move the line">
      <DiffItem1><img src="a.webp" alt="before" /></DiffItem1>
      <DiffItem2><img src="b.webp" alt="after" /></DiffItem2>
      <DiffResizer />
    </Diff>
  );

describe('the before/after slider (LT-581)', () => {
  it('names itself and its handle, starts in the middle, and cuts the first picture at the line', () => {
    slider();
    const frame = screen.getByRole('group', { name: 'The original against the edit' });
    expect(screen.getByRole('slider', { name: 'Move the line' })).toHaveAttribute('aria-valuenow', '50');
    expect(frame.style.getPropertyValue('--diff-position')).toBe('50%');
    expect(frame.style.direction).toBe('ltr');
    expect((frame.querySelector('[data-slot="diff-item-1"]') as HTMLElement).style.clipPath).toBe('inset(0 calc(100% - var(--diff-position)) 0 0)');
  });

  it('moves with the keys and stays within the frame', () => {
    slider();
    const frame = screen.getByRole('group');
    const now = () => screen.getByRole('slider').getAttribute('aria-valuenow');
    fireEvent.keyDown(frame, { key: 'ArrowRight' });
    expect(now()).toBe('52');
    fireEvent.keyDown(frame, { key: 'ArrowLeft', shiftKey: true });
    expect(now()).toBe('42');
    fireEvent.keyDown(frame, { key: 'End' });
    fireEvent.keyDown(frame, { key: 'ArrowRight' });
    expect(now()).toBe('100');
    fireEvent.keyDown(frame, { key: 'Home' });
    expect(now()).toBe('0');
  });

  it('follows the pointer while the handle is held', () => {
    slider();
    const frame = screen.getByRole('group');
    frame.getBoundingClientRect = () => ({ left: 100, width: 200, top: 0, height: 100, right: 300, bottom: 100, x: 100, y: 0, toJSON: () => ({}) });
    const handle = screen.getByRole('slider');
    fireEvent.pointerDown(handle, { button: 0, clientX: 150, pointerId: 1 });
    expect(handle).toHaveAttribute('aria-valuenow', '25');
    fireEvent.pointerMove(handle, { clientX: 400, pointerId: 1 });
    expect(handle).toHaveAttribute('aria-valuenow', '100');
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 120, pointerId: 1 });
    expect(handle).toHaveAttribute('aria-valuenow', '100');
  });
});
