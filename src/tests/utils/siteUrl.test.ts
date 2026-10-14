import { describe, it, expect } from 'vitest';
import { siteUrlOf } from '../../utils/siteUrl';

/**
 * LT-315 (security L2) — a site link is offered only for a real lightor.app
 * subdomain: the owner's `subDomain` once made the admin's "open site" link
 * point anywhere.
 */
describe('siteUrlOf', () => {
  it('builds the address of a plain label', () => {
    expect(siteUrlOf('dana-nails')).toBe('https://dana-nails.lightor.app');
    expect(siteUrlOf('studio9')).toBe('https://studio9.lightor.app');
  });

  it('offers nothing for a label that would leave lightor.app', () => {
    expect(siteUrlOf('login-lightor.example/x?')).toBeNull();
    expect(siteUrlOf('evil.example#')).toBeNull();
    expect(siteUrlOf('a@evil.example:443/')).toBeNull();
    expect(siteUrlOf('Dana')).toBeNull();
    expect(siteUrlOf('')).toBeNull();
    expect(siteUrlOf(undefined)).toBeNull();
  });
});
