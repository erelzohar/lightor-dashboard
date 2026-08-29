import type { AppointmentType } from '../types';

/**
 * Reconciling an AI-edited config against what the server actually has.
 *
 * The AI returns a COMPLETE config on every edit: it echoes existing services
 * (with their real ids) and invents new ones with fabricated — but valid-
 * looking, 24-hex — ids. So "looks like an ObjectId" cannot distinguish a new
 * service from an existing one; only membership in the server's real id set can.
 *
 * These helpers are pure so the destructive decisions (what gets DELETED) are
 * unit-tested in isolation — a regression here would silently delete a user's
 * services or orphan/blow away their uploaded images.
 */

export interface TypeReconcile {
  toCreate: Omit<AppointmentType, '_id'>[];
  toUpdate: AppointmentType[];
  toDeleteIds: string[];
}

/**
 * Split the AI's services into create / update / delete against the real set.
 * `draftTypes` is what the AI returned; `existingTypes` is what the server has.
 */
export function reconcileAppointmentTypes(
  draftTypes: AppointmentType[],
  existingTypes: Pick<AppointmentType, '_id'>[]
): TypeReconcile {
  const existingIds = new Set(existingTypes.map((t) => t._id));
  const draftIds = new Set(draftTypes.map((t) => t._id).filter(Boolean));

  const toCreate: Omit<AppointmentType, '_id'>[] = [];
  const toUpdate: AppointmentType[] = [];
  for (const type of draftTypes) {
    if (type._id && existingIds.has(type._id)) {
      toUpdate.push(type);
    } else {
      const { _id, ...rest } = type;
      void _id;
      toCreate.push(rest);
    }
  }

  const toDeleteIds = existingTypes.filter((t) => !draftIds.has(t._id)).map((t) => t._id);
  return { toCreate, toUpdate, toDeleteIds };
}

// A stored (uploaded/imported) image is a bare S3 imageName; external AI/stock
// images are absolute URLs (http…) and data:/blob: refs — never ours to delete.
export function isStoredImage(url?: string): boolean {
  return !!url && !/^(https?:|data:|blob:)/i.test(url);
}

/**
 * The imageNames of stored portfolio images that were removed in the edit —
 * present in `originalUrls`, absent from `draftUrls`, and actually ours to
 * delete. External URLs are ignored on both sides.
 */
export function removedStoredImages(originalUrls: string[], draftUrls: string[]): string[] {
  const keep = new Set(draftUrls);
  return originalUrls.filter((url) => isStoredImage(url) && !keep.has(url));
}
