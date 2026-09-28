/**
 * EXIF date of a picked file, native side: the picker already hands back the
 * EXIF map (`exif: true`), so there is nothing to parse here. The web build
 * swaps in exif.web.ts, which reads the File with exifr.
 */
export async function readFileExifDate(_file: unknown): Promise<unknown> {
  return null;
}
