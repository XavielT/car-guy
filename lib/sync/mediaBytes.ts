import { Platform } from 'react-native';

import { getSupabase } from '../cloud/supabase';

import { media as mediaRepo } from '../db/repos';
import {
  clearMediaRemotePath,
  deletedMediaInStorage,
  mediaNeedingUpload,
  mediaVehicleId,
  saveMediaBytes,
  saveMediaThumbBytes,
  setMediaRemotePath,
  setMediaRemoteThumbPath,
  type LocalRow,
} from '../db/syncOps';
import { fitsQuota } from '../domain/album';
import { mediaObjectPath } from './members';
import { readStorageMeter, writeStorageMeter } from './storageMeter';

/**
 * The half of media sync that PostgREST cannot carry.
 *
 * `carguy.media` holds the metadata; the bytes go to the private
 * `carguy-media` bucket under `<user_id>/<media_id>.<ext>` and, since 2.1, the
 * 400 px thumb beside it as `<user_id>/<media_id>.thumb.jpg` — the path shape
 * the Storage policies in `sql/004` allow (ADR-10). `sql/011` adds the quota to
 * the insert policy; a refused upload pauses uploads (see storageMeter.ts).
 *
 * The two directions are deliberately asymmetric. Uploads are **eager**, inside
 * the sync: bytes this device is the only copy of are the ones worth hurrying.
 * Downloads are **lazy**, on first display: a phone signing in to a garage with
 * two hundred photos should not pull two hundred JPEGs over cellular before the
 * user has looked at one.
 *
 * Both are best-effort and per-row. A photo that fails to upload leaves
 * `remote_path` null and is retried on the next sync; a photo that fails to
 * download shows the same placeholder the screen already shows for a photo
 * whose file went missing. Neither is allowed to fail the sync — losing a whole
 * run of maintenance history because one JPEG timed out is the wrong trade.
 */

const BUCKET = 'carguy-media';

/**
 * Just the upload surface, so the engine's client satisfies it structurally and
 * a test can pass a two-line fake. The download side reaches for the real
 * client itself, because it runs from a render rather than from a sync.
 */
type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Blob | ArrayBuffer,
        options?: { contentType?: string; upsert?: boolean },
      ) => Promise<{ error: unknown }>;
      remove: (paths: string[]) => Promise<{ error: unknown }>;
    };
  };
};

function extensionFor(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/** Where a native device should keep this row's file, honouring a synced path. */
function localPathFor(row: LocalRow): string {
  const existing = row.rel_path as string | null;
  if (existing) return existing;
  return `media/${row.owner_id as string}/${row.id as string}.${extensionFor(row.mime as string)}`;
}

async function readLocalBytes(row: LocalRow, thumb = false): Promise<Uint8Array | null> {
  if (Platform.OS === 'web') {
    const blob = (thumb ? row.thumb_blob : row.blob) as Uint8Array | null;
    return blob ? new Uint8Array(blob) : null;
  }

  const relPath = (thumb ? row.thumb_rel_path : row.rel_path) as string | null;
  if (!relPath) return null;

  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.document, relPath);
  if (!file.exists) return null;
  return new Uint8Array(await file.bytes());
}

/** A Storage refusal that means "over quota" (the insert policy said no), not a network blip. */
function isQuotaRefusal(error: unknown): boolean {
  const e = error as { statusCode?: string | number; status?: number; message?: string } | null;
  const code = String(e?.statusCode ?? e?.status ?? '');
  return code === '403' || /row-level security|policy/i.test(e?.message ?? '');
}

/**
 * Uploads every photo Storage has never seen — thumb first, so another device's
 * grid fills before its full copies — then records the object keys.
 *
 * Runs **before** the media rows are pushed, so the paths the other device
 * receives already point at bytes it can fetch. The other order would publish
 * a row advertising a file that is not there yet.
 *
 * Quota: the client stops early when its last reading says the next photo will
 * not fit, and stops for good (`paused`) when the server refuses one. Either
 * way the photos stay on the phone and go up once there is room.
 */
