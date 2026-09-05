import { describe, it, expect } from 'vitest';
import { formatPhoneForDisplay, telHref, whatsAppHref } from '../../utils/phone';

describe('phone helpers (LT-122)', () => {
  it('shows the local form for both stored shapes', () => {
    expect(formatPhoneForDisplay('+972584006014')).toBe('0584006014');
    expect(formatPhoneForDisplay('0584006014')).toBe('0584006014');
    expect(formatPhoneForDisplay('058-400-6014')).toBe('0584006014');
    expect(formatPhoneForDisplay('')).toBe('');
  });

  it('builds wa.me links with the international prefix', () => {
    expect(whatsAppHref('0584006014')).toBe('https://wa.me/972584006014');
    expect(whatsAppHref('+972584006014')).toBe('https://wa.me/972584006014');
    expect(whatsAppHref('058-400-6014')).toBe('https://wa.me/972584006014');
  });

  it('builds tel links in the local form', () => {
    expect(telHref('+972584006014')).toBe('tel:0584006014');
  });
});
