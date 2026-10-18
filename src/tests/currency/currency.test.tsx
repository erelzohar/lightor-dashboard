import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import webConfigReducer from '../../store/slices/webConfigSlice';
import { currencyOf, currencySymbol } from '../../utils/currency';
import { useCurrencySymbol } from '../../hooks/useCurrencySymbol';
import IncomeStats from '../../components/dashboard/IncomeStats';

/**
 * LT-395 — money in the business's own currency, from its site; shekels for
 * a site made before the currency, and for a screen with no store around it.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }) }));

const storeWith = (currency?: string) =>
  configureStore({
    reducer: combineReducers({ webConfig: webConfigReducer }),
    preloadedState: { webConfig: { data: { _id: 'wc1', ...(currency ? { currency } : {}) }, loading: false, error: null } } as never,
  });

function Symbol() {
  return <span data-testid="symbol">{useCurrencySymbol()}</span>;
}

describe('the business currency (LT-395)', () => {
  it('reads a stored currency, and anything else as shekels', () => {
    expect([currencySymbol('USD'), currencySymbol('EUR'), currencySymbol('GBP'), currencySymbol('ILS')]).toEqual(['$', '€', '£', '₪']);
    expect(currencySymbol(undefined)).toBe('₪');
    expect(currencyOf('usd')).toBe('USD');
    expect(currencyOf('JPY')).toBe('ILS');
  });

  it("shows the site's currency, and follows it when it changes", () => {
    const store = storeWith('USD');
    render(<Provider store={store}><Symbol /></Provider>);
    expect(screen.getByTestId('symbol')).toHaveTextContent('$');
    act(() => {
      store.dispatch({ type: 'webConfig/update/fulfilled', payload: { _id: 'wc1', currency: 'EUR' } });
    });
    expect(screen.getByTestId('symbol')).toHaveTextContent('€');
  });

  it('is shekels for an older site and with no store at all', () => {
    render(<Provider store={storeWith()}><Symbol /></Provider>);
    expect(screen.getByTestId('symbol')).toHaveTextContent('₪');
    render(<Symbol />);
    expect(screen.getAllByTestId('symbol')[1]).toHaveTextContent('₪');
  });

  it("puts the home page's income in dollars for a business in dollars", () => {
    const now = Date.now();
    const appt = { _id: 'a1', status: 'completed', timestamp: String(now - 60 * 60 * 1000), type: { _id: 't1', name: 'Gel', price: '45' } };
    render(<Provider store={storeWith('USD')}><IncomeStats appointments={[appt] as never} /></Provider>);
    expect(screen.getAllByText(/^\$45$/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/₪/)).toBeNull();
  });
});
