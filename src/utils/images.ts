import globals from '../services/globals';

/** Bare names are S3 images served by the images API; full URLs pass through. */
export const resolveImage = (name: string): string =>
  /^(https?:|data:|blob:)/.test(name) ? name : globals.imagesUrl + name;
