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

// Our images can appear in a portfolio item's `url` in two shapes: a bare S3
// imageName ("169…-uuid.webp"), or a full URL to our own images endpoint
// ("https://api.lightor.app/api/images/169…-uuid.webp"). Both are ours and
// deletable. Anything else — external AI/stock URLs, data:/blob: refs — is not.
//
// Returns the S3 imageName to delete, or null when the ref isn't one of ours.
// `imagesBase` is globals.imagesUrl (…/api/images/).
export function storedImageName(url: string | undefined, imagesBase: string): string | null {
  if (!url) return null;

  // No URL scheme → a bare imageName (upload/import). Reject stray paths.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return url.includes('/') ? null : url;
  }

  // A full URL: ours only when it points at our images endpoint. Match the
  // canonical "/api/images/" segment so a stored prod URL still resolves when
  // the app runs against a different host (dev/preview).
  const base = imagesBase.endsWith('/') ? imagesBase : `${imagesBase}/`;
  const marker = '/api/images/';
  let tail: string | null = null;
  if (url.startsWith(base)) tail = url.slice(base.length);
  else {
    const idx = url.indexOf(marker);
    if (idx !== -1) tail = url.slice(idx + marker.length);
  }
  if (!tail) return null;

  tail = tail.split(/[?#]/)[0]; // drop any query/hash
  try {
    tail = decodeURIComponent(tail);
  } catch {
    /* leave as-is if it isn't valid percent-encoding */
  }
  return tail || null;
}

/**
 * The S3 imageNames of stored portfolio images that were removed in the edit —
 * ours, present originally, and no longer referenced anywhere in the draft.
 * Both sides are resolved to imageNames first, so an image kept under a
 * different ref shape (bare name vs full URL) is never deleted, external URLs
 * are ignored, and duplicates collapse.
 */
export function removedStoredImages(
  originalUrls: string[],
  draftUrls: string[],
  imagesBase: string
): string[] {
  const keep = new Set<string>();
  for (const url of draftUrls) {
    const name = storedImageName(url, imagesBase);
    if (name) keep.add(name);
  }

  const removed: string[] = [];
  const seen = new Set<string>();
  for (const url of originalUrls) {
    const name = storedImageName(url, imagesBase);
    if (!name || keep.has(name) || seen.has(name)) continue;
    seen.add(name);
    removed.push(name);
  }
  return removed;
}
