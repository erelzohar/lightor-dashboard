import { describe, it, expect } from 'vitest';
import { isAccountNotVerified, isAiBusy } from '../../lib/aiErrors';

/** LT-724: an owner with neither a verified email nor a proven phone is refused AI with 403 ACCOUNT_NOT_VERIFIED. */
describe('AI refusals', () => {
  it('tells an account not verified from the other refusals', () => {
    const refused = (status: number, code?: string) => ({ response: { status, data: { code } } });
    expect(isAccountNotVerified(refused(403, 'ACCOUNT_NOT_VERIFIED'))).toBe(true);
    expect(isAccountNotVerified(refused(403, 'AI_IMAGES_PLUS'))).toBe(false);
    expect(isAccountNotVerified(refused(429, 'AI_BUSY'))).toBe(false);
    expect(isAccountNotVerified(refused(400, 'ACCOUNT_NOT_VERIFIED'))).toBe(false);
    expect(isAccountNotVerified(new Error('network'))).toBe(false);
    expect(isAccountNotVerified(undefined)).toBe(false);
    expect(isAiBusy(refused(403, 'ACCOUNT_NOT_VERIFIED'))).toBe(false);
  });
});
