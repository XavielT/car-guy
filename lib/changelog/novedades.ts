import { findEntry, type ChangelogEntry } from './parse';

/** The local (not synced — each phone has its own install) setting. */
export const LAST_SEEN_VERSION_KEY = 'last_seen_version';

/**
 * Whether the Novedades sheet opens at launch, and whether the current version
 * should be written to `last_seen_version`.
 *
 * - First install (no setting, empty garage): remember the version, show
 *   nothing — a new user has nothing to compare against.
 * - No setting but a garage with data: an update from 2.1.x, which never wrote
 *   the setting, so it counts as an update.
 * - A version the changelog does not describe: remember it, show nothing.
 */
export function shouldShowNovedades({
  lastSeen,
  current,
  hasData,
  entries,
}: {
  lastSeen: string | null;
  current: string | null;
  hasData: boolean;
  entries: readonly ChangelogEntry[];
}): { show: boolean; store: boolean } {
  if (!current) return { show: false, store: false };
  if (lastSeen === current) return { show: false, store: false };
  if (lastSeen === null && !hasData) return { show: false, store: true };
  return { show: findEntry(entries, current) !== null, store: true };
}
