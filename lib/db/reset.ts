import { Platform } from 'react-native';

import { enqueue } from './client';
import { ALL_TABLES } from './repos';

/**
 * "Borrar todos los datos" — the **only** hard delete in Car Guy.
 *
 * Everywhere else a removal is a tombstone so Phase 9 can propagate it. Here the
 * user is asking for the data to be gone, so the rows go for real, along with
 * any media files on disk.
 *
 * The catalog is deliberately not re-seeded here; the caller does that, because
 * the app needs service types and inspection templates to function at all.
 */
export async function resetDatabase(): Promise<void> {
  await enqueue(async (db) => {
    for (const table of ALL_TABLES) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    // Settings are wiped too — active vehicle, prices, the legacy-import marker.
    await db.runAsync('DELETE FROM setting');
  });

  await deleteMediaFiles();
}

/**
 * Removes the media directory on native. On web the bytes live in the `media`
 * table's BLOB column, so the DELETE above already took care of them.
 */
async function deleteMediaFiles(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { Directory, Paths } = await import('expo-file-system');
    const dir = new Directory(Paths.document, 'media');
    if (dir.exists) dir.delete();
  } catch {
    // A missing or unreadable media directory must not block the reset — the
    // rows that referenced it are already gone.
  }
}
