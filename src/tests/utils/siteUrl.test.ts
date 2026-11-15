import { describe, it, expect } from 'vitest';
import { customHostOf, publicSiteHostOf, publicSiteUrlOf, siteUrlOf } from '../../utils/siteUrl';

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

/**
 * LT-661 - the owner's own domain is the site's address while the site is
 * served on it (`customHost` from the API), by the same care: only a plain
 * host name is used, anything else falls back to the Lightor address.
 */
describe('customHostOf', () => {
  it('takes a plain host name as it is', () => {
    expect(customHostOf('www.dana-studio.co.il')).toBe('www.dana-studio.co.il');
    expect(customHostOf('shop.example.com')).toBe('shop.example.com');
    expect(customHostOf('xn--4dbrk0ce.co.il')).toBe('xn--4dbrk0ce.co.il');
  });

  it('takes nothing that is more, or less, than a host name', () => {
    for (const bad of [
      'https://www.dana-studio.co.il',
      'www.dana-studio.co.il/x',
      'www.dana-studio.co.il:8443',
      'user@www.dana-studio.co.il',
      'www.dana-studio.co.il?x=1',
      'www.dana-studio.co.il#x',
      'www.dana studio.co.il',
      'WWW.Dana-Studio.co.il',
      'localhost',
      '-bad.example.com',
      'bad-.example.com',
      'a..example.com',
      '.example.com',
      'example.com.',
      '*.example.com',
      '10.0.0.1',
      'javascript:alert(1)',
      `${'a'.repeat(250)}.com`,
      '',
    ]) {
      expect(customHostOf(bad), bad).toBeNull();
    }
    expect(customHostOf(null)).toBeNull();
    expect(customHostOf(undefined)).toBeNull();
    expect(customHostOf(42 as unknown as string)).toBeNull();
  });

  it('never takes a Lightor address for an own domain', () => {
    expect(customHostOf('lightor.app')).toBeNull();
    expect(customHostOf('dana.lightor.app')).toBeNull();
    expect(customHostOf('api.lightor.app')).toBeNull();
    // Another site's name that only looks alike is a host name like any other.
    expect(customHostOf('lightor.app.example.com')).toBe('lightor.app.example.com');
  });
});

describe('publicSiteUrlOf', () => {
  it("is the owner's domain while the site is served on it", () => {
    expect(publicSiteUrlOf({ subDomain: 'dana', customHost: 'www.dana-studio.co.il' })).toBe('https://www.dana-studio.co.il');
    expect(publicSiteHostOf({ subDomain: 'dana', customHost: 'www.dana-studio.co.il' })).toBe('www.dana-studio.co.il');
  });

  it('is the Lightor address with no domain', () => {
    expect(publicSiteUrlOf({ subDomain: 'dana' })).toBe('https://dana.lightor.app');
    expect(publicSiteUrlOf({ subDomain: 'dana', customHost: null })).toBe('https://dana.lightor.app');
    expect(publicSiteHostOf({ subDomain: 'dana' })).toBe('dana.lightor.app');
  });

  it('falls back to the Lightor address for a domain that is no plain host name', () => {
    expect(publicSiteUrlOf({ subDomain: 'dana', customHost: 'evil.example/x?' })).toBe('https://dana.lightor.app');
    expect(publicSiteUrlOf({ subDomain: 'dana', customHost: 'https://evil.example' })).toBe('https://dana.lightor.app');
    expect(publicSiteHostOf({ subDomain: 'dana', customHost: 'a@evil.example' })).toBe('dana.lightor.app');
  });

  it('offers nothing when neither is safe', () => {
    expect(publicSiteUrlOf({ subDomain: 'login-lightor.example/x?', customHost: 'evil.example#' })).toBeNull();
    expect(publicSiteHostOf({ subDomain: '', customHost: '' })).toBeNull();
    expect(publicSiteUrlOf(null)).toBeNull();
    expect(publicSiteUrlOf(undefined)).toBeNull();
  });

  it('leaves the previews their Lightor address: siteUrlOf knows no domain', () => {
    // The editor's frame and a post's preview build theirs from the sub-domain alone.
    expect(siteUrlOf('dana')).toBe('https://dana.lightor.app');
    expect(siteUrlOf.length).toBe(1);
  });
});
