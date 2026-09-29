/**
 * Photos and files (ADR-10, IMP 28092026 ADR-18).
 *
 * Two storage strategies because the platforms genuinely differ: on Android the
 * bytes go to files under `Paths.document/media/<vehicleId>/` and the row keeps
 * **relative** paths (an absolute one breaks when the OS moves the sandbox); on
 * web `expo-file-system` does not exist at all, so the bytes live in the
 * `media.blob` / `media.thumb_blob` columns.
 *
 * Every photo goes through one `ingest()`: its date is read **before**
 * compressing (the manipulator strips EXIF), then it is written twice — the
 * full copy at 1600 px / JPEG 0.75 and a 400 px / 0.6 thumbnail for grids —
 * with a blurhash on native so a cell has a shape before its thumb arrives.
 * Grids never load the full copy: egress is the tighter cloud limit.
 */
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { findAlbumDupShapes } from '../db/albumQueries';
import { albumItems, media as mediaRepo } from '../db/repos';
import type { Media } from '../db/types';
import { isDuplicate, resolveTakenAt, type DatePrecision, type TakenAtSource } from '../domain/album';
import { id as newId } from '../format';
import { recordError } from '../diagnostics';
import { compressPhoto } from './compress';
import { readFileExifDate } from './exif';

export { MediaError } from './compress';

const FULL = { width: 1600, quality: 0.75 };
const THUMB = { width: 400, quality: 0.6 };

export type PickOptions = {
  camera?: boolean;
  ownerTable: string;
  ownerId: string;
  /** Used to group files on disk; falls back to the owner id. */
  vehicleId?: string;
};

/** A photo chosen but not yet stored: the confirmation sheet can still change its date. */
export type Candidate = {
  key: string;
  uri: string;
  width: number | null;
  height: number | null;
  takenAt: string | null;
  dateSource: TakenAtSource;
  origin: 'library' | 'picker' | 'camera';
  /** Web only: the picked File, for "descargar el original". */
  file?: Blob | null;
  fileName?: string | null;
};

export type IngestTarget = {
  vehicleId: string;
  ownerTable?: string;
  ownerId?: string;
  /** Adds an album_item (the default for vehicle photos). */
  album?: boolean;
  milestoneId?: string | null;
  modId?: string | null;
  trackEventId?: string | null;
};


async function readBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  return new Uint8Array(await response.arrayBuffer());
}

async function blurhashOf(uri: string): Promise<string | null> {
  if (Platform.OS === 'web') return null; // expo-image generates blurhashes on Android/iOS only.
  try {
    const { Image } = await import('expo-image');
    return await Image.generateBlurhashAsync(uri, [4, 3]);
  } catch {
    return null;
  }
}

export type IngestResult = { media: Media; duplicate: false } | { media: null; duplicate: true };

/**
 * Stores one photo: compress, thumb, blurhash, write, insert `media` (+ an
 * `album_item`). Skips it — and says so — when the vehicle's album already
 * holds the same photo (`dupShapes`, see lib/domain/album.ts).
 */
export async function ingest(
  candidate: Pick<Candidate, 'uri' | 'width' | 'takenAt'> & { precision?: DatePrecision; source: Media['source'] },
  target: IngestTarget,
  dupShapes?: Parameters<typeof isDuplicate>[1],
): Promise<IngestResult> {
  const full = await compressPhoto(candidate.uri, candidate.width, FULL);
  const thumb = await compressPhoto(full.uri, full.width, THUMB);
  const takenAt = candidate.takenAt;
  const web = Platform.OS === 'web';

  const fullBytes = web ? await readBytes(full.uri) : null;
  let sizeBytes = fullBytes?.byteLength ?? null;
  if (!web) {
    const { File } = await import('expo-file-system');
    sizeBytes = new File(full.uri).size ?? null;
  }

  if (dupShapes && isDuplicate({ width: full.width, height: full.height, takenAt, sizeBytes }, dupShapes)) {
    return { media: null, duplicate: true };
  }

  const mediaId = newId();
  const blurhash = await blurhashOf(thumb.uri);
  const common = {
    id: mediaId,
    ownerTable: target.ownerTable ?? 'vehicle',
    ownerId: target.ownerId ?? target.vehicleId,
    kind: 'photo' as const,
    mime: 'image/jpeg',
    width: full.width,
    height: full.height,
    sizeBytes,
    takenAt,
    datePrecision: candidate.precision ?? 'day',
    source: candidate.source,
    blurhash,
    deletedAt: null,
  };

  let saved: Media;
  if (web) {
    // Uint8Array, not ArrayBuffer: the web driver binds the former as a BLOB and
    // silently mangles the latter.
    saved = await mediaRepo.upsert({ ...common, blob: fullBytes, thumbBlob: await readBytes(thumb.uri) });
  } else {
    const { Directory, File, Paths } = await import('expo-file-system');
    const folderName = target.vehicleId;
    const folder = new Directory(Paths.document, 'media', folderName);
    if (!folder.exists) folder.create({ intermediates: true });
    new File(full.uri).copy(new File(folder, `${mediaId}.jpg`));
    new File(thumb.uri).copy(new File(folder, `${mediaId}.thumb.jpg`));
    saved = await mediaRepo.upsert({
      ...common,
      // Relative on purpose: Paths.document changes between installs and OS upgrades.
      relPath: `media/${folderName}/${mediaId}.jpg`,
      thumbRelPath: `media/${folderName}/${mediaId}.thumb.jpg`,
    });
  }

  if (target.album !== false) {
    await albumItems.upsert({
      id: newId(),
      vehicleId: target.vehicleId,
      mediaId,
      milestoneId: target.milestoneId ?? null,
      modId: target.modId ?? null,
      trackEventId: target.trackEventId ?? null,
      sortOrder: 0,
      deletedAt: null,
    });
  }
  return { media: saved, duplicate: false };
}

