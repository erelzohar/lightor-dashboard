import type { User } from '../types';

/**
 * LT-410: the public site answers once the owner proved the email or a phone
 * (until then it answers 403). LT-724: every email signup starts there now,
 * since the phone is no longer demanded at signup.
 */
export const isSiteLive = (user: Pick<User, 'isVerified' | 'phoneVerifiedAt'> | null | undefined): boolean =>
  !!user?.isVerified || !!user?.phoneVerifiedAt;
