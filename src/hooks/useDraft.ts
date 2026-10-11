import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * LT-249 — the site editor's draft: whole-config snapshots with undo and redo
 * (lightor-ai-split-plan.md §4.1). Typing in one field is one step — changes
 * carrying the same merge key within a moment fold into the step before — so
 * undo takes back the edit, not a letter. `dirty` compares against the last
 * saved (or discarded-to) config.
 */
export interface Draft<T> {
  value: T;
  set: (next: T, mergeKey?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  /** A new starting point (after a save or a discard): history cleared. */
  reset: (base: T) => void;
}

const LIMIT = 50;
const MERGE_MS = 1500;

interface State<T> { past: T[]; present: T; future: T[]; base: T }

export function useDraft<T>(initial: T): Draft<T> {
  const [state, setState] = useState<State<T>>({ past: [], present: initial, future: [], base: initial });
  const last = useRef<{ key?: string; at: number }>({ at: 0 });

  const set = useCallback((next: T, mergeKey?: string) => {
    const now = Date.now();
    const merge = !!mergeKey && last.current.key === mergeKey && now - last.current.at < MERGE_MS;
    last.current = { key: mergeKey, at: now };
    setState((s) => (next === s.present ? s : {
      ...s,
      past: merge ? s.past : [...s.past, s.present].slice(-LIMIT),
      present: next,
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    last.current = { at: 0 };
    setState((s) => (s.past.length
      ? { ...s, past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] }
      : s));
  }, []);

  const redo = useCallback(() => {
    last.current = { at: 0 };
    setState((s) => (s.future.length
      ? { ...s, past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }
      : s));
  }, []);

  const reset = useCallback((base: T) => {
    last.current = { at: 0 };
    setState({ past: [], present: base, future: [], base });
  }, []);

  const dirty = useMemo(() => JSON.stringify(state.present) !== JSON.stringify(state.base), [state.present, state.base]);

  return {
    value: state.present,
    set,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    dirty,
    reset,
  };
}
