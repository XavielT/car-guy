import { getSupabase } from './supabase';
import { appendSnapshot, type SupportText, type UsageSnapshot } from '../domain/usage';
import { rpc } from '../social/rpc';

/**
 * carguy.app_config (sql/033, ADR-53): what the admin publishes. Public keys are read by every signed-in
 * Car Guy account; the rest (usage_history) only by the admin. Writes only through set_app_config (admin).
 */
export type SupportLink = { label: string; url: string };
export type SupportConfig = {
  text: SupportText | null;
  links: SupportLink[];
  /** Bank transfer details as the admin typed them (shown when there is no link yet). */
  bank: string | null;
  /** Names of supporters who agreed to be listed. */
  thanks: string[];
};

export const SUPPORT_KEYS = ['support_text', 'support_links', 'support_bank', 'support_thanks'] as const;

async function read(keys: readonly string[]): Promise<Record<string, unknown> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from('app_config').select('key, value').in('key', [...keys]);
  if (error) return null;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

/** Apoyar's content; null offline or signed out (the screen then shows its fixed text and "Pronto"). */
export async function readSupportConfig(): Promise<SupportConfig | null> {
  const v = await read(SUPPORT_KEYS);
  if (!v) return null;
  const links = Array.isArray(v.support_links)
    ? (v.support_links as SupportLink[]).filter((l) => l && typeof l.url === 'string' && /^https:\/\//.test(l.url) && typeof l.label === 'string')
    : [];
  return {
    text: (v.support_text as SupportText | undefined) ?? null,
    links,
    bank: typeof v.support_bank === 'string' && v.support_bank.trim() ? v.support_bank : null,
    thanks: Array.isArray(v.support_thanks) ? (v.support_thanks as unknown[]).filter((x): x is string => typeof x === 'string') : [],
  };
}

export async function setAppConfig(key: string, value: unknown, isPublic: boolean): Promise<boolean> {
  const r = await rpc<null>('set_app_config', { p_key: key, p_value: value, p_public: isPublic });
  return r.ok;
}

export type AdminUsage = {
  at: string;
  db_bytes: number;
  storage_bytes: number;
  storage_objects: number;
  mau: number;
  users: number;
  juntes_30d?: number;
  live_members?: number;
  limits: { db_bytes: number; storage_bytes: number; mau: number; realtime_messages: number };
};

/**
 * The meter: today's numbers from admin_usage(), appended to the stored history (one per day) so the slope
 * has something to work with. Admin only — the RPC refuses anyone else.
 */
export async function loadUsage(): Promise<{ usage: AdminUsage; history: UsageSnapshot[] } | null> {
  const r = await rpc<AdminUsage>('admin_usage');
  if (!r.ok || !r.data) return null;
  const usage = r.data;
  const stored = await read(['usage_history']);
  const before = Array.isArray(stored?.usage_history) ? (stored!.usage_history as UsageSnapshot[]) : [];
  const history = appendSnapshot(before, { at: usage.at, db_bytes: Number(usage.db_bytes), storage_bytes: Number(usage.storage_bytes), mau: Number(usage.mau) });
  if (history.length !== before.length || history[history.length - 1]?.at !== before[before.length - 1]?.at) {
    await setAppConfig('usage_history', history, false);
  }
  return { usage, history };
}
