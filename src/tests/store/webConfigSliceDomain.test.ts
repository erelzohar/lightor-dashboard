import { describe, it, expect } from 'vitest';
import reducer, { fetchWebConfig, updateWebConfig } from '../../store/slices/webConfigSlice';
import type { WebConfig } from '../../types';

/**
 * LT-661: `customHost` is the owner's own domain, sent by the API exactly
 * while the site is served on it. A read is the truth; a save never changes
 * the domain (only /api/domain does), so a save's answer that does not name
 * it must not make every link fall back to the Lightor address.
 */
const site = (over: Partial<WebConfig> = {}): WebConfig => ({ _id: 'wc1', subDomain: 'dana', businessName: 'Dana', ...over }) as WebConfig;
type State = ReturnType<typeof reducer>;
const start: State = { data: null, loading: false, error: null };
const read = (state: State, payload: WebConfig) => reducer(state, fetchWebConfig.fulfilled(payload, 'r', payload._id));
const save = (state: State, payload: WebConfig) =>
  reducer(state, updateWebConfig.fulfilled(payload, 's', { _id: payload._id }));

describe("the site's config and the owner's own domain", () => {
  it('a read brings the domain, and a later read takes it away', () => {
    let state = read(start, site({ customHost: 'www.dana-studio.co.il' }));
    expect(state.data?.customHost).toBe('www.dana-studio.co.il');
    state = read(state, site());
    expect(state.data?.customHost).toBeUndefined();
  });

  it("a save whose answer does not name the domain keeps the last read's", () => {
    let state = read(start, site({ customHost: 'www.dana-studio.co.il' }));
    state = save(state, site({ businessName: 'Dana Studio' }));
    expect(state.data?.businessName).toBe('Dana Studio');
    expect(state.data?.customHost).toBe('www.dana-studio.co.il');
  });

  it("a save whose answer names the domain is taken at its word", () => {
    let state = read(start, site({ customHost: 'www.dana-studio.co.il' }));
    state = save(state, site({ customHost: 'www.dana-new.co.il' }));
    expect(state.data?.customHost).toBe('www.dana-new.co.il');
  });

  it('a save with no domain before it adds none, and another site never inherits one', () => {
    let state = read(start, site());
    state = save(state, site({ businessName: 'Dana Studio' }));
    expect(state.data?.customHost).toBeUndefined();

    state = read(start, site({ customHost: 'www.dana-studio.co.il' }));
    state = save(state, site({ _id: 'wc2', subDomain: 'other' }));
    expect(state.data?._id).toBe('wc2');
    expect(state.data?.customHost).toBeUndefined();
  });
});
