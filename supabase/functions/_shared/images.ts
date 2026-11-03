/**
 * Image validation before anything is sent to the model (SPEC-A §A3): at most 4 images, jpeg/png/webp, each at most
 * ~1.5 MB decoded. The app resizes to ~1600 px / JPEG 0.85 first (the SGC lesson), so a legitimate photo is far below
 * the cap; the cap is the server's own guard, not a UX limit. The function never stores an image.
 */
export type ImageIn = { data: string; mime: string };

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 1_500_000;
export const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

/** Decoded size of a base64 string without decoding it. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** null = fine, otherwise a short English reason for the log (never shown to the person; the code is bad_input). */
export function validateImages(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return 'no images';
  if (images.length > MAX_IMAGES) return `more than ${MAX_IMAGES} images`;
  for (const [i, im] of images.entries()) {
    if (!im || typeof im !== 'object') return `image ${i} is not an object`;
    const { data, mime } = im as ImageIn;
    if (typeof data !== 'string' || data.length < 16) return `image ${i} has no data`;
    if (!ALLOWED_MIMES.includes(mime)) return `image ${i} has an unsupported type`;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return `image ${i} is not base64`;
    if (base64Bytes(data) > MAX_IMAGE_BYTES) return `image ${i} is too large`;
  }
  return null;
}
