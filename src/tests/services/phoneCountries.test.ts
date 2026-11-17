import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import apiClient from '../../services/apiClient';
import globals from '../../services/globals';
import {
  getPhoneCountries,
  loadPhoneCountries,
  resetPhoneCountries,
  setOpenAbroad,
  setOwnerPhone,
} from '../../services/phoneCountries';
import { usePhoneCountries } from '../../hooks/usePhoneCountries';

/**
 * LT-677: the countries a phone may be from. `GET /api/messaging/phone-countries`
 * answers `{ success, data: { home: "IL", abroad: ["US"] } }`; it is asked
 * once per page load, and until it answers, or when it fails (an older API
 * answers 404), the list is Israel alone.
 */
const answer = (abroad: unknown) => ({ data: { success: true, data: { home: 'IL', abroad } } }) as never;

describe('the open countries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetPhoneCountries();
  });

  it('is Israel alone before anything is asked', () => {
    expect(getPhoneCountries().abroad).toEqual([]);
    const { result } = renderHook(() => usePhoneCountries());
    expect(result.current).toEqual({ abroad: [], countries: ['IL'], defaultCountry: 'IL' });
  });

  it('asks the API once, at its own route, and keeps the answer for the page', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(answer(['US']));
    await expect(loadPhoneCountries()).resolves.toEqual(['US']);
    await expect(loadPhoneCountries()).resolves.toEqual(['US']);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(`${globals.messagingUrl}phone-countries`);
    expect(getPhoneCountries().abroad).toEqual(['US']);
  });

  it.each([
    ['a 404 from an older API', () => Promise.reject({ response: { status: 404 } })],
    ['no network', () => Promise.reject(new Error('Network Error'))],
    ['an answer with no list', () => Promise.resolve({ data: { success: true } })],
    ['an answer that is not a list', () => Promise.resolve(answer('US'))],
  ])('is Israel alone after %s, and does not ask again', async (_name, reply) => {
    const get = vi.spyOn(apiClient, 'get').mockImplementation(reply as never);
    await expect(loadPhoneCountries()).resolves.toEqual([]);
    await expect(loadPhoneCountries()).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(getPhoneCountries().abroad).toEqual([]);
  });

  it('offers only the countries the app has a chip for, once each, and never Israel twice', () => {
    setOpenAbroad(['us', 'US', 'IL', 'ZZ', 42, 'GB']);
    expect(getPhoneCountries().abroad).toEqual(['US']);
  });

  it('tells the fields when a country opens', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(answer(['US']));
    const { result } = renderHook(() => usePhoneCountries());
    expect(result.current.countries).toEqual(['IL']);
    await act(async () => {
      await loadPhoneCountries();
    });
    expect(result.current.abroad).toEqual(['US']);
    expect(result.current.countries).toEqual(['IL', 'US']);
  });

  it("starts an empty field on the country of the owner's phone, when it is offered", () => {
    const { result } = renderHook(() => usePhoneCountries());
    act(() => setOwnerPhone('+12125550123'));
    // Not offered yet: Israel.
    expect(result.current.defaultCountry).toBe('IL');
    act(() => setOpenAbroad(['US']));
    expect(result.current.defaultCountry).toBe('US');
    act(() => setOwnerPhone('050-1234567'));
    expect(result.current.defaultCountry).toBe('IL');
    act(() => setOwnerPhone(undefined));
    expect(result.current.defaultCountry).toBe('IL');
  });
});
