/**
 * Phone display + link helpers (LT-122).
 *
 * Bookers type local Israeli numbers ("0584006014") and older rows carry the
 * E.164 form ("+972584006014"). Four components used to carry their own copy
 * of this conversion; this is the single one.
 */

const digitsOf = (phone: string): string => (phone ?? '').replace(/\D/g, '');

/** Local display form: "+972584006014" → "0584006014"; local input unchanged. */
export const formatPhoneForDisplay = (phone: string): string => {
  const digits = digitsOf(phone);
  if (!digits) return phone ?? '';
  if (digits.startsWith('972') && digits.length > 9) return `0${digits.slice(3)}`;
  return digits;
};

/** International digits for wa.me: "0584006014" → "972584006014". */
const internationalDigits = (phone: string): string => {
  const digits = digitsOf(phone);
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
};

export const telHref = (phone: string): string => `tel:${formatPhoneForDisplay(phone)}`;

export const whatsAppHref = (phone: string): string => `https://wa.me/${internationalDigits(phone)}`;
