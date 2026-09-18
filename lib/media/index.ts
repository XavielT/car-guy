/**
 * Photos and files (ADR-10).
 *
 * Two storage strategies because the platforms genuinely differ: on Android the
 * bytes go to a file under `Paths.document/media/<vehicleId>/` and the row keeps
 * a **relative** path (an absolute one breaks when the OS moves the sandbox);
 * on web `expo-file-system` does not exist at all, so the bytes live in the
 * `media.blob` column.
 *
 * Everything is compressed once, on the way in — 1600 px wide at JPEG 0.75.
 * A modern phone camera produces 4–8 MB per shot, which would bloat the database
 * and the backup for no visible gain on a phone screen.
 */
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { media as mediaRepo } from '../db/repos';
import type { Media } from '../db/types';
import { id as newId } from '../format';

const MAX_WIDTH = 1600;
const QUALITY = 0.75;

export type PickOptions = {
  camera?: boolean;
  ownerTable: string;
  ownerId: string;
  /** Used to group files on disk; falls back to the owner id. */
  vehicleId?: string;
};

/**
 * Picks (or shoots) a photo, compresses it and stores it.
 *
 * Must be called straight from a press handler: on web the picker injects an
 * `<input type="file">` and clicks it, which browsers only allow inside a user
 * gesture. Returns null when the user backs out.
 */
export async function pickPhoto(options: PickOptions): Promise<Media | null> {
  const picked = options.camera
    ? await ImagePicker.launchCameraAsync({ quality: 0.9, mediaTypes: ['images'] })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, mediaTypes: ['images'] });

  if (picked.canceled || !picked.assets?.length) return null;
  const asset = picked.assets[0];

  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if ((asset.width ?? 0) > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    compress: QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const mediaId = newId();
  const common = {
    id: mediaId,
    ownerTable: options.ownerTable,
    ownerId: options.ownerId,
    kind: 'photo' as const,
    mime: 'image/jpeg',
    width: result.width ?? null,
    height: result.height ?? null,
    deletedAt: null,
  };

  if (Platform.OS === 'web') {
    const response = await fetch(result.uri);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Uint8Array, not ArrayBuffer: the web driver binds the former as a BLOB and
    // silently mangles the latter.
    return mediaRepo.upsert({ ...common, blob: bytes, sizeBytes: bytes.byteLength });
  }

  const { Directory, File, Paths } = await import('expo-file-system');
  const folder = new Directory(Paths.document, 'media', options.vehicleId ?? options.ownerId);
  if (!folder.exists) folder.create({ intermediates: true });

  const destination = new File(folder, `${mediaId}.jpg`);
  new File(result.uri).copy(destination);

  return mediaRepo.upsert({
    ...common,
    // Relative on purpose: Paths.document changes between installs and OS upgrades.
    relPath: `media/${options.vehicleId ?? options.ownerId}/${mediaId}.jpg`,
    sizeBytes: destination.size ?? null,
  });
}

/**
 * A URI the `<Image>` component can render.
 *
 * On web this mints an object URL that the caller **must** revoke — use
 * `useMediaUri`, which does it on unmount.
 */
export async function mediaUri(item: Media | null): Promise<string | null> {
  if (!item) return null;

  // A row pulled from another device has metadata and no bytes: PostgREST
  // carries the former, Storage the latter. This is where the latter arrives —
  // on first display rather than during the sync, so signing in to a garage
  // with two hundred photos does not pull two hundred JPEGs first.
  const resolved = (await ensureBytes(item)) ?? item;

  if (Platform.OS === 'web') {
    if (!resolved.blob) return null;
    // Copied into a fresh Uint8Array so its buffer is a plain ArrayBuffer: the
    // driver may hand back a view over a SharedArrayBuffer, which Blob rejects.
    const source =
      resolved.blob instanceof Uint8Array ? resolved.blob : new Uint8Array(resolved.blob);
    const bytes = new Uint8Array(source.length);
    bytes.set(source);
    return URL.createObjectURL(new Blob([bytes], { type: resolved.mime || 'image/jpeg' }));
  }

  if (!resolved.relPath) return null;
  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.document, resolved.relPath);
  return file.exists ? file.uri : null;
}

/**
 * Downloads the bytes if they are missing and the cloud has them, and hands
 * back the re-read row.
 *
 * Returns null when there was nothing to do, so the caller keeps the row it
 * already had rather than paying for a second query on every render.
 */
async function ensureBytes(item: Media): Promise<Media | null> {
  if (!item.remotePath) return null;
  // On web the row itself settles it. On native `relPath` may be set and the
  // file still absent — it is a synced column naming where the *other* device
  // kept it — so the stat happens inside ensureMediaBytes.
  if (Platform.OS === 'web' && item.blob) return null;

  const { ensureMediaBytesById } = await import('../sync/mediaBytes');
  if ((await ensureMediaBytesById(item.id)) !== 'downloaded') return null;
  return mediaRepo.getById(item.id);
}

/** Reads one media row by id, or null. */
export async function getMedia(mediaId: string | null | undefined): Promise<Media | null> {
  if (!mediaId) return null;
  return mediaRepo.getById(mediaId);
}
