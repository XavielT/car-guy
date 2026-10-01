import { Platform } from 'react-native';

import { recordError } from '../diagnostics';
import { compressPhoto } from '../media/compress';
import { PROFILE_KEYS } from '../profile';
import { settings } from '../db/repos';
import { toBase64 } from './base64';

/**
 * "Foto pública" (IMP 01102026 note 16, sql/037): a 128 px JPEG of my profile photo as a data URI, stored on my
 * profile row only while the switch is on. Others see it; the original stays in the private bucket.
 */
const TARGET = { width: 128, quality: 0.72 };
const MAX_CHARS = 60_000;

async function readBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web' || uri.startsWith('data:') || uri.startsWith('blob:')) {
    return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  }
  const { File } = await import('expo-file-system');
  return new Uint8Array(await new File(uri).bytes());
}

/** The data URI for my current photo, or null when I have none (others then see my drawing). */
export async function publicPhotoDataUri(): Promise<string | null> {
  const rel = await settings.get<string | null>(PROFILE_KEYS.photo, null);
  if (!rel) return null;
  try {
    let source = rel;
    if (!rel.startsWith('data:') && Platform.OS !== 'web') {
      const { File, Paths } = await import('expo-file-system');
      const f = new File(Paths.document, rel);
      if (!f.exists) return null;
      source = f.uri;
    }
    const small = await compressPhoto(source, null, TARGET);
    const uri = `data:image/jpeg;base64,${toBase64(await readBytes(small.uri))}`;
    return uri.length <= MAX_CHARS ? uri : null;
  } catch (e) {
    recordError('public-photo', e);
    return null;
  }
}
