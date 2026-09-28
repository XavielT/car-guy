/**
 * The phone's gallery, browsed by month (IMP 28092026 ADR-18, research §1).
 * Android/iOS only — library.web.ts stands in on web, where the import screen
 * uses a file input instead.
 *
 * Only `['photo']` is asked for (Play policy restricts broad media access), and
 * `ACCESS_MEDIA_LOCATION` is never enabled: GPS has no business in a car album
 * that may one day be public.
 */
import { Asset, AssetField, MediaType, presentPermissionsPicker, Query, requestPermissionsAsync } from 'expo-media-library';

import { resolveTakenAt } from '../domain/album';
import type { Candidate } from './index';

export const LIBRARY_AVAILABLE = true;

export type PhotoAccess = { granted: boolean; limited: boolean; canAskAgain: boolean };

export async function ensurePhotoPermission(): Promise<PhotoAccess> {
  const res = await requestPermissionsAsync(false, ['photo']);
  return { granted: res.granted, limited: res.accessPrivileges === 'limited', canAskAgain: res.canAskAgain };
}

/** Android 14+ partial access: let the user add more photos to what the app can see. */
export async function chooseMorePhotos(): Promise<void> {
  await presentPermissionsPicker(['photo']);
}

function images(): Query {
  return new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE);
}

/** Years that have photos, newest first — from the oldest photo on the phone to this year. */
export async function libraryYears(today = new Date()): Promise<number[]> {
  const oldest = await images().orderBy({ key: AssetField.CREATION_TIME, ascending: true }).limit(1).exeForMetadata();
  const first = oldest[0]?.creationTime ? new Date(oldest[0].creationTime).getFullYear() : today.getFullYear();
  const years: number[] = [];
  for (let y = today.getFullYear(); y >= first; y--) years.push(y);
  return years;
}

/** Photo count per month of `year` (index 0 = January), from one metadata query. */
export async function monthCounts(year: number): Promise<number[]> {
  const rows = await images()
    .gte(AssetField.CREATION_TIME, new Date(year, 0, 1).getTime())
    .lt(AssetField.CREATION_TIME, new Date(year + 1, 0, 1).getTime())
    .exeForMetadata();
  const counts = Array.from({ length: 12 }, () => 0);
  for (const r of rows) if (r.creationTime != null) counts[new Date(r.creationTime).getMonth()] += 1;
  return counts;
}

export type LibraryPhoto = { id: string; uri: string; width: number | null; height: number | null; creationTime: number | null };

/** The month's photos, newest first, with a URI the grid can draw. */
export async function monthPhotos(year: number, month0: number): Promise<LibraryPhoto[]> {
  const assets = await images()
    .gte(AssetField.CREATION_TIME, new Date(year, month0, 1).getTime())
    .lt(AssetField.CREATION_TIME, new Date(year, month0 + 1, 1).getTime())
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .exe();
  return Promise.all(
    assets.map(async (a) => {
      const [uri, width, height, creationTime] = await Promise.all([a.getUri(), a.getWidth(), a.getHeight(), a.getCreationTime()]);
      return { id: a.id, uri, width, height, creationTime };
    }),
  );
}

/**
 * Turns picked gallery assets into import candidates, reading each one's date
 * **now**, from the original: EXIF `DateTimeOriginal` first, MediaStore's
 * creation time second (a WhatsApp download carries the download day there).
 * Compression later strips EXIF, so this is the only moment it exists.
 */
export async function candidatesFromLibrary(photos: LibraryPhoto[]): Promise<Candidate[]> {
  return Promise.all(
    photos.map(async (p) => {
      let exif: unknown = null;
      try {
        const map = await new Asset(p.id).getExif();
        exif = map?.DateTimeOriginal ?? map?.DateTime ?? null;
      } catch {
        // No EXIF (a screenshot, a PNG): the creation time decides.
      }
      const { takenAt, source } = resolveTakenAt({ exif, fileTimeMs: p.creationTime });
      return { key: p.id, uri: p.uri, width: p.width, height: p.height, takenAt, dateSource: source, origin: 'library' as const };
    }),
  );
}
