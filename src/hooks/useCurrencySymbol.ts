import { useContext, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';
import type { RootState } from '../store/store';
import { currencySymbol } from '../utils/currency';

const noSubscribe = (): (() => void) => () => undefined;

/**
 * LT-395: the symbol money is shown with - the business's own currency, from
 * its site. A screen rendered with no store around it (a test, a preview
 * harness) shows shekels, as every site did before the currency existed.
 */
export const useCurrencySymbol = (): string => {
  const store = useContext(ReactReduxContext)?.store;
  const currency = useSyncExternalStore(
    store ? store.subscribe : noSubscribe,
    () => (store ? (store.getState() as RootState).webConfig?.data?.currency : undefined),
  );
  return currencySymbol(currency);
};
