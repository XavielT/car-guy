import { AI_CONFIG_KEYS, configFromRows, type AiConfig, type AiLimits, type AiUsageSummary } from '../ai/limits';
import { rpc } from '../social/rpc';
import { setAppConfig } from './appConfig';
import { getSupabase } from './supabase';

/**
 * Admin → Uso y costos, AI section (IMP 03112026, ADR-66, sql/042): spend and brakes. Every call is admin only on the
 * server (the RPCs raise 'forbidden'; app_config rows are admin-readable). The kill switch is the `ai_enabled` key.
 */

/** admin_ai_usage(): spend today / 7 d / 30 d, by function and by person. null on failure or for a non-admin. */
export async function loadAiUsage(): Promise<AiUsageSummary | null> {
  const r = await rpc<AiUsageSummary>('admin_ai_usage');
  return r.ok && r.data ? r.data : null;
}

/** The five ai_* keys as a typed object (defaults when a key is missing). null when signed out / offline. */
export async function readAiConfig(): Promise<AiConfig | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from('app_config').select('key, value').in('key', Object.values(AI_CONFIG_KEYS));
  if (error) return null;
  return configFromRows(Object.fromEntries((data ?? []).map((row) => [row.key, row.value])));
}

export async function saveAiLimits(limits: AiLimits): Promise<boolean> {
  const results = await Promise.all([
    setAppConfig(AI_CONFIG_KEYS.userHour, limits.userHour, false),
    setAppConfig(AI_CONFIG_KEYS.userDayUsd, limits.userDayUsd, false),
    setAppConfig(AI_CONFIG_KEYS.globalDayUsd, limits.globalDayUsd, false),
    setAppConfig(AI_CONFIG_KEYS.placesUserDay, limits.placesUserDay, false),
  ]);
  return results.every(Boolean);
}

/** The kill switch. */
export async function setAiEnabled(enabled: boolean): Promise<boolean> {
  return setAppConfig(AI_CONFIG_KEYS.enabled, enabled, false);
}

/** Deletes usage rows older than `days` (the server never goes below 7). Returns how many, or null on failure. */
export async function pruneAiUsage(days = 90): Promise<number | null> {
  const r = await rpc<number>('ai_usage_prune', { p_days: days });
  return r.ok ? Number(r.data) : null;
}
