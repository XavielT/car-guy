import { Platform } from 'react-native';

import { getSupabase } from '../cloud/supabase';

import { media as mediaRepo } from '../db/repos';
import {
  clearMediaRemotePath,
  deletedMediaInStorage,
  mediaNeedingUpload,
  saveMediaBytes,
  setMediaRemotePath,
  type LocalRow,
} from '../db/syncOps';

/**
 * The half of media sync that PostgREST cannot carry.
 *
 * `carguy.media` holds the metadata; the bytes go to the private
 * `carguy-media` bucket under `<user_id>/<media_id>.<ext>`, which is the one
 * path shape the four Storage policies in `sql/004` allow (ADR-10).
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
        body: Blob,
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

async function readLocalBytes(row: LocalRow): Promise<Uint8Array | null> {
  if (Platform.OS === 'web') {
    const blob = row.blob as Uint8Array | null;
    return blob ? new Uint8Array(blob) : null;
  }

  const relPath = row.rel_path as string | null;
  if (!relPath) return null;

  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.document, relPath);
  if (!file.exists) return null;
  return new Uint8Array(await file.bytes());
}

/**
 * Uploads every photo Storage has never seen, then records the object key.
 *
 * Runs **before** the media rows are pushed, so the `remote_path` the other
 * device receives already points at bytes it can fetch. The other order would
 * publish a row advertising a file that is not there yet.
 */
export async function uploadMediaBytes(supabase: StorageClient, userId: string): Promise<number> {
  const rows = await mediaNeedingUpload();
  let uploaded = 0;

  for (const row of rows) {
    try {
      const bytes = await readLocalBytes(row);
      if (!bytes) continue;

      const mime = (row.mime as string) || 'image/jpeg';
      const path = `${userId}/${row.id as string}.${extensionFor(mime)}`;

      // `upsert` because a crash between the upload and `setMediaRemotePath`
      // leaves the object in place with the row still claiming nothing was
      // sent; the retry must be allowed to overwrite it.
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Blob([copy], { type: mime }), { contentType: mime, upsert: true });
      if (error) continue;

      await setMediaRemotePath(row.id as string, path);
      uploaded += 1;
    } catch {
      // Next sync. A photo is not worth stopping a run of maintenance records.
    }
  }

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
  const { error } = await supabase.storage.from(BUCKET).remove(rows.map((row) => row.remote_path));
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

export async function ensureMediaBytes(row: LocalRow): Promise<BytesState> {
  const remotePath = row.remote_path as string | null;
  if (!remotePath) return 'missing';

  const supabase = getSupabase();
  if (!supabase) return 'missing';

  const web = Platform.OS === 'web';
  const relPath = localPathFor(row);
  const fs = web ? null : await import('expo-file-system');

  try {
    // On web the SQL row already says whether the blob is there; on native only
    // the filesystem can answer.
    // On native a pulled row carries `rel_path` — it is a cloud column, so it
    // names where the *other* device kept the file. Only a stat can say whether
    // this device has it.
    if (web) {
      if (row.blob) return 'present';
    } else if (fs) {
      if (new fs.File(fs.Paths.document, relPath).exists) return 'present';
    }

    const { data, error } = await supabase.storage.from(BUCKET).download(remotePath);
    if (error || !data) return 'missing';

    const bytes = new Uint8Array(await data.arrayBuffer());

    if (web) {
      await saveMediaBytes(row.id as string, bytes, null);
    } else if (fs) {
      const file = new fs.File(fs.Paths.document, relPath);
      // `intermediates` covers the per-vehicle folder, which will not exist on
      // a device that has never held a photo for that vehicle.
      file.create({ intermediates: true, overwrite: true });
      file.write(bytes);
      await saveMediaBytes(row.id as string, null, relPath);
    }

    return 'downloaded';
  } catch {
    return 'missing';
  }
}

/** `ensureMediaBytes` by id, for callers holding only the id. */
export async function ensureMediaBytesById(mediaId: string): Promise<BytesState> {
  const row = await mediaRepo.getById(mediaId);
  if (!row) return 'missing';
  // The repo hands back camelCase; the byte helpers read the column names.
  return ensureMediaBytes({
    id: row.id,
    owner_id: row.ownerId,
    mime: row.mime,
    rel_path: row.relPath ?? null,
    remote_path: row.remotePath ?? null,
    blob: row.blob ?? null,
  });
}
