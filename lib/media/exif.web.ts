/**
 * EXIF date of a picked File on web. expo-image-picker's web build does not
 * read EXIF, so exifr's lite build (45 KB, dates included) does. A static
 * import: this file is only in the web bundle, and Metro's lazy `import()`
 * chunk failed to load in dev ("Requiring unknown module").
 */
import exifr from 'exifr/dist/lite.esm.js';

export async function readFileExifDate(file: unknown): Promise<unknown> {
  if (!(file instanceof Blob)) return null;
  try {
    // Segments, not a tag list: the lite build throws on `pick` arrays. Its
    // Dates are the camera's wall clock read as local time, which is the rule.
    const tags = await exifr.parse(file, { tiff: true, exif: true, gps: false, interop: false, ifd1: false });
    return tags?.DateTimeOriginal ?? tags?.CreateDate ?? tags?.ModifyDate ?? null;
  } catch {
    // Not a JPEG/HEIC with EXIF, or a truncated file: the file date takes over.
    return null;
  }
}
