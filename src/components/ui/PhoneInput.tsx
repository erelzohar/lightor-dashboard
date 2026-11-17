import React, { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { useTranslation } from 'react-i18next';
import { usePhoneCountries } from '../../hooks/usePhoneCountries';
import { HOME_COUNTRY, PHONE_COUNTRY_DATA, checkPhone, toE164, type PhoneAccept, type PhoneChangeInfo } from '../../utils/phone';
import PhoneCountryChip, { type PhoneCountry } from './PhoneCountryChip';

/**
 * LT-404: the one phone field: a country chip, the number formatted as it
 * is typed, and the value handed up in E.164 once it is a valid number of
 * the kind the field takes. Pasted "+972…", "00972…" and "05…" all read.
 * Its own error shows after a blur, or when the form says it was submitted
 * (`showError`); a server's error (`error`) always.
 *
 * LT-677: the chip is Israel alone, and static, until the server opens a
 * country abroad (`usePhoneCountries`); then it is a button that opens the
 * list of countries. The chip is the country a number written locally is
 * read in, and sets the placeholder and the format as it is typed
 * ("(212) 555-0123" in the US). A number typed or pasted with "+" or "00"
 * moves the chip to its own country when that one is offered.
 */

export type { PhoneCountry };

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

const UnitedStatesFlag: React.FC = () => (
  <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" focusable="false" className="rounded-[3px] ring-1 ring-black/10 dark:ring-white/15 shrink-0">
    <rect width="22" height="16" fill="#fff" />
    <g fill="#b22234">
      {[0, 2, 4, 6, 8, 10, 12].map((stripe) => (
        <rect key={stripe} y={(stripe * 16) / 13} width="22" height={16 / 13} />
      ))}
    </g>
    <rect width="9.6" height={(7 * 16) / 13} fill="#3c3b6e" />
    <g fill="#fff">
      {[1.5, 3.5, 5.5, 7.5].flatMap((y, row) =>
        [1.4, 3.1, 4.8, 6.5, 8.2].map((x) => <circle key={`${row}-${x}`} cx={x} cy={y} r="0.45" />)
      )}
    </g>
  </svg>
);

const ISRAEL: PhoneCountry = {
  code: HOME_COUNTRY,
  dialCode: PHONE_COUNTRY_DATA.IL.dialCode,
  nameKey: 'phoneInput.country',
  labelKey: 'phoneInput.names.IL',
  placeholder: PHONE_COUNTRY_DATA.IL.placeholder,
  flag: <IsraelFlag />,
};

/** The chips this app can show, by country code: Israel, and the countries it knows abroad. */
const CHIPS: Readonly<Record<string, PhoneCountry>> = {
  IL: ISRAEL,
  US: {
    code: 'US',
    dialCode: PHONE_COUNTRY_DATA.US.dialCode,
    nameKey: 'phoneInput.countryUS',
    labelKey: 'phoneInput.names.US',
    placeholder: PHONE_COUNTRY_DATA.US.placeholder,
    flag: <UnitedStatesFlag />,
  },
};

/** The characters that carry the number: digits and a leading "+". */
const significant = (text: string): string => text.replace(/[^\d+]/g, '');
const MAX_SIGNIFICANT = 16;

/** What is typed, formatted as it is typed in the chip's country ("00972" reads as "+972"). */
const formatTyped = (text: string, country: string = HOME_COUNTRY): string => {
  let raw = significant(text);
  // A "+" counts only at the start.
  raw = raw.slice(0, 1) + raw.slice(1).replace(/\+/g, '');
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  raw = raw.slice(0, MAX_SIGNIFICANT);
  if (!raw) return '';
  return new AsYouType(country as CountryCode).input(raw);
};

/** The offered country a valid stored number belongs to; null for any other value. */
const offeredCountryOf = (value: string | null | undefined, codes: readonly string[]): string | null => {
  const e164 = toE164(value);
  const country = e164 && parsePhoneNumberFromString(e164)?.country;
  return country && codes.includes(country) ? country : null;
};

/**
 * The offered country a number being typed with "+" belongs to, as far as it
 * can be told: its own country when that one is offered, else the first
 * offered one with its calling code ("+1" is the United States' chip, also
 * for a Canadian number, which the field then refuses under it). Null leaves
 * the chip where it is.
 */
const typedCountryOf = (text: string, countries: readonly PhoneCountry[], current: PhoneCountry): string | null => {
  const typer = new AsYouType();
  typer.input(significant(text));
  const found = typer.getCountry();
  if (found && countries.some((c) => c.code === found)) return found;
  const calling = typer.getCallingCode();
  if (!calling || current.dialCode === calling) return null;
  return countries.find((c) => c.dialCode === calling)?.code ?? null;
};

/**
 * How a stored value first reads in the field: a number of an offered
 * country nationally ("050-123-4567", "(212) 555-0123"), any other valid
 * number internationally.
 */
const textFromValue = (value: string | null | undefined, codes: readonly string[], country: string): string => {
  const e164 = toE164(value);
  // Not a number yet: formatted as if typed, unless it holds more than phone characters.
  if (!e164) return /^[\d\s()+.-]*$/.test(value ?? '') ? formatTyped(value ?? '', country) : value ?? '';
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return value ?? '';
  if (parsed.country === HOME_COUNTRY) return new AsYouType(HOME_COUNTRY).input(`0${parsed.nationalNumber}`);
  if (!parsed.country || !codes.includes(parsed.country)) return parsed.formatInternational();
  return new AsYouType(parsed.country).input(parsed.formatNational().replace(/\D/g, ''));
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
  /**
   * The countries the chip offers. Left out, they are Israel and the ones
   * the server opened abroad (`usePhoneCountries`). One: a static chip.
   * More: a picker.
   */
  countries?: PhoneCountry[];
  /**
   * The chip of an empty field, when it is offered. Left out, it is the
   * country of the owner's phone, else Israel. A value in the field always
   * shows under its own country.
   */
  defaultCountry?: string | null;
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
      countries: countriesProp,
      defaultCountry: defaultCountryProp,
      error,
      showError = false,
      helperText,
      fullWidth = true,
      className = '',
      onBlur,
      onKeyDown,
      placeholder,
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation();
    const offered = usePhoneCountries();
    const countries = useMemo<PhoneCountry[]>(() => {
      const list = countriesProp ?? offered.countries.map((code) => CHIPS[code]).filter(Boolean);
      return list.length ? list : [ISRAEL];
    }, [countriesProp, offered.countries]);
    const codes = useMemo(() => countries.map((c) => c.code), [countries]);
    // The countries abroad a number of which this field takes (an owner's or a business's phone).
    const abroad = useMemo(() => codes.filter((code) => code !== HOME_COUNTRY), [codes]);
    const several = countries.length > 1;
    const wanted = defaultCountryProp ?? offered.defaultCountry;
    const fallbackCode = codes.includes(wanted) ? wanted : countries[0].code;
    const autoId = useId();
    const id = props.id ?? autoId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    const countryId = `${id}-country`;

    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    // The chip: the country of the value already in the field, else the default.
    const [countryCode, setCountryCode] = useState(() => offeredCountryOf(value, codes) ?? fallbackCode);
    const country = countries.find((c) => c.code === countryCode) ?? countries[0];
    const [text, setText] = useState(() => textFromValue(value, codes, country.code));
    const [touched, setTouched] = useState(false);
    // What this field last handed up: the same value coming back down is
    // ours, and re-reading it would rewrite what the owner is typing.
    const emitted = useRef<string | null>(null);
    const pendingCaret = useRef<number | null>(null);
    const lastKey = useRef<string | null>(null);
    // The countries arrive after the first render (LT-677): a field nobody
    // typed in is read again with them, one being typed in is left alone.
    const offer = `${codes.join()}|${fallbackCode}`;

    useEffect(() => {
      if (value === emitted.current) return;
      emitted.current = null;
      // A number of an offered country shows under its chip; an empty field takes the default.
      const next = offeredCountryOf(value, codes) ?? (significant(value ?? '') ? country.code : fallbackCode);
      setCountryCode(next);
      setText(textFromValue(value, codes, next));
      // The chip is read where it stands: it follows the value and the offer, not itself.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, offer]);

    useLayoutEffect(() => {
      const el = inputRef.current;
      if (pendingCaret.current === null || !el || document.activeElement !== el) return;
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }, [text]);

    const { valid } = checkPhone(value, accept, abroad);
    const empty = !significant(text);
    // Under the Israeli chip the words are Israel's, as ever; under another the country is the chip's.
    const ownErrorKey =
      country.code === HOME_COUNTRY
        ? accept === 'mobile' ? 'phoneInput.invalidMobile' : accept === 'world' ? 'phoneInput.invalidWorld' : 'phoneInput.invalidAny'
        : accept === 'world' ? 'phoneInput.invalidWorldAbroad' : 'phoneInput.invalidAbroad';
    const ownError = (touched || showError) && !valid && (!empty || !!props.required) ? t(ownErrorKey) : null;
    const shownError = error || ownError;

    /**
     * Hands a typed text up: E.164 once it is a number the field takes, else
     * the text. Under a chip abroad a text that is no number yet goes up with
     * the chip's calling code ("+1212555"), so nothing above reads half a
     * local number there as an Israeli one (a bare number is Israeli to every
     * caller and to the server).
     */
    const emit = (formatted: string, code: string) => {
      const info = checkPhone(formatted, accept, abroad, code);
      const digits = significant(formatted);
      const next = info.valid
        ? (toE164(formatted, code) as string)
        : code === HOME_COUNTRY || !digits || digits.startsWith('+')
          ? formatted
          : `+${(countries.find((c) => c.code === code) ?? country).dialCode}${digits}`;
      emitted.current = next;
      onChange(next, info);
    };

    /** A country picked from the list: what is in the field is read again there. */
    const pickCountry = (code: string) => {
      if (code === country.code) return;
      setCountryCode(code);
      // A number written with "+" keeps its digits and drops its old calling code.
      const typer = new AsYouType(country.code as CountryCode);
      typer.input(significant(text));
      const local = text.trimStart().startsWith('+') ? String(typer.getNumber()?.nationalNumber ?? '') : significant(text);
      const formatted = formatTyped(local, code);
      setText(formatted);
      emit(formatted, code);
    };

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
      let code = country.code;
      let formatted = formatTyped(raw, code);
      // A number written with "+" or "00" moves the chip to its own country, when that one is offered (LT-677).
      if (several && formatted.startsWith('+')) {
        const typed = typedCountryOf(formatted, countries, country);
        if (typed && typed !== code) {
          code = typed;
          formatted = formatTyped(raw, code);
          setCountryCode(code);
        }
      }
      // "00972…" became "+972…": one character fewer before the caret.
      const shift = significant(raw).startsWith('00') ? 1 : 0;
      pendingCaret.current = caretAfter(formatted, Math.max(0, kept - shift));
      setText(formatted);
      emit(formatted, code);
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
          {several ? (
            <>
              <PhoneCountryChip countries={countries} value={country.code} onChange={pickCountry} disabled={props.disabled} />
              <span id={countryId} className="sr-only">{t(country.nameKey)}</span>
            </>
          ) : (
            <span
              className="flex items-center gap-2 ps-3.5 pe-3 border-e border-gray-200 dark:border-gray-700/80 text-base sm:text-[0.9375rem] text-gray-600 dark:text-gray-300 select-none shrink-0"
              data-country={country.code}
            >
              {country.flag}
              <span aria-hidden="true">+{country.dialCode}</span>
              <span id={countryId} className="sr-only">{t(country.nameKey)}</span>
            </span>
          )}
          <input
            ref={inputRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder={placeholder ?? country.placeholder ?? PHONE_COUNTRY_DATA[HOME_COUNTRY].placeholder}
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
