import apiClient from './apiClient';
import globals from './globals';
import { HOME_COUNTRY, PHONE_COUNTRY_DATA, phoneCountryOf } from '../utils/phone';

/**
 * LT-677: the countries a phone number may be from. Israel always; the ones
 * opened abroad come from the API (`GET /api/messaging/phone-countries`),
 * asked once per page load and kept in memory. Until it answers, and after
 * any failure (an older API answers 404), the list is Israel alone and every
 * phone field is exactly what it was before this existed.
 *
 * Kept outside React so the code routes (services/phoneCodeApi) read the
 * same list the fields show; components read it with `usePhoneCountries`.
 */
export interface PhoneCountriesState {
  /** The two-letter codes opened abroad that this app has a chip for. */
  abroad: readonly string[];
  /** The country of the signed-in owner's phone: a field's default chip when it is offered. */
  ownerCountry: string;
}

const NONE: readonly string[] = Object.freeze([]);

let state: PhoneCountriesState = { abroad: NONE, ownerCountry: HOME_COUNTRY };
let request: Promise<readonly string[]> | null = null;
const listeners = new Set<() => void>();

const change = (next: Partial<PhoneCountriesState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

export const getPhoneCountries = (): PhoneCountriesState => state;

export const subscribePhoneCountries = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * What the API listed, kept to the countries this app knows how to show
 * (utils/phone PHONE_COUNTRY_DATA): a country opened on the server before
 * the app learned it is simply not offered here yet.
 */
export const setOpenAbroad = (list: unknown): void => {
  const codes = Array.isArray(list)
    ? [...new Set(list.filter((code): code is string => typeof code === 'string').map((code) => code.trim().toUpperCase()))].filter(
        (code) => code !== HOME_COUNTRY && code in PHONE_COUNTRY_DATA
      )
    : [];
  if (codes.join() === state.abroad.join()) return;
  change({ abroad: codes.length ? Object.freeze(codes) : NONE });
};

/** The owner's phone, as the account holds it: its country is the default of an empty field. */
export const setOwnerPhone = (phone: string | null | undefined): void => {
  const ownerCountry = phoneCountryOf(phone) ?? HOME_COUNTRY;
  if (ownerCountry !== state.ownerCountry) change({ ownerCountry });
};

/** Asks the API once; every later call shares the first answer. Never throws. */
export const loadPhoneCountries = (): Promise<readonly string[]> => {
  request ??= apiClient
    .get(`${globals.messagingUrl}phone-countries`)
    .then(({ data }) => {
      setOpenAbroad(data?.data?.abroad);
      return state.abroad;
    })
    .catch(() => state.abroad);
  return request;
};

/** Back to Israel alone, nothing asked yet: for tests. */
export const resetPhoneCountries = (): void => {
  request = null;
  if (state.abroad.length || state.ownerCountry !== HOME_COUNTRY) change({ abroad: NONE, ownerCountry: HOME_COUNTRY });
};
