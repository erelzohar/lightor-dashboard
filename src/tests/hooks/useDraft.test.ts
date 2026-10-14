import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraft } from '../../hooks/useDraft';

/** LT-249 — the editor's draft: undo, redo, typing as one step, dirty against the saved. */
describe('useDraft (LT-249)', () => {
  afterEach(() => vi.useRealTimers());

  it('undoes and redoes whole snapshots, and knows when it differs from the saved', () => {
    const { result } = renderHook(() => useDraft({ title: 'A' }));
    expect(result.current.dirty).toBe(false);
    act(() => result.current.set({ title: 'B' }));
    act(() => result.current.set({ title: 'C' }));
    expect(result.current.value.title).toBe('C');
    expect(result.current.dirty).toBe(true);
    act(() => result.current.undo());
    expect(result.current.value.title).toBe('B');
    act(() => result.current.redo());
    expect(result.current.value.title).toBe('C');
    act(() => { result.current.undo(); result.current.undo(); });
    expect(result.current.value.title).toBe('A');
    expect(result.current.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it('folds typing in one field into one step; another field, or a pause, starts a new one', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDraft({ a: '', b: '' }));
    act(() => result.current.set({ a: 'H', b: '' }, 'a'));
    act(() => result.current.set({ a: 'Hi', b: '' }, 'a'));
    act(() => result.current.set({ a: 'Hi!', b: '' }, 'a'));
    act(() => result.current.set({ a: 'Hi!', b: 'x' }, 'b'));
    vi.advanceTimersByTime(2000);
    act(() => result.current.set({ a: 'Hi!', b: 'xy' }, 'b'));
    act(() => result.current.undo());
    expect(result.current.value).toEqual({ a: 'Hi!', b: 'x' });
    act(() => result.current.undo());
    expect(result.current.value).toEqual({ a: 'Hi!', b: '' });
    act(() => result.current.undo());
    expect(result.current.value).toEqual({ a: '', b: '' });
  });

  it('starts over from a new base after a save, with no history', () => {
    const { result } = renderHook(() => useDraft({ n: 1 }));
    act(() => result.current.set({ n: 2 }));
    act(() => result.current.reset({ n: 2 }));
    expect(result.current.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it('applies an updater to the draft as it is when the change lands (LT-315)', () => {
    const { result } = renderHook(() => useDraft({ a: 'x', b: 'y' }));
    const late = (prev: { a: string; b: string }) => ({ ...prev, a: 'AI' });
    act(() => result.current.set({ a: 'x', b: 'typed meanwhile' }));
    act(() => result.current.set(late));
    expect(result.current.value).toEqual({ a: 'AI', b: 'typed meanwhile' });
    // One step each: undo takes back the late answer, not the owner's edit.
    act(() => result.current.undo());
    expect(result.current.value).toEqual({ a: 'x', b: 'typed meanwhile' });
  });

  it('rebases onto a stored config without losing the present or its history (LT-315)', () => {
    const { result } = renderHook(() => useDraft({ n: 1 }));
    act(() => result.current.set({ n: 2 }));
    act(() => result.current.set({ n: 3 }));
    act(() => result.current.rebase({ n: 2 }));
    expect(result.current.value).toEqual({ n: 3 });
    expect(result.current.dirty).toBe(true);
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.dirty).toBe(false);
  });
});

