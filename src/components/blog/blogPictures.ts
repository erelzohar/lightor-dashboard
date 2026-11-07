import globals from '../../services/globals';

/** A stored picture's address: an upload's name, or a full URL (a pack photo, a temporary AI picture). */
export const pictureSrc = (url: string | undefined | null): string => {
  if (!url) return '';
  return /^https?:\/\//.test(url) ? url : `${globals.imagesUrl}${url}`;
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * LT-610: the pictures already on the site, for a post's cover and its
 * pictures: the hero's, the gallery's, the highlights' and the services'.
 */
export const sitePicturesOf = (config: unknown): string[] => {
  const c = obj(obj(config).components);
  const out = new Set<string>();
  const add = (v: unknown) => { const s = str(v); if (s) out.add(s); };
  add(obj(c.hero).heroImageSrc);
  for (const item of (Array.isArray(obj(c.portfolio).items) ? obj(c.portfolio).items : []) as unknown[]) add(obj(item).url);
  for (const f of (Array.isArray(obj(c.about).features) ? obj(c.about).features : []) as unknown[]) add(obj(f).image);
  for (const type of (Array.isArray(obj(config).appointmentTypes) ? obj(config).appointmentTypes : []) as unknown[]) add(obj(type).image);
  return [...out].slice(0, 36);
};
