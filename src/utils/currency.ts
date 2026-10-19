/**
 * LT-395: the money a business's prices and income are in. The AI picks it
 * from the business's country when it builds the site, and the owner can
 * change it in Settings. A site from before has none: shekels.
 */
export const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

const SYMBOL: Record<Currency, string> = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };

export const currencyOf = (raw: unknown): Currency => {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return (CURRENCIES as readonly string[]).includes(code) ? (code as Currency) : 'ILS';
};

/** "₪", "$", "€" or "£" for a stored currency (or none). */
export const currencySymbol = (raw: unknown): string => SYMBOL[currencyOf(raw)];

/**
 * LT-415: a service with a price to show. The AI wizard's services arrive
 * without one (the owner sets it), and a bare currency sign read as a broken
 * price; "0" is a price - free.
 */
export const hasPrice = (price: unknown): boolean => price != null && String(price).trim() !== '';
