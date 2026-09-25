import { signOut } from '../cloud/auth';
import { getSupabase } from '../cloud/supabase';
import { settings as settingsRepo } from '../db/repos';
import { markAllUnsynced } from '../db/syncOps';
import { whenSyncIdle } from './engine';
import { cursorKey, SYNC_TABLES } from './tables';

/**
 * Deletes everything this account holds in the cloud, leaving the phone alone.
 *
 * The mirror of "Borrar datos locales": one wipes the device and keeps the
 * account, this wipes the account and keeps the device. Neither is the other's
 * undo, and the Cuenta screen keeps them apart for that reason.
 *
 * Children are deleted before parents — the reverse of the sync order — because
 * `sql/007` put a cascade on `user_id` but nothing between the tables, and a
 * future constraint between them would otherwise turn this into a foreign-key
 * error halfway through.
 *
 * The cursors are cleared last. Leaving them set would tell the next pull that
 * this device is already up to date with rows that no longer exist, and the
 * local copy would never be reconciled again.
 *
 * It then **signs out**, and that is not a convenience. The sync triggers are
 * eager by design — foreground, after every write — so a device that stayed
 * signed in would start putting the garage back on the server within seconds of
 * the user asking for it to be gone. Signing out is what makes the request
 * stick, and it costs the user nothing: the account is optional and signing out
 * never touches local data (ADR-05).
 */
export type WipeResult = { ok: true; deleted: number } | { ok: false; message: string };

export async function wipeCloudData(message: string): Promise<WipeResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message };

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return { ok: false, message };

  let deleted = 0;

  // A push already in flight would put rows back up behind the delete.
  await whenSyncIdle();

  try {
    for (const table of [...SYNC_TABLES].reverse()) {
      const { error, count } = await supabase
        .from(table.name as never)
        .delete({ count: 'exact' })
        .eq('user_id', userId);
      if (error) throw error;
      deleted += count ?? 0;
    }

    // Storage objects live under <user_id>/. The listing is paged (the default
    // stops at 100 files), and a failure is a failure — ignoring it would report
    // a clean wipe while the photos stay in the bucket.
    const bucket = supabase.storage.from('carguy-media');
    for (;;) {
      const { data: files, error: listError } = await bucket.list(userId, { limit: 1000 });
      if (listError) throw listError;
      if (!files?.length) break;
      const { data: removed, error: removeError } = await bucket.remove(
        files.map((file) => `${userId}/${file.name}`),
      );
      if (removeError) throw removeError;
      // A remove that deletes nothing would list the same files forever.
      if (!removed?.length) throw new Error('Storage no borró ningún archivo.');
      if (files.length < 1000) break;
    }

    // The phone still thinks every row is in the cloud; it no longer is.
    await markAllUnsynced(SYNC_TABLES.filter((t) => t.name !== 'setting').map((t) => t.name));
    await settingsRepo.set('sync_parked', {});

    for (const table of SYNC_TABLES) {
      await settingsRepo.set(cursorKey(table.name), null);
    }
    await settingsRepo.set('last_sync_at', null);

    // Last, and not inside the try's failure path: a sign-out that fails after
    // the data is gone is not worth reporting as "the wipe failed".
    await signOut();

    return { ok: true, deleted };
  } catch (error) {
    return {
      ok: false,
      message: String((error as { message?: string })?.message ?? error),
    };
  }
}