export async function uploadMediaBytes(supabase: StorageClient, userId: string): Promise<number> {
  const rows = await mediaNeedingUpload();
  if (!rows.length) return 0;
  const meter = await readStorageMeter();
  // Paused by a refusal: wait for the post-sync reading to say there is room.
  if (meter.paused) return 0;
  let used = meter.usedBytes;
  let uploaded = 0;

  const put = async (path: string, bytes: Uint8Array, mime: string) => {
    // `upsert` because a crash between the upload and recording the path leaves
    // the object in place with the row still claiming nothing was sent; the
    // retry must be allowed to overwrite it.
    // An ArrayBuffer, not a Blob: React Native cannot build a Blob from bytes
    // ("Creating blobs from 'ArrayBuffer' … are not supported"), so until 2.1.3
    // every phone upload threw here and was skipped in silence. Web takes both.
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return supabase.storage.from(BUCKET).upload(path, copy.buffer, { contentType: mime, upsert: true });
  };

  for (const row of rows) {
    try {
      const id = row.id as string;
      const mime = (row.mime as string) || 'image/jpeg';
      // Since Phase 7 a car's photos live under v/<vehicle_id>/ so every member reads them.
      const vehicleId = await mediaVehicleId(row.owner_table as string, row.owner_id as string, id);

      if (!row.remote_thumb_path) {
        const thumb = await readLocalBytes(row, true);
        if (thumb) {
          if (!fitsQuota(used, meter.quotaBytes, thumb.byteLength)) {
            await writeStorageMeter({ paused: true });
            break;
          }
          const path = mediaObjectPath(userId, vehicleId, id, 'jpg', true);
          const { error } = await put(path, thumb, 'image/jpeg');
          if (error) {
            if (isQuotaRefusal(error)) {
              await writeStorageMeter({ paused: true });
              break;
            }
            continue;
          }
          used += thumb.byteLength;
          await setMediaRemoteThumbPath(id, path);
        }
      }

      if (!row.remote_path) {
        const bytes = await readLocalBytes(row);
        if (!bytes) continue;
        if (!fitsQuota(used, meter.quotaBytes, bytes.byteLength)) {
          await writeStorageMeter({ paused: true });
          break;
        }
        const path = mediaObjectPath(userId, vehicleId, id, extensionFor(mime));
        const { error } = await put(path, bytes, mime);
        if (error) {
          if (isQuotaRefusal(error)) {
            await writeStorageMeter({ paused: true });
            break;
          }
          continue;
        }
        used += bytes.byteLength;
        await setMediaRemotePath(id, path);
        uploaded += 1;
      }
    } catch {
      // Next sync. A photo is not worth stopping a run of maintenance records.
    }
  }

  if (used !== meter.usedBytes) await writeStorageMeter({ usedBytes: used });
  return uploaded;
}

/**
 * Removes the Storage objects of deleted photos.
 *
 * Replacing a photo mints a new media row and tombstones the old one, and
 * nothing ever deleted the old one's bytes — the bucket only ever grew, with
 * files no row could reach. Storage policies scope this to the user's folder.
 */
export async function removeDeletedMediaBytes(supabase: StorageClient): Promise<number> {
  const rows = await deletedMediaInStorage();
  if (!rows.length) return 0;
  const paths = rows.flatMap((row) => [row.remote_path, row.remote_thumb_path]).filter((p): p is string => Boolean(p));
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  // Next sync; a leftover file costs storage, not correctness.
  if (error) return 0;
  for (const row of rows) await clearMediaRemotePath(row.id);
  return rows.length;
}

/**
 * Fetches one photo's bytes, on the first attempt to display it.
 *
 * Called from `mediaUri` when a row has a `remote_path` but no local bytes —
 * which is exactly the state a pull leaves rows in, since PostgREST carries the
 * metadata and nothing else. Returns true when bytes are now local.
 *
 * Idempotent and safe to call on a row that already has its bytes. It reports
 * which of the three happened, because the caller only needs to re-read the row
 * when bytes were actually written — `present` must not cost a second query on
 * every render.
 */
