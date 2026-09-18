import { Platform } from 'react-native';

import {
  mediaNeedingDownload,
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
 * Both directions are best-effort and per-row. A photo that fails to upload
 * leaves `remote_path` null and is retried on the next sync; a photo that fails
 * to download leaves the row without bytes and the screen shows the placeholder
 * it already shows for a photo whose file went missing. Neither is allowed to
 * fail the sync — losing a whole run of maintenance history because one JPEG
 * timed out is the wrong trade.
 */

const BUCKET = 'carguy-media';

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Blob,
        options?: { contentType?: string; upsert?: boolean },
      ) => Promise<{ error: unknown }>;
      download: (path: string) => Promise<{ data: Blob | null; error: unknown }>;
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
 * Fetches the bytes for rows that arrived from another device.
 *
 * Runs **after** the pull, because the rows it looks for are the ones the pull
 * just wrote.
 */
export async function downloadMediaBytes(supabase: StorageClient): Promise<number> {
  const web = Platform.OS === 'web';
  const rows = await mediaNeedingDownload(web);
  let downloaded = 0;

  const fs = web ? null : await import('expo-file-system');

  for (const row of rows) {
    try {
      const relPath = localPathFor(row);

      // On native the SQL cannot tell whether the file is there, so this is the
      // filter: a row whose file already exists needs nothing.
      if (fs) {
        const existing = new fs.File(fs.Paths.document, relPath);
        if (existing.exists) continue;
      }

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(row.remote_path as string);
      if (error || !data) continue;

      const bytes = new Uint8Array(await data.arrayBuffer());

      if (web) {
        await saveMediaBytes(row.id as string, bytes, null);
      } else if (fs) {
        const file = new fs.File(fs.Paths.document, relPath);
        // `intermediates` covers the per-vehicle folder, which will not exist
        // on a device that has never held a photo for that vehicle.
        file.create({ intermediates: true, overwrite: true });
        file.write(bytes);
        await saveMediaBytes(row.id as string, null, relPath);
      }

      downloaded += 1;
    } catch {
      // Same bargain as the upload: the metadata is safe, the bytes retry.
    }
  }

  return downloaded;
}