/**
 * Picks one or many photos with the system picker and reads each one's date
 * while the original is still in hand: EXIF from the picker on native, exifr
 * on the File on web, then the file's own date.
 *
 * Must be called straight from a press handler: on web the picker injects an
 * `<input type="file">` and clicks it, which browsers only allow inside a user
 * gesture. Returns [] when the user backs out.
 */
export async function pickCandidates(opts: { multiple?: boolean; camera?: boolean } = {}): Promise<Candidate[]> {
  const picked = opts.camera
    ? await ImagePicker.launchCameraAsync({ quality: 1, mediaTypes: ['images'], exif: true })
    : await ImagePicker.launchImageLibraryAsync({
        quality: 1,
        mediaTypes: ['images'],
        exif: true,
        allowsMultipleSelection: Boolean(opts.multiple),
        selectionLimit: opts.multiple ? 0 : 1,
      });
  if (picked.canceled || !picked.assets?.length) return [];

  return Promise.all(
    picked.assets.map(async (asset, i) => {
      const file = (asset as { file?: Blob }).file ?? null;
      const exif =
        (asset.exif as Record<string, unknown> | null | undefined)?.DateTimeOriginal ??
        (asset.exif as Record<string, unknown> | null | undefined)?.DateTime ??
        (file ? await readFileExifDate(file) : null);
      const fileTimeMs = file && 'lastModified' in file ? (file as File).lastModified : null;
      const now = opts.camera ? new Date().toISOString() : null;
      const resolved = now ? { takenAt: now, source: 'exif' as const } : resolveTakenAt({ exif, fileTimeMs });
      return {
        key: asset.assetId ?? `${i}:${asset.uri}`,
        uri: asset.uri,
        width: asset.width ?? null,
        height: asset.height ?? null,
        takenAt: resolved.takenAt,
        dateSource: resolved.source,
        origin: opts.camera ? ('camera' as const) : ('picker' as const),
        file,
        fileName: asset.fileName ?? null,
      };
    }),
  );
}

export type ImportProgress = { done: number; total: number; imported: number; duplicates: number; failed: number; mediaIds: string[] };

/**
 * Stores a confirmed batch into a vehicle's album, one photo at a time so the
 * screen can show progress and stop on "Cancelar" (what is already in stays in).
 */
export async function importCandidates(
  candidates: (Candidate & { precision: DatePrecision })[],
  target: IngestTarget,
  opts: { onProgress?: (p: ImportProgress) => void; shouldStop?: () => boolean } = {},
): Promise<ImportProgress> {
  const shapes = [...(await findAlbumDupShapes(target.vehicleId))];
  const progress: ImportProgress = { done: 0, total: candidates.length, imported: 0, duplicates: 0, failed: 0, mediaIds: [] };
  for (const c of candidates) {
    if (opts.shouldStop?.()) break;
    try {
      const source: Media['source'] = c.origin === 'library' ? 'library' : c.origin === 'camera' ? 'camera' : Platform.OS === 'web' ? 'web' : 'import';
      const result = await ingest({ ...c, source }, target, shapes);
      if (result.duplicate) progress.duplicates += 1;
      else {
        progress.imported += 1;
        progress.mediaIds.push(result.media.id);
        // Two copies of one photo in the same batch are duplicates too.
        shapes.push({ width: result.media.width, height: result.media.height, takenAt: result.media.takenAt, sizeBytes: result.media.sizeBytes });
      }
    } catch (error) {
      recordError('photo-import', error);
      progress.failed += 1;
    }
    progress.done += 1;
    opts.onProgress?.({ ...progress, mediaIds: [...progress.mediaIds] });
  }
  return progress;
}

/**
 * Picks (or shoots) one photo for a slot — a document, a receipt, the vehicle's
 * avatar — and stores it with its thumb. Not added to the album unless asked.
 */
export async function pickPhoto(options: PickOptions & { album?: boolean }): Promise<Media | null> {
  const [candidate] = await pickCandidates({ camera: options.camera });
  if (!candidate) return null;
  return storePhoto(candidate, options);
}