export type BytesState = 'present' | 'downloaded' | 'missing';

/** Where a native device keeps this row's thumb, honouring a synced path. */
function localThumbPathFor(row: LocalRow): string {
  const existing = row.thumb_rel_path as string | null;
  if (existing) return existing;
  return `media/${row.owner_id as string}/${row.id as string}.thumb.jpg`;
}

export async function ensureMediaBytes(row: LocalRow, opts: { thumb?: boolean } = {}): Promise<BytesState> {
  const thumb = Boolean(opts.thumb);
  const remotePath = (thumb ? row.remote_thumb_path : row.remote_path) as string | null;
  if (!remotePath) return 'missing';

  const supabase = getSupabase();
  if (!supabase) return 'missing';

  const web = Platform.OS === 'web';
  const relPath = thumb ? localThumbPathFor(row) : localPathFor(row);
  const fs = web ? null : await import('expo-file-system');

  try {
    // On web the SQL row already says whether the blob is there; on native a
    // pulled row carries the path columns — cloud columns naming where the
    // *other* device kept the file — so only a stat can say whether this one has it.
    if (web) {
      if (thumb ? row.thumb_blob : row.blob) return 'present';
    } else if (fs) {
      if (new fs.File(fs.Paths.document, relPath).exists) return 'present';
    }

    const { data, error } = await supabase.storage.from(BUCKET).download(remotePath);
    if (error || !data) return 'missing';

    const bytes = new Uint8Array(await data.arrayBuffer());

    if (web) {
      if (thumb) await saveMediaThumbBytes(row.id as string, bytes, null);
      else await saveMediaBytes(row.id as string, bytes, null);
    } else if (fs) {
      const file = new fs.File(fs.Paths.document, relPath);
      // `intermediates` covers the per-vehicle folder, which will not exist on
      // a device that has never held a photo for that vehicle.
      file.create({ intermediates: true, overwrite: true });
      file.write(bytes);
      if (thumb) await saveMediaThumbBytes(row.id as string, null, relPath);
      else await saveMediaBytes(row.id as string, null, relPath);
    }

    return 'downloaded';
  } catch {
    return 'missing';
  }
}

/** `ensureMediaBytes` by id, for callers holding only the id. */
export async function ensureMediaBytesById(mediaId: string, opts: { thumb?: boolean } = {}): Promise<BytesState> {
  const row = await mediaRepo.getById(mediaId);
  if (!row) return 'missing';
  // The repo hands back camelCase; the byte helpers read the column names.
  return ensureMediaBytes(
    {
      id: row.id,
      owner_id: row.ownerId,
      mime: row.mime,
      rel_path: row.relPath ?? null,
      remote_path: row.remotePath ?? null,
      blob: row.blob ?? null,
      thumb_rel_path: row.thumbRelPath ?? null,
      remote_thumb_path: row.remoteThumbPath ?? null,
      thumb_blob: row.thumbBlob ?? null,
    },
    opts,
  );
}

/**
 * A photo's bytes, local or fetched from the private bucket first — for the
 * public-page copy and the car book, which need the JPEG itself rather than a
 * URI to display.
 */
export async function localMediaBytes(mediaId: string, opts: { thumb?: boolean } = {}): Promise<Uint8Array | null> {
  await ensureMediaBytesById(mediaId, opts);
  const row = await mediaRepo.getById(mediaId);
  if (!row) return null;
  return readLocalBytes(
    {
      id: row.id,
      owner_id: row.ownerId,
      mime: row.mime,
      rel_path: row.relPath ?? null,
      blob: row.blob ?? null,
      thumb_rel_path: row.thumbRelPath ?? null,
      thumb_blob: row.thumbBlob ?? null,
    },
    Boolean(opts.thumb),
  );
}
