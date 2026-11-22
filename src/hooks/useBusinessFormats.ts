import { useContext, useMemo, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';
import type { RootState } from '../store/store';
import { businessCountryOf, businessFormats, type BusinessFormats } from '../utils/businessFormats';

const noSubscribe = (): (() => void) => () => undefined;

/**
 * LT-702: the business's way of writing dates and clock times in the page's
 * language, by the country of its business phone (the stored site's
 * `contact.phone`). Nothing is fetched. A screen with no store around it (a
 * test, a preview harness) writes the way every business did before.
 */
export const useBusinessFormats = (language: string | null | undefined): BusinessFormats => {
  const store = useContext(ReactReduxContext)?.store;
  const phone = useSyncExternalStore(
    store ? store.subscribe : noSubscribe,
    () => (store ? (store.getState() as RootState).webConfig?.data?.contact?.phone : undefined),
  );
  const country = businessCountryOf(phone);
  return useMemo(() => businessFormats(language, country), [language, country]);
};
