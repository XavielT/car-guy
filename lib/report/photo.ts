import { Platform } from 'react-native';

import { getMedia } from '../media';

/**
 * The vehicle photo as a `data:` URI for the printed report.
 *
 * Android's print WebView renders the HTML with no file access, so a
 * `file:///.../photo.jpg` in an `<img src>` silently yields a broken image —
 * the one documented gotcha of `expo-print`. Base64 is the only form that
 * survives. On web the photo lives in a blob and an object URL would be revoked
 * before the print dialog resolved, so the same encoding does the same job.
 *
 * Returns null rather than throwing on anything unexpected: a report without a
 * photo is a report, and a report that failed to generate is not.
 */
export async function photoDataUri(mediaId: string | null | undefined): Promise<string | null> {
  if (!mediaId) return null;

  try {
    const media = await getMedia(mediaId);
    if (!media || media.kind !== 'photo') return null;
    const mime = media.mime || 'image/jpeg';

    if (Platform.OS === 'web') {
      if (!media.blob) return null;
      return `data:${mime};base64,${base64FromBytes(media.blob)}`;
    }

    if (!media.relPath) return null;
    const { File, Paths } = await import('expo-file-system');
    const file = new File(Paths.document, media.relPath);
    if (!file.exists) return null;
    return `data:${mime};base64,${file.base64()}`;
  } catch {
    return null;
  }
}

/**
 * Bytes to base64 without Buffer, which react-native-web does not ship.
 *
 * Chunked because `String.fromCharCode(...bytes)` on a megapixel photo blows
 * the argument limit and throws a RangeError.
 */
function base64FromBytes(source: Uint8Array): string {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
