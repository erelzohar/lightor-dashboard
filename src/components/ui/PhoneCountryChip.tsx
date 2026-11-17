import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useDropdown } from './dropdown';

/**
 * LT-677: the phone field's country chip once it offers more than one
 * country: a button (flag, calling code, a small chevron) that opens the
 * list of countries (flag, name, calling code). The listbox itself - the
 * arrows, Home/End, Enter, Escape, typeahead, closing on a tap outside - is
 * the dashboard dropdown's (`useDropdown`, LT-365); the panel is portalled
 * to <body> as that one is, so a dialog's `overflow` never clips it.
 * With one country the field keeps its static chip and none of this mounts.
 */

export interface PhoneCountry {
  /** ISO 3166 code. */
  code: string;
  /** The calling code, without "+". */
  dialCode: string;
  /** The translation key of its name with its calling code ("Israel (+972)"), read by screen readers. */
  nameKey: string;
  /** The translation key of its plain name ("Israel"), shown in the list of countries. */
  labelKey?: string;
  /** How a local number is written there: the field's placeholder. */
  placeholder?: string;
  flag: React.ReactNode;
}

const ROW_H = 40;
const GAP = 6;
const MARGIN = 12;
const WIDTH = 232;

type Place = { top?: number; bottom?: number; left: number };

interface PhoneCountryChipProps {
  countries: PhoneCountry[];
  /** The chosen country's code. */
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

const PhoneCountryChip: React.FC<PhoneCountryChipProps> = ({ countries, value, onChange, disabled = false }) => {
  const { t } = useTranslation();
  const items = useMemo(
    () => countries.map((c) => ({ value: c.code, label: t(c.labelKey ?? c.nameKey), text: t(c.labelKey ?? c.nameKey) })),
    [countries, t]
  );
  const { open, activeIndex, selectedIndex, rootRef, panelRef, triggerRef, listRef, triggerProps, listProps, getItemProps } = useDropdown({
    items,
    value,
    onChange,
    disabled,
  });
  const chosen = countries[selectedIndex] ?? countries[0];

  // Under the chip, or over it when there is more room above; it follows the chip on scroll.
  const [place, setPlace] = useState<Place | null>(null);
  const rows = countries.length;
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPlace(null);
      return;
    }
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const height = rows * ROW_H + 14;
      const below = window.innerHeight - r.bottom - GAP - MARGIN;
      const above = r.top - GAP - MARGIN;
      const up = below < height && above > below;
      setPlace({
        left: Math.max(MARGIN, Math.min(r.left, window.innerWidth - MARGIN - WIDTH)),
        ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, triggerRef, rows]);

  // The panel mounts once it is placed, a render after `open`: the list takes the focus then.
  const placed = !!place;
  useEffect(() => {
    if (open && placed) listRef.current?.focus({ preventScroll: true });
  }, [open, placed, listRef]);

  const label = t('phoneInput.chooseCountry');

  return (
    <div ref={rootRef} className="flex shrink-0">
      <button
        {...triggerProps}
        aria-label={`${label}: ${t(chosen.nameKey)}`}
        data-country={chosen.code}
        data-testid="phone-country"
        className={
          'flex items-center gap-2 ps-3.5 pe-2.5 rounded-s-xl border-e border-gray-200 dark:border-gray-700/80 ' +
          'text-base sm:text-[0.9375rem] text-gray-600 dark:text-gray-300 select-none outline-none ' +
          'transition-colors hover:bg-gray-50 dark:hover:bg-white/5 disabled:cursor-not-allowed disabled:hover:bg-transparent ' +
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 ' +
          (open ? 'bg-gray-50 dark:bg-white/5' : '')
        }
      >
        {chosen.flag}
        <span aria-hidden="true">+{chosen.dialCode}</span>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" className={`size-3 shrink-0 text-gray-400 dark:text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M3 4.75 6 7.75 9 4.75" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {createPortal(
        open && place ? (
          <div
            ref={panelRef}
            style={{ top: place.top, bottom: place.bottom, left: place.left, width: WIDTH }}
            className={
              'fixed z-[10100] rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_16px_36px_-18px_rgba(15,23,42,0.5)] ' +
              'dark:border-gray-700/80 dark:bg-dark-surface dark:shadow-[0_2px_12px_rgba(0,0,0,0.6)]'
            }
          >
            <ul {...listProps} aria-label={label} className="outline-none">
              {countries.map((c, i) => {
                const picked = i === selectedIndex;
                return (
                  <li
                    key={c.code}
                    {...getItemProps(i)}
                    className={
                      'flex h-10 cursor-default select-none items-center gap-3 rounded-lg px-3 text-[0.9375rem] ' +
                      (i === activeIndex ? 'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white ' : 'text-gray-700 dark:text-gray-200 ') +
                      (picked ? 'font-medium' : '')
                    }
                  >
                    {c.flag}
                    <span className="min-w-0 flex-1 truncate">{t(c.labelKey ?? c.nameKey)}</span>
                    <span dir="ltr" className="shrink-0 text-gray-500 dark:text-gray-400">+{c.dialCode}</span>
                    <svg aria-hidden="true" focusable="false" viewBox="0 0 14 14" className={`size-4 shrink-0 text-primary ${picked ? '' : 'invisible'}`}>
                      <path d="M3 7.4 5.8 10.2 11 4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null,
        document.body
      )}
    </div>
  );
};

export default PhoneCountryChip;
