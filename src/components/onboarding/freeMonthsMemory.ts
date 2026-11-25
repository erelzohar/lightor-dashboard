import { createContext, useContext } from 'react';

/**
 * LT-724: what the two-free-months offer remembers, and the context that lets
 * the layout's banner (FreeMonthsBanner) open the offer's popup
 * (FreeMonthsOffer). Without the offer's provider the banner is never shown.
 */

interface FreeMonthsOfferValue {
  /** The banner's turn: the account waits for its phone and the popup is not up. */
  bannerShown: boolean;
  /** Opens the popup straight on its phone step. */
  openPhone: () => void;
}

export const FreeMonthsOfferContext = createContext<FreeMonthsOfferValue>({ bannerShown: false, openPhone: () => undefined });

export const useFreeMonthsOffer = (): FreeMonthsOfferValue => useContext(FreeMonthsOfferContext);

const laterKey = (userId: string) => `lightor.freeMonthsLater.${userId}`;

/** "Later" said in this page load, for a browser whose storage is closed. */
const laterHere = new Set<string>();
/** Offered in this page load: the popup comes by itself once. */
const offeredSet = new Set<string>();

/** Tests start each case clean. */
export const forgetFreeMonthsOfferHere = (): void => {
  laterHere.clear();
  offeredSet.clear();
};

export const saidLater = (userId: string): boolean => {
  if (laterHere.has(userId)) return true;
  try {
    return window.localStorage.getItem(laterKey(userId)) === '1';
  } catch {
    return false;
  }
};

export const rememberLater = (userId: string): void => {
  laterHere.add(userId);
  try {
    window.localStorage.setItem(laterKey(userId), '1');
  } catch {
    // No storage: the popup still comes only once in this page load.
  }
};

export const offeredHere = (userId: string): boolean => offeredSet.has(userId);
export const markOfferedHere = (userId: string): void => {
  offeredSet.add(userId);
};
