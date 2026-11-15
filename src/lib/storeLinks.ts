/** The stores' own pages where a subscription is changed or cancelled (LT-580; LT-612: the web links to them too). */
export const STORE_SUBSCRIPTIONS_URL = {
  apple: 'https://apps.apple.com/account/subscriptions',
  google: 'https://play.google.com/store/account/subscriptions',
} as const;

/**
 * LT-663: the store that bills this account's live subscription, or null (Paddle's, or none).
 * Only its owner can cancel one, in the store: deleting the account does not.
 */
export const storeOfAccount = (user: { subscription?: { provider?: string; status?: string } } | null | undefined): 'apple' | 'google' | null => {
  const sub = user?.subscription;
  return (sub?.provider === 'apple' || sub?.provider === 'google') && (sub.status === 'active' || sub.status === 'past_due') ? sub.provider : null;
};
