import { describe, it, expect } from 'vitest';
import {
  bookingFieldProblems,
  bookingFieldsFromAi,
  compactAnswer,
  fieldsForService,
  mapsSearchUrl,
  normaliseBookingFields,
} from '../../utils/bookingFields';
import type { BookingField } from '../../types';

const field = (over: Partial<BookingField>): BookingField => ({
  label: 'Q',
  type: 'text',
  required: false,
  services: [],
  ...over,
});

describe('fieldsForService', () => {
  const catalog = [
    field({ key: 'all', services: [] }),
    field({ key: 'only-a', services: ['a'] }),
    field({ key: 'a-or-b', services: ['a', 'b'] }),
  ];

  it('keeps unscoped fields and those naming the service, in catalog order', () => {
    expect(fieldsForService(catalog, 'a').map((f) => f.key)).toEqual(['all', 'only-a', 'a-or-b']);
    expect(fieldsForService(catalog, 'b').map((f) => f.key)).toEqual(['all', 'a-or-b']);
    expect(fieldsForService(catalog, 'c').map((f) => f.key)).toEqual(['all']);
  });

  it('copes with a missing catalog and a numeric id', () => {
    expect(fieldsForService(undefined, 'a')).toEqual([]);
    expect(fieldsForService([field({ key: 'n', services: ['7'] })], 7).map((f) => f.key)).toEqual(['n']);
  });
});

describe('bookingFieldProblems', () => {
  it('accepts a well-formed catalog', () => {
    expect(
      bookingFieldProblems([
        field({ label: 'Address', type: 'address' }),
        field({ label: 'Parking', type: 'choice', options: ['Yes', 'No'] }),
      ]).size
    ).toBe(0);
  });

  it('flags a blank label, a bad option list, a second address and a ninth field', () => {
    const problems = bookingFieldProblems([
      field({ label: '   ' }),
      field({ type: 'choice', options: ['Only one'] }),
      field({ type: 'choice', options: ['Dup', 'Dup'] }),
      field({ type: 'address' }),
      field({ type: 'address' }),
      field({}),
      field({}),
      field({}),
      field({}),
    ]);
    expect(problems.get(0)).toEqual(['label']);
    expect(problems.get(1)).toEqual(['options']);
    expect(problems.get(2)).toEqual(['options']);
    expect(problems.get(3)).toBeUndefined();
    expect(problems.get(4)).toEqual(['address']);
    expect(problems.get(8)).toEqual(['count']);
  });
});

describe('normaliseBookingFields', () => {
  it('trims, keeps keys only when present, and options only on a choice', () => {
    expect(
      normaliseBookingFields([
        field({ key: 'k', label: '  Address ', type: 'address', options: ['stale'] }),
        field({ label: 'New', type: 'choice', options: [' A ', 'B'] }),
        field({ key: '', label: 'Blank key' }),
      ])
    ).toEqual([
      { key: 'k', label: 'Address', type: 'address', required: false, services: [] },
      { label: 'New', type: 'choice', required: false, services: [], options: ['A', 'B'] },
      { label: 'Blank key', type: 'text', required: false, services: [] },
    ]);
  });
});

describe('bookingFieldsFromAi', () => {
  it('returns undefined when the draft carries no array, so the key stays off the request', () => {
    expect(bookingFieldsFromAi(undefined)).toBeUndefined();
    expect(bookingFieldsFromAi(null)).toBeUndefined();
    expect(bookingFieldsFromAi('nope')).toBeUndefined();
  });

  it('keeps what the AI may propose and drops what it may not', () => {
    expect(
      bookingFieldsFromAi([
        { label: ' Address ', type: 'address', required: true },
        { label: 'Parking', type: 'choice', options: ['Yes', 'No', ''] },
        { label: 'Second address', type: 'address' },
        { label: '', type: 'text' },
        { label: 'Unknown', type: 'rating' },
        'garbage',
      ])
    ).toEqual([
      { label: 'Address', type: 'address', required: true, services: [] },
      { label: 'Parking', type: 'choice', required: false, services: [], options: ['Yes', 'No'] },
    ]);
  });
});

describe('answers helpers', () => {
  it('builds the contract maps link', () => {
    expect(mapsSearchUrl('Herzl 12, Tel Aviv')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Herzl%2012%2C%20Tel%20Aviv'
    );
  });

  it('picks the address for a compact row, else the first answer', () => {
    const answers = [
      { key: 'car', label: 'Car', value: 'Mazda' },
      { key: 'address', label: 'Address', value: 'Herzl 12' },
    ];
    expect(compactAnswer(answers, new Set(['address']))?.key).toBe('address');
    expect(compactAnswer(answers, new Set())?.key).toBe('car');
    expect(compactAnswer([], new Set(['address']))).toBeUndefined();
  });
});
