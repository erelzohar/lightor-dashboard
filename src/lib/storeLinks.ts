/** The stores' own pages where a subscription is changed or cancelled (LT-580; LT-612: the web links to them too). */
export const STORE_SUBSCRIPTIONS_URL = {
  apple: 'https://apps.apple.com/account/subscriptions',
  google: 'https://play.google.com/store/account/subscriptions',
} as const;

/**
 * LT-663: the store that bills this account's live subscription, or null (Paddle's, or none).
 */
export const storeOfAccount = (user: { subscription?: { provider?: string; status?: string } } | null | undefined): 'apple' | 'google' | null => {
  const sub = user?.subscription;
  return (sub?.provider === 'apple' || sub?.provider === 'google') && (sub.status === 'active' || sub.status === 'past_due') ? sub.provider : null;
};

/**
 * LT-668 (Erel 2026-11-16): the store whose subscription goes on billing after
 * the account is deleted - the App Store only. Deleting an account stops a
 * Google Play subscription's renewal on the server (as a Paddle one is
 * cancelled), so for it the delete dialogs say "cancelled", like Paddle's; an
 * App Store subscription is its owner's to cancel, and they warn and ask for
 * a tick.
 */
export const billsOnAfterDeletion = (store: 'apple' | 'google' | null | undefined): 'apple' | null => (store === 'apple' ? 'apple' : null);
