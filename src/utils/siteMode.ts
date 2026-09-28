import type { AppointmentType, WebConfig } from '../types';

/**
 * What the owner's site converts to (LT-199).
 *
 * `WebConfig.conversion` is the only switch: 'book' is a booking site (a
 * calendar, plus the contact form), 'lead' is a leads site (the contact form
 * is the conversion; there is no calendar). Absent reads 'book' — every site
 * before LT-199. Switching deletes nothing on the server: services, booking
 * questions, appointments and vacations stay stored, only what the dashboard
 * and the public site show changes.
 *
 * Every surface asks these helpers; none re-derives the mode inline.
 */

/** A leads site: no calendar, the contact form is the conversion. */
export const isLeadsSite = (config: Pick<WebConfig, 'conversion'> | null | undefined): boolean =>
  config?.conversion === 'lead';

/**
 * Can a customer book this service? A named service with a positive
 * duration — the rule the server enforces (SERVICE_NOT_BOOKABLE) and the
 * public site's resolver mirrors. A leads site's services carry no duration.
 */
export const isBookableService = (service: Pick<AppointmentType, 'name' | 'durationMS'>): boolean =>
  !!service.name?.trim() && Number(service.durationMS) > 0;

/** The main button's text limit, as the server enforces it (after trimming). */
export const MAX_CTA_LENGTH = 24;
