import type { AppointmentAnswer, BookingField, BookingFieldType } from '../types';

/**
 * Custom booking questions (LT-178): the limits the server enforces, mirrored
 * here so the editor and the owner's booking modal refuse the same things,
 * and the scope helper every surface shares.
 */

export const MAX_BOOKING_FIELDS = 8;
export const MAX_LABEL_LENGTH = 40;
export const MIN_CHOICE_OPTIONS = 2;
export const MAX_CHOICE_OPTIONS = 10;
export const MAX_OPTION_LENGTH = 30;

export const BOOKING_FIELD_TYPES: BookingFieldType[] = ['text', 'address', 'note', 'choice', 'confirm'];

/** Value caps per shape, as the server enforces them. */
export const ANSWER_MAX_LENGTH: Record<BookingFieldType, number> = {
  text: 100,
  address: 200,
  note: 1000,
  choice: MAX_OPTION_LENGTH,
  confirm: 3,
};

/** The stored value of a ticked confirm. */
export const CONFIRM_YES = 'yes';

/**
 * The questions a booking of `serviceId` is asked, in catalog order: a field
 * with no services applies to every service.
 */
export const fieldsForService = (
  catalog: BookingField[] | undefined,
  serviceId: string | number | undefined
): BookingField[] => {
  const id = serviceId === undefined || serviceId === null ? '' : String(serviceId);
  return (catalog ?? []).filter(
    (field) => !field.services?.length || field.services.includes(id)
  );
};

export const isChoice = (field: Pick<BookingField, 'type'>): boolean => field.type === 'choice';

/** A brand-new question as the editor creates it: no key until the server assigns one. */
export const newBookingField = (): BookingField => ({
  label: '',
  type: 'text',
  required: false,
  services: [],
});

/**
 * What is wrong with a draft catalog, keyed by field index — the editor shows
 * these inline and Settings refuses to save while any exist. Mirrors the
 * server's zod schema so a refused save never comes as a surprise.
 */
export type BookingFieldProblem = 'label' | 'options' | 'address' | 'count';

export const bookingFieldProblems = (fields: BookingField[]): Map<number, BookingFieldProblem[]> => {
  const problems = new Map<number, BookingFieldProblem[]>();
  const add = (index: number, problem: BookingFieldProblem) => {
    problems.set(index, [...(problems.get(index) ?? []), problem]);
  };

  let addressSeen = false;
  fields.forEach((field, index) => {
    const label = field.label?.trim() ?? '';
    if (!label || label.length > MAX_LABEL_LENGTH) add(index, 'label');

    if (field.type === 'choice') {
      const options = (field.options ?? []).map((o) => o.trim());
      const unique = new Set(options);
      if (
        options.length < MIN_CHOICE_OPTIONS ||
        options.length > MAX_CHOICE_OPTIONS ||
        options.some((o) => !o || o.length > MAX_OPTION_LENGTH) ||
        unique.size !== options.length
      ) {
        add(index, 'options');
      }
    }

    if (field.type === 'address') {
      if (addressSeen) add(index, 'address');
      addressSeen = true;
    }

    if (index >= MAX_BOOKING_FIELDS) add(index, 'count');
  });

  return problems;
};

export const bookingFieldsValid = (fields: BookingField[]): boolean =>
  bookingFieldProblems(fields).size === 0;

/**
 * The catalog as it goes on the wire: trimmed, `options` only on a choice,
 * `key` only when the server gave us one. Anything else the server would
 * refuse or regenerate anyway.
 */
export const normaliseBookingFields = (fields: BookingField[]): BookingField[] =>
  fields.map((field) => {
    const out: BookingField = {
      label: field.label.trim(),
      type: field.type,
      required: !!field.required,
      services: (field.services ?? []).map(String),
    };
    if (typeof field.key === 'string' && field.key) out.key = field.key;
    if (field.type === 'choice') out.options = (field.options ?? []).map((o) => o.trim());
    return out;
  });

/**
 * Booking questions proposed by the AI builder (LT-178): it proposes
 * label / type / required / options and never a key or an answer. Returns
 * `undefined` when the draft carries no usable array at all, so the caller
 * leaves the key off the request and the stored catalog survives. A present
 * array is trusted as the new catalog (an empty one clears it).
 */
export const bookingFieldsFromAi = (input: unknown): BookingField[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  const fields: BookingField[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const type = item.type as BookingFieldType;
    if (!label || !BOOKING_FIELD_TYPES.includes(type)) continue;
    const field: BookingField = {
      label: label.slice(0, MAX_LABEL_LENGTH),
      type,
      required: item.required === true,
      services: Array.isArray(item.services) ? item.services.map(String) : [],
    };
    // A key that names a stored field survives on the server; anything else
    // is ignored there, so passing a string through is harmless.
    if (typeof item.key === 'string' && item.key) field.key = item.key;
    if (type === 'choice') {
      field.options = (Array.isArray(item.options) ? item.options : [])
        .filter((o): o is string => typeof o === 'string' && !!o.trim())
        .map((o) => o.trim().slice(0, MAX_OPTION_LENGTH))
        .slice(0, MAX_CHOICE_OPTIONS);
    }
    fields.push(field);
  }
  // A second address would be refused outright; keep the first.
  let addressSeen = false;
  return fields
    .filter((f) => {
      if (f.type !== 'address') return true;
      if (addressSeen) return false;
      addressSeen = true;
      return true;
    })
    .slice(0, MAX_BOOKING_FIELDS);
};

/** The Google Maps search link an address answer opens (per the LT-178 contract). */
export const mapsSearchUrl = (address: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** Which answers are addresses, given the catalog they were asked from. */
export const addressKeys = (catalog: BookingField[] | undefined): Set<string> =>
  new Set((catalog ?? []).filter((f) => f.type === 'address' && f.key).map((f) => f.key as string));

/**
 * The one answer a compact row shows: the address when there is one (the
 * owner has to get there), otherwise the first answer, otherwise nothing.
 */
export const compactAnswer = (
  answers: AppointmentAnswer[] | undefined,
  addresses: Set<string>
): AppointmentAnswer | undefined => {
  if (!answers?.length) return undefined;
  return answers.find((a) => addresses.has(a.key)) ?? answers[0];
};
