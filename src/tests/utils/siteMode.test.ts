import { describe, it, expect } from 'vitest';
import { isBookableService, isLeadsSite, MAX_CTA_LENGTH } from '../../utils/siteMode';

/** The one place the dashboard reads what a site converts to (LT-199). */
describe('isLeadsSite', () => {
  it('is true only for a leads site', () => {
    expect(isLeadsSite({ conversion: 'lead' })).toBe(true);
    expect(isLeadsSite({ conversion: 'book' })).toBe(false);
  });

  it('reads a config without the field, or no config yet, as a booking site', () => {
    expect(isLeadsSite({})).toBe(false);
    expect(isLeadsSite(null)).toBe(false);
    expect(isLeadsSite(undefined)).toBe(false);
  });
});

describe('isBookableService', () => {
  it('needs a name and a positive duration', () => {
    expect(isBookableService({ name: 'Massage', durationMS: '3600000' })).toBe(true);
    expect(isBookableService({ name: 'Renovation' })).toBe(false);
    expect(isBookableService({ name: 'Renovation', durationMS: '' })).toBe(false);
    expect(isBookableService({ name: 'Renovation', durationMS: '0' })).toBe(false);
    expect(isBookableService({ name: '  ', durationMS: '3600000' })).toBe(false);
  });
});

describe('MAX_CTA_LENGTH', () => {
  it('matches the server limit on the main button text', () => {
    expect(MAX_CTA_LENGTH).toBe(24);
  });
});
