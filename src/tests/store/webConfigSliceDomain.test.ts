import { describe, it, expect } from 'vitest';
import reducer, { createWebConfig, fetchWebConfig, updateWebConfig } from '../../store/slices/webConfigSlice';
import type { WebConfig } from '../../types';

/**
 * LT-661: `customHost` is the owner's own domain, a top-level string the API
 * sends exactly while the site is served on it - on the owner's read
 * (`GET /api/web-configs/:id`) AND on a save's answer
 * (`PUT /api/web-configs/:id`). So the store takes every answer as it is:
 * one that names no domain means "not served now", and every link falls
 * back to the Lightor address. Nothing is carried over from an older answer.
 *
 * The store is written by these three thunks alone, and each one's answer is
 * a whole site config - there is no partial answer to merge a domain into.
 */
const site = (over: Partial<WebConfig> = {}): WebConfig => ({ _id: 'wc1', subDomain: 'dana', businessName: 'Dana', ...over }) as WebConfig;
type State = ReturnType<typeof reducer>;
const start: State = { data: null, loading: false, error: null };
const read = (state: State, payload: WebConfig) => reducer(state, fetchWebConfig.fulfilled(payload, 'r', payload._id));
const save = (state: State, payload: WebConfig) => reducer(state, updateWebConfig.fulfilled(payload, 's', { _id: payload._id }));

describe("the site's config and the owner's own domain", () => {
  it('a read brings the domain, and a later read takes it away', () => {
    let state = read(start, site({ customHost: 'www.dana-studio.co.il' }));
    expect(state.data?.customHost).toBe('www.dana-studio.co.il');
    state = read(state, site());
    expect(state.data).not.toHaveProperty('customHost');
  });

  it("a save's answer that names the domain keeps the links on it", () => {
    let state = read(start, site({ customHost: 'www.dana-studio.co.il' }));
    state = save(state, site({ businessName: 'Dana Studio', customHost: 'www.dana-studio.co.il' }));
    expect(state.data?.businessName).toBe('Dana Studio');
    expect(state.data?.customHost).toBe('www.dana-studio.co.il');
  });

  it("a save's answer with no domain means it is not served now: nothing is kept from the last read", () => {
    let state = read(start, site({ customHost: 'www.dana-studio.co.il' }));
    state = save(state, site({ businessName: 'Dana Studio' }));
    expect(state.data?.businessName).toBe('Dana Studio');
    expect(state.data).not.toHaveProperty('customHost');
  });

  it("a save's answer can bring a domain the last read did not have", () => {
    let state = read(start, site());
    state = save(state, site({ customHost: 'www.dana-studio.co.il' }));
    expect(state.data?.customHost).toBe('www.dana-studio.co.il');
  });

  it('the store holds exactly what the last answer said, whichever of the three wrote it', () => {
    const answer = site({ customHost: 'www.dana-studio.co.il' });
    expect(read(start, answer).data).toEqual(answer);
    expect(save(read(start, site()), answer).data).toEqual(answer);
    expect(reducer(start, createWebConfig.fulfilled(site(), 'c', {})).data).toEqual(site());
  });
});
