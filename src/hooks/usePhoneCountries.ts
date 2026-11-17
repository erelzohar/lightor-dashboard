import { useMemo, useSyncExternalStore } from 'react';
import { getPhoneCountries, subscribePhoneCountries } from '../services/phoneCountries';
import { HOME_COUNTRY } from '../utils/phone';

export interface PhoneCountries {
  /** The countries opened abroad; empty while only Israel is offered. */
  abroad: readonly string[];
  /** Every country a phone field offers, Israel first. */
  countries: readonly string[];
  /** The chip of an empty field: the country of the owner's phone when it is offered, else Israel. */
  defaultCountry: string;
}

/**
 * LT-677: the countries a phone field offers (services/phoneCountries).
 * Israel alone until the API's list arrives, and after any failure.
 */
export const usePhoneCountries = (): PhoneCountries => {
  const state = useSyncExternalStore(subscribePhoneCountries, getPhoneCountries);
  return useMemo(() => {
    const countries = [HOME_COUNTRY, ...state.abroad];
    return {
      abroad: state.abroad,
      countries,
      defaultCountry: countries.includes(state.ownerCountry) ? state.ownerCountry : HOME_COUNTRY,
    };
  }, [state]);
};

export default usePhoneCountries;
