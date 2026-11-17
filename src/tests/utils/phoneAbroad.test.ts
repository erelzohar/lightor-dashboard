import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  checkPhone,
  deviceCountry,
  formatPhoneForDisplay,
  isAbroadPhone,
  openAbroadE164,
  phoneCountryOf,
  toE164,
} from '../../utils/phone';

/**
 * LT-677: a phone outside Israel. A local number is read in the country a
 * field's chip names, a number of a country the server opened is one an
 * owner's and a business's phone may be, and with no country open every
 * answer is what it was before.
 */
describe('phone helpers abroad (LT-677)', () => {
  it.each([
    ['(212) 555-0123', 'US', '+12125550123'],
    ['2125550123', 'US', '+12125550123'],
    ['1 212 555 0123', 'US', '+12125550123'],
    // 972 is a Texas area code there, not Israel's calling code.
    ['972-501-2345', 'US', '+19725012345'],
    // A number with its "+" or "00" is its own country's, whatever the chip.
    ['+972 50 123 4567', 'US', '+972501234567'],
    ['00972501234567', 'US', '+972501234567'],
    ['+972 050-123-4567', 'US', '+972501234567'],
    ['+1 212 555 0123', 'IL', '+12125550123'],
    // An Israeli number written locally is no number in the US.
    ['0501234567', 'US', null],
    ['212555', 'US', null],
  ])('reads %j in %s as %j', (raw, country, e164) => {
    expect(toE164(raw, country)).toBe(e164);
  });

  it('reads a local number as Israeli when no country is named', () => {
    expect(toE164('0501234567')).toBe('+972501234567');
    expect(toE164('2125550123')).toBeNull();
  });

  it('names the country of a valid number, and +1 is not always the US', () => {
    expect(phoneCountryOf('0501234567')).toBe('IL');
    expect(phoneCountryOf('+12125550123')).toBe('US');
    expect(phoneCountryOf('+14165550123')).toBe('CA');
    expect(phoneCountryOf('12345')).toBeNull();
    expect(phoneCountryOf('')).toBeNull();

    expect(isAbroadPhone('+12125550123')).toBe(true);
    expect(isAbroadPhone('+972501234567')).toBe(false);
    expect(isAbroadPhone('050-1234567')).toBe(false);
    expect(isAbroadPhone('nothing')).toBe(false);
  });

  it('knows a number of an open country, in E.164', () => {
    expect(openAbroadE164('+1 (212) 555-0123', ['US'])).toBe('+12125550123');
    // Canada shares +1 and is not open.
    expect(openAbroadE164('+14165550123', ['US'])).toBeNull();
    expect(openAbroadE164('+972501234567', ['US'])).toBeNull();
    expect(openAbroadE164('+12125550123', [])).toBeNull();
    expect(openAbroadE164('', ['US'])).toBeNull();
  });

  describe('which numbers a field takes', () => {
    it('is Israel only while no country is open, as before', () => {
      expect(checkPhone('+12125550123', 'mobile')).toEqual({ valid: false, kind: null });
      expect(checkPhone('+12125550123', 'any')).toEqual({ valid: false, kind: null });
      expect(checkPhone('+12125550123', 'world')).toEqual({ valid: true, kind: null });
      expect(checkPhone('0501234567', 'mobile')).toEqual({ valid: true, kind: 'mobile' });
      expect(checkPhone('031234567', 'mobile')).toEqual({ valid: false, kind: 'landline' });
      expect(checkPhone('031234567', 'any')).toEqual({ valid: true, kind: 'landline' });
    });

    it("takes a number of an open country as an owner's phone and as a business's", () => {
      expect(checkPhone('+12125550123', 'mobile', ['US'])).toEqual({ valid: true, kind: null });
      expect(checkPhone('+12125550123', 'any', ['US'])).toEqual({ valid: true, kind: null });
      // Israel's own rules stay: an owner's phone is a mobile.
      expect(checkPhone('031234567', 'mobile', ['US'])).toEqual({ valid: false, kind: 'landline' });
      expect(checkPhone('0501234567', 'mobile', ['US'])).toEqual({ valid: true, kind: 'mobile' });
    });

    it('refuses a country that is not open, Canada behind +1 included', () => {
      expect(checkPhone('+14165550123', 'mobile', ['US']).valid).toBe(false);
      expect(checkPhone('+442079460958', 'any', ['US']).valid).toBe(false);
      expect(checkPhone('+442079460958', 'world', ['US']).valid).toBe(true);
    });

    it('reads a local number in the country of the chip', () => {
      expect(checkPhone('(212) 555-0123', 'mobile', ['US'], 'US')).toEqual({ valid: true, kind: null });
      // The same digits are no Israeli number.
      expect(checkPhone('(212) 555-0123', 'mobile', ['US'])).toEqual({ valid: false, kind: null });
      // A Canadian number written locally under the US chip is still Canada's.
      expect(checkPhone('416 555 0123', 'mobile', ['US'], 'US').valid).toBe(false);
      expect(checkPhone('416 555 0123', 'world', ['US'], 'US').valid).toBe(true);
      // An Israeli one written locally is no number under the US chip.
      expect(checkPhone('050-123-4567', 'mobile', ['US'], 'US').valid).toBe(false);
      expect(checkPhone('+972501234567', 'mobile', ['US'], 'US')).toEqual({ valid: true, kind: 'mobile' });
    });
  });

  it('shows a number abroad internationally, as before', () => {
    expect(formatPhoneForDisplay('+12125550123')).toBe('+1 212 555 0123');
  });

  describe("the device's region", () => {
    afterEach(() => vi.unstubAllGlobals());
    it.each([
      ['en-US', 'US'],
      ['he-IL', 'IL'],
      ['zh-Hant-TW', 'TW'],
      ['es_mx', 'MX'],
      ['he', null],
      ['', null],
    ])('reads %j as %j', (language, region) => {
      vi.stubGlobal('navigator', { language });
      expect(deviceCountry()).toBe(region);
    });
  });
});
