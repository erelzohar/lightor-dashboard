import { describe, it, expect } from 'vitest';
import { checkPhone, formatPhoneForDisplay, israeliPhoneKind, samePhone, telHref, toE164, whatsAppHref } from '../../utils/phone';

/**
 * LT-122, LT-404: every phone shape the dashboard meets (E.164 since
 * LT-404, and what older rows hold) reads as one number: shown nationally
 * with one hyphen, called and WhatsApped in the international form.
 */
describe('phone helpers', () => {
  it.each([
    ['+972584006014', '+972584006014'],
    ['0584006014', '+972584006014'],
    ['058-400-6014', '+972584006014'],
    ['050-123 4567', '+972501234567'],
    ['00972501234567', '+972501234567'],
    ['972501234567', '+972501234567'],
    ['+972 050-123-4567', '+972501234567'],
    ['03-1234567', '+97231234567'],
    ['077-1234567', '+972771234567'],
    ['+1 415 555 2671', '+14155552671'],
    ['0501234', null],
    ['', null],
    ['hello', null],
  ])('reads %j as %j', (raw, e164) => {
    expect(toE164(raw)).toBe(e164);
  });

  it.each([
    ['+972584006014', '058-4006014'],
    ['0584006014', '058-4006014'],
    ['058-400-6014', '058-4006014'],
    ['972584006014', '058-4006014'],
    ['+97231234567', '03-1234567'],
    ['021234567', '02-1234567'],
    ['089123456', '08-9123456'],
    ['0771234567', '077-1234567'],
    ['+14155552671', '+1 415 555 2671'],
    ['*2700', '*2700'],
    ['', ''],
  ])('shows %j as %j', (raw, shown) => {
    expect(formatPhoneForDisplay(raw)).toBe(shown);
  });

  it.each([
    ['+972584006014', 'tel:+972584006014'],
    ['0584006014', 'tel:+972584006014'],
    ['03-1234567', 'tel:+97231234567'],
    ['+1 415 555 2671', 'tel:+14155552671'],
    ['*2700', 'tel:2700'],
  ])('calls %j at %j', (raw, href) => {
    expect(telHref(raw)).toBe(href);
  });

  it.each([
    ['0584006014', 'https://wa.me/972584006014'],
    ['+972584006014', 'https://wa.me/972584006014'],
    ['058-400-6014', 'https://wa.me/972584006014'],
    ['+1 415 555 2671', 'https://wa.me/14155552671'],
  ])('WhatsApps %j at %j', (raw, href) => {
    expect(whatsAppHref(raw)).toBe(href);
  });

  it.each([
    ['0501234567', 'mobile'],
    ['+972541234567', 'mobile'],
    ['03-1234567', 'landline'],
    ['0771234567', 'landline'],
    ['+14155552671', null],
    ['0501234', null],
  ])('knows %j as a %s', (raw, kind) => {
    expect(israeliPhoneKind(raw)).toBe(kind);
  });

  it('takes a landline only where any Israeli number goes', () => {
    expect(checkPhone('03-1234567', 'any')).toEqual({ valid: true, kind: 'landline' });
    expect(checkPhone('03-1234567', 'mobile')).toEqual({ valid: false, kind: 'landline' });
    expect(checkPhone('0501234567', 'mobile')).toEqual({ valid: true, kind: 'mobile' });
    expect(checkPhone('+14155552671', 'any')).toEqual({ valid: false, kind: null });
  });

  it('knows one number however it is written', () => {
    expect(samePhone('050-123 4567', '+972501234567')).toBe(true);
    expect(samePhone('00972501234567', '0501234567')).toBe(true);
    expect(samePhone('0501234567', '0527654321')).toBe(false);
    expect(samePhone('', '')).toBe(false);
    expect(samePhone('*2700', '*2700')).toBe(true);
  });
});
