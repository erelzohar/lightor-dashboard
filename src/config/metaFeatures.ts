/**
 * Master switch for the Facebook / Instagram surfaces (LT-091).
 *
 * The imports themselves work — they were built in LT-010 / LT-042 / LT-043
 * and function for accounts holding a role on the Meta app. What they do not
 * have yet is App Review approval for `user_photos` and
 * `instagram_business_basic` (LT-089), so for an ordinary business owner every
 * one of these buttons ends at Meta's consent dialog refusing the scope. A
 * control that cannot work for the person clicking it should not be on screen,
 * so they are hidden until review passes.
 *
 * Flip `VITE_META_FEATURES_ENABLED=true` and rebuild to bring all of them back
 * at once — nothing else needs editing. It is deliberately opt-in rather than
 * opt-out: a missing or misspelled variable hides the pending features, which
 * is the safe direction.
 *
 * The Facebook *login* button used to sit behind this flag too. It has its
 * own switch since LT-552 (`facebookSignInAvailable`, VITE_FACEBOOK_LOGIN_ENABLED):
 * Facebook Login needs no review, only the server's keys.
 */
export const META_FEATURES_ENABLED =
  import.meta.env.VITE_META_FEATURES_ENABLED === 'true';