/**
 * The storing half of `pickPhoto`, on its own so a failed save can be retried
 * with the photo already in hand (the picker is not reopened).
 */
export async function storePhoto(
  candidate: Pick<Candidate, 'uri' | 'width' | 'takenAt'>,
  options: PickOptions & { album?: boolean },
): Promise<Media | null> {
  const result = await ingest(
    { ...candidate, source: options.camera ? 'camera' : Platform.OS === 'web' ? 'web' : 'import' },
    {
      vehicleId: options.vehicleId ?? options.ownerId,
      ownerTable: options.ownerTable,
      ownerId: options.ownerId,
      album: options.album ?? false,
    },
  );
  return result.media;
}

/**
 * Android can kill the activity while the camera or the gallery is open
 * ("No mantener actividades", low memory). The photo then comes back to a fresh
 * JS runtime through `getPendingResultAsync` instead of the awaited promise.
 * Null on web/iOS, when nothing was pending, or on an error result.
 */
export async function pendingPickedPhoto(): Promise<Pick<Candidate, 'uri' | 'width' | 'takenAt'> | null> {
  if (Platform.OS !== 'android') return null;
  const pending = await ImagePicker.getPendingResultAsync();
  if (!pending || 'code' in pending || pending.canceled || !pending.assets?.length) return null;
  const asset = pending.assets[0];
  const exif = asset.exif as Record<string, unknown> | null | undefined;
  const resolved = resolveTakenAt({ exif: exif?.DateTimeOriginal ?? exif?.DateTime ?? null, fileTimeMs: null });
  return { uri: asset.uri, width: asset.width ?? null, takenAt: resolved.takenAt };
}

/**
 * "Guardar original en Google Fotos/Drive": the system share sheet with the
 * untouched file, right after picking, while the original is still in hand.
 * Web downloads it instead. One sheet per photo — Android's share intent takes
 * one file from expo-sharing.
 */
export async function saveOriginal(candidate: Pick<Candidate, 'uri' | 'file' | 'fileName'>): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = candidate.file ?? (await (await fetch(candidate.uri)).blob());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = candidate.fileName || 'foto.jpg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(candidate.uri, { mimeType: 'image/jpeg' });
}

/**
 * A URI the image components can render — the thumb when asked for, else the
 * full copy (a row without a thumb falls back to the full one).
 *
 * On web this mints an object URL that the caller **must** revoke — use
 * `useMediaUri`, which does it on unmount.
 */
export async function mediaUri(item: Media | null, opts: { thumb?: boolean } = {}): Promise<string | null> {
  if (!item) return null;
  const wantThumb = Boolean(opts.thumb) && Boolean(item.thumbRelPath || item.thumbBlob || item.remoteThumbPath);

  // A row pulled from another device has metadata and no bytes: PostgREST
  // carries the former, Storage the latter. This is where the latter arrives —
  // on first display rather than during the sync, the thumb first and the full
  // copy only when someone opens the photo.
  const resolved = (await ensureBytes(item, wantThumb)) ?? item;

  if (Platform.OS === 'web') {
    const raw = wantThumb ? resolved.thumbBlob ?? resolved.blob : resolved.blob;
    if (!raw) return null;
    // Copied into a fresh Uint8Array so its buffer is a plain ArrayBuffer: the
    // driver may hand back a view over a SharedArrayBuffer, which Blob rejects.
    const source = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    const bytes = new Uint8Array(source.length);
    bytes.set(source);
    return URL.createObjectURL(new Blob([bytes], { type: resolved.mime || 'image/jpeg' }));
  }

  const { File, Paths } = await import('expo-file-system');
  for (const rel of wantThumb ? [resolved.thumbRelPath, resolved.relPath] : [resolved.relPath]) {
    if (!rel) continue;
    const file = new File(Paths.document, rel);
    if (file.exists) return file.uri;
  }
  return null;
}

/**
 * Downloads the bytes if they are missing and the cloud has them, and hands
 * back the re-read row. Null when there was nothing to do, so the caller keeps
 * the row it already had rather than paying for a second query on every render.
 */
async function ensureBytes(item: Media, thumb: boolean): Promise<Media | null> {
  const remote = thumb ? item.remoteThumbPath : item.remotePath;
  if (!remote) return null;
  // On web the row itself settles it. On native the path columns are synced —
  // they name where the *other* device kept the file — so the stat happens
  // inside ensureMediaBytes.
  if (Platform.OS === 'web' && (thumb ? item.thumbBlob : item.blob)) return null;

  const { ensureMediaBytesById } = await import('../sync/mediaBytes');
  if ((await ensureMediaBytesById(item.id, { thumb })) !== 'downloaded') return null;
  return mediaRepo.getById(item.id);
}

/** Reads one media row by id, or null. */
export async function getMedia(mediaId: string | null | undefined): Promise<Media | null> {
  if (!mediaId) return null;
  return mediaRepo.getById(mediaId);
}
