import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * LT-592 (Erel's inline-edit, rebuilt for the dashboard): a value shown as a
 * pill that becomes its own input. The pen slides away and the check slides
 * in from the pill's end (mirrored in RTL); Enter saves, Escape puts the value
 * back. The pill is as wide as its words, and `suffix` (a count) follows them.
 * Our icons (lucide), framer, our colours; the labels come from the caller.
 */
export interface InlineEditProps {
  value: string;
  /** Resolves once saved; `false` (or a throw) keeps the pill open. Unchanged words just close it. */
  onSave: (next: string) => Promise<boolean | void> | boolean | void;
  /** The input's name for screen readers. */
  label: string;
  /** The pen's and the check's names. */
  editLabel: string;
  saveLabel: string;
  /** Shown right after the words, small (e.g. how many products the category holds). */
  suffix?: React.ReactNode;
  maxLength?: number;
  placeholder?: string;
  /** Controlled: whether this pill is open (one at a time in a list); else it keeps its own. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /** The words as typed while open, for notes beside the list. */
  onDraftChange?: (draft: string) => void;
  className?: string;
  testId?: string;
}

const SLIDE = 44;

export function InlineEdit({
  value, onSave, label, editLabel, saveLabel, suffix, maxLength, placeholder,
  editing: editingProp, onEditingChange, onDraftChange, className, testId,
}: InlineEditProps) {
  const { i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [ownEditing, setOwnEditing] = useState(false);
  const editing = editingProp ?? ownEditing;
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The button sits at the pill's end: the right in LTR, the left in RTL, and comes in from outside it.
  const from = (i18n.dir?.() === 'rtl' ? -1 : 1) * SLIDE;

  const setEditing = (on: boolean) => {
    if (editingProp === undefined) setOwnEditing(on);
    onEditingChange?.(on);
  };

  // Opened: the words as saved, all selected. Closed: back to the saved words.
  useEffect(() => {
    setDraft(value);
    if (editing) onDraftChange?.(value);
    if (editing) requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
    // onDraftChange is the caller's; only the open state and the saved value matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, value]);

  const open = () => {
    if (!editing) setEditing(true);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };
  const save = async () => {
    if (saving) return;
    const next = draft.trim();
    if (next === value) return setEditing(false);
    setSaving(true);
    try {
      const done = await onSave(next);
      if (done !== false) setEditing(false);
    } catch {
      // The caller says why (a toast); the words stay for another try.
    } finally {
      setSaving(false);
    }
  };

  const slide = {
    initial: { x: from },
    animate: { x: 0 },
    exit: { x: from },
    transition: reduceMotion ? { duration: 0 } : { type: 'spring' as const, bounce: 0.1, duration: 0.35 },
  };
  const button = 'absolute end-1 top-1/2 -mt-4 flex h-8 w-8 items-center justify-center rounded-full';

  return (
    <div
      data-testid={testId}
      data-editing={editing || undefined}
      className={cn(
        'relative inline-flex h-10 max-w-full items-center overflow-hidden rounded-full border bg-white ps-4 pe-11 shadow-[0_0_2px_rgba(15,23,42,0.12)] transition-colors dark:bg-slate-800',
        editing
          ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
          : 'border-gray-200 hover:border-primary/40 dark:border-slate-600',
        className,
      )}
    >
      {/* The input is as wide as its words: an invisible copy of them sizes the cell both share. Under
          `sm` every input is 16px (index.css, iOS zoom), so the copy is too, or the last letter is cut. */}
      <span className="inline-grid min-w-0 text-base sm:text-sm">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre">{draft || placeholder || ' '}</span>
        <input
          ref={inputRef}
          value={editing ? draft : value}
          size={1}
          maxLength={maxLength}
          placeholder={placeholder}
          readOnly={!editing || saving}
          aria-label={label}
          onClick={open}
          onChange={(e) => {
            setDraft(e.target.value);
            onDraftChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (!editing) {
              if (e.key === 'Enter') { e.preventDefault(); open(); }
              return;
            }
            if (e.key === 'Enter') { e.preventDefault(); void save(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          className={cn(
            'col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 outline-none placeholder:text-gray-400',
            editing ? 'text-gray-900 dark:text-white' : 'cursor-pointer text-gray-700 dark:text-slate-200',
          )}
        />
      </span>
      {suffix && <span className="ms-1.5 shrink-0 text-[11px] tabular-nums text-gray-400 dark:text-slate-500">{suffix}</span>}
      <AnimatePresence initial={false}>
        {editing ? (
          <motion.button
            key="check"
            type="button"
            {...slide}
            onClick={() => void save()}
            disabled={saving}
            aria-label={saveLabel}
            title={saveLabel}
            className={cn(button, 'z-20 bg-primary text-white hover:bg-primary/90 disabled:opacity-80')}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          </motion.button>
        ) : (
          <motion.button
            key="pen"
            type="button"
            {...slide}
            onClick={open}
            aria-label={editLabel}
            title={editLabel}
            className={cn(button, 'border border-gray-200 bg-gray-50/80 text-gray-500 hover:bg-gray-100 hover:text-primary dark:border-slate-600 dark:bg-slate-700/80 dark:text-slate-300 dark:hover:bg-slate-700')}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InlineEdit;
