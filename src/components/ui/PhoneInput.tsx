import React, { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { useTranslation } from 'react-i18next';
import { checkPhone, toE164, type PhoneAccept, type PhoneChangeInfo } from '../../utils/phone';

/**
 * LT-404: the one phone field: a country chip (Israel, +972, for now), the
 * number formatted as it is typed, and the value handed up in E.164 once it
 * is a valid number of the kind the field takes. Pasted "+972…", "00972…"
 * and "05…" all read. Its own error shows after a blur, or when the form
 * says it was submitted (`showError`); a server's error (`error`) always.
 */

export interface PhoneCountry {
  /** ISO 3166 code. */
  code: 'IL';
  /** The calling code, without "+". */
  dialCode: string;
  /** The translation key of its name, read by screen readers. */
  nameKey: string;
  flag: React.ReactNode;
}

const IsraelFlag: React.FC = () => (
  <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" focusable="false" className="rounded-[3px] ring-1 ring-black/10 dark:ring-white/15 shrink-0">
    <rect width="22" height="16" fill="#fff" />
    <rect y="1.6" width="22" height="2.2" fill="#0038b8" />
    <rect y="12.2" width="22" height="2.2" fill="#0038b8" />
    <g fill="none" stroke="#0038b8" strokeWidth="0.75">
      <path d="M11 4.6 L13.95 9.7 L8.05 9.7 Z" />
      <path d="M11 11.4 L13.95 6.3 L8.05 6.3 Z" />
    </g>
  </svg>
);

const ISRAEL: PhoneCountry = { code: 'IL', dialCode: '972', nameKey: 'phoneInput.country', flag: <IsraelFlag /> };

/** The characters that carry the number: digits and a leading "+". */
const significant = (text: string): string => text.replace(/[^\d+]/g, '');
const MAX_SIGNIFICANT = 16;

/** What is typed, formatted as it is typed ("00972" reads as "+972"). */
const formatTyped = (text: string): string => {
  let raw = significant(text);
  // A "+" counts only at the start.
  raw = raw.slice(0, 1) + raw.slice(1).replace(/\+/g, '');
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  raw = raw.slice(0, MAX_SIGNIFICANT);
  if (!raw) return '';
  return new AsYouType('IL').input(raw);
};

/** How a stored value first reads in the field: an Israeli number nationally ("050-123-4567"). */
const textFromValue = (value: string | null | undefined): string => {
  const e164 = toE164(value);
  // Not a number yet: formatted as if typed, unless it holds more than phone characters.
  if (!e164) return /^[\d\s()+.-]*$/.test(value ?? '') ? formatTyped(value ?? '') : value ?? '';
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return value ?? '';
  if (parsed.country !== 'IL') return parsed.formatInternational();
  return new AsYouType('IL').input(`0${parsed.nationalNumber}`);
};

/** Where the caret goes after `count` significant characters of `text`. */
const caretAfter = (text: string, count: number): number => {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/[\d+]/.test(text[i])) seen += 1;
    if (seen === count) return i + 1;
  }
  return text.length;
};

interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'> {
  label?: string | JSX.Element;
  /** The stored value: E.164, or what was typed while it is not yet a valid number. */
  value: string;
  /** E.164 when valid, else the typed text. */
  onChange: (value: string, info: PhoneChangeInfo) => void;
  accept?: PhoneAccept;
  /** The countries the chip offers. One for now (Israel); a picker comes with a second. */
  countries?: PhoneCountry[];
  /** An error from outside (the server's answer): shown whatever the field thinks. */
  error?: string | null;
  /** Show the field's own error without waiting for a blur (the form was submitted). */
  showError?: boolean;
  helperText?: string;
  fullWidth?: boolean;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      label,
      value,
      onChange,
      accept = 'any',
      countries = [ISRAEL],
      error,
      showError = false,
      helperText,
      fullWidth = true,
      className = '',
      onBlur,
      onKeyDown,
      placeholder = '050-123-4567',
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();
    const country = countries[0] ?? ISRAEL;
    const autoId = useId();
    const id = props.id ?? autoId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    const countryId = `${id}-country`;

    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const [text, setText] = useState(() => textFromValue(value));
    const [touched, setTouched] = useState(false);
    // What this field last handed up: the same value coming back down is
    // ours, and re-reading it would rewrite what the owner is typing.
    const emitted = useRef<string | null>(null);
    const pendingCaret = useRef<number | null>(null);
    const lastKey = useRef<string | null>(null);

    useEffect(() => {
      if (value === emitted.current) return;
      emitted.current = null;
      setText(textFromValue(value));
    }, [value]);

    useLayoutEffect(() => {
      const el = inputRef.current;
      if (pendingCaret.current === null || !el || document.activeElement !== el) return;
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }, [text]);

    const { valid } = checkPhone(value, accept);
    const empty = !significant(text);
    const ownError = (touched || showError) && !valid && (!empty || !!props.required)
      ? t(accept === 'mobile' ? 'phoneInput.invalidMobile' : 'phoneInput.invalidAny')
      : null;
    const shownError = error || ownError;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value;
      let caret = e.target.selectionStart ?? raw.length;
      // Only a hyphen or a space went (Backspace or Delete beside one): take
      // the digit beyond it too, or the formatting would put it straight back.
      if (raw.length < text.length && significant(raw) === significant(text)) {
        if (lastKey.current === 'Delete') {
          const after = raw.slice(caret).search(/[\d+]/);
          if (after >= 0) raw = raw.slice(0, caret + after) + raw.slice(caret + after + 1);
        } else {
          let at = caret - 1;
          while (at >= 0 && !/[\d+]/.test(raw[at])) at -= 1;
          if (at >= 0) {
            raw = raw.slice(0, at) + raw.slice(at + 1);
            caret = at;
          }
        }
      }
      const kept = significant(raw.slice(0, caret)).length;
      const formatted = formatTyped(raw);
      // "00972…" became "+972…": one character fewer before the caret.
      const shift = significant(raw).startsWith('00') ? 1 : 0;
      pendingCaret.current = caretAfter(formatted, Math.max(0, kept - shift));
      setText(formatted);

      const info = checkPhone(formatted, accept);
      const next = info.valid ? (toE164(formatted) as string) : formatted;
      emitted.current = next;
      onChange(next, info);
    };

    const describedBy =
      [props['aria-describedby'], countryId, shownError ? errorId : helperText ? helperId : undefined].filter(Boolean).join(' ') ||
      undefined;

    const frame =
      'flex items-stretch rounded-xl border shadow-sm bg-white dark:bg-dark-surface dark:border-gray-700/80 ' +
      'focus-within:ring-[0.1875rem] transition-[border-color,box-shadow] duration-300 ' +
      (shownError
        ? 'border-red-300 dark:border-red-500/50 focus-within:border-red-500 focus-within:ring-red-500/20 '
        : 'border-gray-200 focus-within:border-primary focus-within:ring-primary/20 ') +
      (fullWidth ? 'w-full ' : '') +
      className;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${props.disabled ? 'opacity-60' : ''}`}>
        {label && (
          <label htmlFor={id} className="block text-[0.875rem] font-medium text-gray-700 dark:text-gray-300 mb-2 ms-0.5">
            {label}
          </label>
        )}

        {/* A phone number reads left to right in every language: the chip
            stays on its left and the digits keep their order on RTL pages. */}
        <div dir="ltr" className={frame} data-testid="phone-input">
          <span
            className="flex items-center gap-2 ps-3.5 pe-3 border-e border-gray-200 dark:border-gray-700/80 text-base sm:text-[0.9375rem] text-gray-600 dark:text-gray-300 select-none shrink-0"
            data-country={country.code}
          >
            {country.flag}
            <span aria-hidden="true">+{country.dialCode}</span>
            <span id={countryId} className="sr-only">{t(country.nameKey)}</span>
          </span>
          <input
            ref={inputRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder={placeholder}
            aria-invalid={shownError ? true : undefined}
            {...props}
            id={id}
            value={text}
            aria-describedby={describedBy}
            onChange={handleChange}
            onKeyDown={(e) => {
              lastKey.current = e.key;
              onKeyDown?.(e);
            }}
            onBlur={(e) => {
              setTouched(true);
              onBlur?.(e);
            }}
            // text-base (16px) on mobile keeps iOS Safari from zooming on focus, as ui/Input.
            className="flex-1 min-w-0 bg-transparent px-3.5 py-3 rounded-e-xl text-base sm:text-[0.9375rem] text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
          />
        </div>

        {shownError && (
          <p id={errorId} className="mt-1 text-sm text-red-500" role={error ? 'alert' : undefined}>
            {shownError}
          </p>
        )}

        {helperText && !shownError && (
          <p id={helperId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';

export default PhoneInput;
