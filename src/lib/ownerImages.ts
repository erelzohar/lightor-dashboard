/** LT-381 (register), LT-426 (site editor): the pictures an owner may add to one message of Lighty's chat. */
export const MAX_IMAGES = 3;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * What is added to `current`: pictures of a kind the server takes, up to
 * MAX_IMAGES in all. `refused` says some were left out.
 */
export function addImages(current: File[], added: File[]): { images: File[]; refused: boolean } {
  const fit = added.filter((f) => IMAGE_TYPES.includes(f.type));
  const images = [...current, ...fit].slice(0, MAX_IMAGES);
  return { images, refused: images.length < current.length + added.length };
}

/**
 * The chat sends up to three pictures in one request, and the
 * server's gateway takes about 10MB a request - a phone photo alone can be
 * more. A picture over 1.5MB is drawn again at most 1600px a side (what the
 * server keeps anyway) before it goes. WebP where the browser writes it
 * (it keeps a logo's transparency), JPEG otherwise. A picture the browser
 * cannot draw goes as it is; the server says whether it may.
 */
export const IMAGE_MAX_SIDE = 1600;
const KEEP_BYTES = 1.5 * 1024 * 1024;

const toBlob = (canvas: HTMLCanvasElement, type: string): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));

export async function shrinkImage(file: File): Promise<File> {
  if (file.size <= KEEP_BYTES || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = file.type === 'image/jpeg' ? null : await toBlob(canvas, 'image/webp');
    if (!blob || blob.type !== 'image/webp') {
      // No WebP writer (older Safari): JPEG, on white where the picture was clear.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      blob = await toBlob(canvas, 'image/jpeg');
    }
    bitmap.close?.();
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/webp' ? '.webp' : '.jpg');
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  }
}
