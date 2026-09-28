import { settings as settingsRepo } from '../db/repos';
import { storageLevel, type StorageLevel } from '../domain/album';

/**
 * The cloud photo quota as this device last saw it (IMP 28092026, 02-cloud-v2
 * §3): bytes used from `carguy.storage_usage_bytes()`, the quota from the
 * user's profile, cached in local settings (not in SYNCED_SETTING_KEYS — each
 * device asks for itself) so the album header and Cuenta read it offline.
 *
 * `paused` is set when an upload is refused for quota, and cleared when a fresh
 * reading says there is room again. Local photos keep working either way.
 */
const KEY = 'storage_meter';

export type StorageMeter = {
  usedBytes: number;
  quotaBytes: number | null;
  paused: boolean;
  checkedAt: string | null;
};

const EMPTY: StorageMeter = { usedBytes: 0, quotaBytes: null, paused: false, checkedAt: null };

export async function readStorageMeter(): Promise<StorageMeter> {
  return { ...EMPTY, ...(await settingsRepo.get<Partial<StorageMeter>>(KEY, EMPTY)) };
}

export async function writeStorageMeter(next: Partial<StorageMeter>): Promise<StorageMeter> {
  const merged = { ...(await readStorageMeter()), ...next };
  await settingsRepo.set(KEY, merged);
  return merged;
}

export function meterLevel(m: StorageMeter): StorageLevel {
  return m.paused ? 'full' : storageLevel(m.usedBytes, m.quotaBytes);
}

type MeterClient = {
  rpc: (fn: 'storage_usage_bytes') => PromiseLike<{ data: unknown; error: unknown }>;
  from: (table: 'profiles') => {
    select: (cols: string) => { eq: (col: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } };
  };
};

/** Asks the cloud for the current usage and quota; best-effort, keeps the old reading on failure. */
export async function refreshStorageMeter(supabase: MeterClient, userId: string): Promise<StorageMeter> {
  try {
    const [usage, profile] = await Promise.all([
      supabase.rpc('storage_usage_bytes'),
      supabase.from('profiles').select('media_quota_bytes').eq('user_id', userId).maybeSingle(),
    ]);
    if (usage.error) return readStorageMeter();
    const usedBytes = Number(usage.data ?? 0);
    const quotaBytes = (profile.data as { media_quota_bytes?: number } | null)?.media_quota_bytes ?? null;
    const paused = storageLevel(usedBytes, quotaBytes) === 'full';
    return writeStorageMeter({ usedBytes, quotaBytes, paused, checkedAt: new Date().toISOString() });
  } catch {
    return readStorageMeter();
  }
}
