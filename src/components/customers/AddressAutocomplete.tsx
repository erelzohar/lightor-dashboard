import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent } from 'react';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Input from '../ui/Input';
import { type AddressAnswer, answerText } from '../../utils/bookingFields';
import {
  type AddressSession,
  type AddressSuggestion,
  fetchAddressSuggestions,
  loadPlaces,
  placesKey,
  resolveAddressSuggestion,
} from '../../services/places';
import GoogleMapsLogo from '../ui/GoogleMapsLogo';

/**
 * The address question in the owner's manual booking, with Google's
 * suggestions under it (LT-206) — a port of lightor-front's
 * AddressAutocomplete (LT-191/192): an accessible combobox, a chosen
 * suggestion becomes an AddressAnswer (the line the owner saw plus the
 * place id and coordinates), any further keystroke drops back to text.
 *
 * Degrades, never blocks: without a key, with the script blocked, or with
 * Google refusing, this is the plain input the field always was. The owner
 * is never made to choose from the list — the server spares the owner the
 * form's rules, and an address Google does not know is still an address.
 *
 * The list sits in the flow under the input, not over it: the modal scrolls
 * and is a containing block (backdrop-filter, a transform), so a floating
 * list would be cut at its edge.
 */

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;

type Status = 'off' | 'loading' | 'ready' | 'failed';

export interface AddressAutocompleteProps {
  id: string;
  label: string | JSX.Element;
  value: string | AddressAnswer | undefined;
  onChange: (value: string | AddressAnswer) => void;
  maxLength?: number;
}

const AddressAutocomplete = ({ id, label, value, onChange, maxLength }: AddressAutocompleteProps) => {
  const { t, i18n } = useTranslation();
  // The owner's UI language: suggestions come in it, and the line they read
  // is what is stored. 'en-US' and the like are cut to the language.
  const language = String(i18n?.resolvedLanguage || i18n?.language || 'he').split('-')[0];
  const text = answerText(value);
  const [status, setStatus] = useState<Status>(() => (placesKey() ? 'loading' : 'off'));
  const [query, setQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[] | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const session = useRef<AddressSession>({});
  const ticket = useRef(0);
  const blurred = useRef(false);
  const mounted = useRef(true);

  const listId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const active = status === 'ready';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (status !== 'loading') return;
    let cancelled = false;
    loadPlaces().then(
      () => {
        if (!cancelled) setStatus('ready');
      },
      () => {
        if (!cancelled) setStatus('failed');
      }
    );
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!active || query === null) return;
    const input = query.trim();
    if (input.length < MIN_QUERY_LENGTH) {
      setSuggestions(null);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    const mine = ++ticket.current;
    const timer = setTimeout(() => {
      fetchAddressSuggestions(input, { language, session: session.current }).then(
        (found) => {
          if (!mounted.current || ticket.current !== mine) return;
          setSuggestions(found);
          setActiveIndex(-1);
          setOpen(!blurred.current);
        },
        () => {
          if (!mounted.current || ticket.current !== mine) return;
          setStatus('failed');
          setSuggestions(null);
          setOpen(false);
        }
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [active, query, language]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
    // optionId only depends on the id prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex, id]);

  const choose = useCallback(
    async (index: number) => {
      const suggestion = suggestions?.[index];
      if (!suggestion) return;
      ticket.current += 1;
      setOpen(false);
      setActiveIndex(-1);
      setQuery(null);
      onChange(suggestion.text);
      try {
        const place = await resolveAddressSuggestion(suggestion);
        if (!mounted.current) return;
        onChange({ text: suggestion.text, placeId: place.placeId, lat: place.lat, lng: place.lng });
      } catch {
        if (mounted.current) setStatus('failed');
      } finally {
        session.current = {};
      }
    },
    [suggestions, onChange]
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const typed = event.target.value;
    blurred.current = false;
    setQuery(typed);
    onChange(typed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!active) return;
    const count = suggestions?.length ?? 0;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (count === 0) return;
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        if (!open) {
          setOpen(true);
          setActiveIndex(step === 1 ? 0 : count - 1);
        } else {
          setActiveIndex((current) => (current < 0 ? (step === 1 ? 0 : count - 1) : (current + step + count) % count));
        }
        break;
      }
      case 'Enter':
        // A highlighted row is chosen; with none, Enter must not submit the
        // booking from inside an open list.
        if (open) {
          event.preventDefault();
          if (activeIndex >= 0 && activeIndex < count) void choose(activeIndex);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          setActiveIndex(-1);
        }
        break;
    }
  };

  const combobox: InputHTMLAttributes<HTMLInputElement> = active
    ? {
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-haspopup': 'listbox',
        'aria-expanded': open,
        'aria-controls': open ? listId : undefined,
        'aria-activedescendant': open && activeIndex >= 0 ? optionId(activeIndex) : undefined,
      }
    : {};
  const list = active && open ? suggestions : null;

  return (
    <div>
      <Input
        id={id}
        label={label}
        value={text}
        maxLength={maxLength}
        leftIcon={<MapPin className="w-4 h-4 text-gray-400" />}
        autoComplete={active ? 'off' : 'street-address'}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          blurred.current = false;
          if (suggestions !== null && query !== null) setOpen(true);
        }}
        onBlur={() => {
          blurred.current = true;
          setOpen(false);
          setActiveIndex(-1);
        }}
        {...combobox}
      />
      {list && (
        <div
          className="mt-1 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface shadow-sm"
          // Keeps the input focused through a click or a tap on a row.
          onMouseDown={(event) => event.preventDefault()}
        >
          <ul id={listId} role="listbox" aria-label={t('customers.booking.addressSuggestions')} className="max-h-56 overflow-y-auto py-1">
            {list.length === 0 ? (
              <li role="option" aria-selected={false} aria-disabled={true} className="flex min-h-[44px] items-center px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                {t('customers.booking.noAddresses')}
              </li>
            ) : (
              list.map((suggestion, index) => (
                <li
                  key={suggestion.placeId}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`flex min-h-[44px] cursor-pointer flex-col justify-center px-4 py-2 text-start ${
                    index === activeIndex ? 'bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                  onMouseMove={() => {
                    if (index !== activeIndex) setActiveIndex(index);
                  }}
                  onClick={() => {
                    void choose(index);
                  }}
                >
                  <span className="text-sm text-gray-800 dark:text-gray-100">{suggestion.mainText}</span>
                  {suggestion.secondaryText && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{suggestion.secondaryText}</span>
                  )}
                </li>
              ))
            )}
          </ul>
          <div className="flex justify-end border-t border-gray-100 dark:border-gray-700/60 px-4 py-1.5">
            <GoogleMapsLogo />
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
