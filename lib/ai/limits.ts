/**
 * The admin-editable AI brakes (IMP 03112026 ADR-66): app_config keys written through set_app_config (sql/033/042),
 * read by carguy.ai_gate(). Pure parsing and formatting so Admin → Uso y costos can validate before it saves and the
 * tests can pin the rules. A cap of 0 is valid and means "stop" (that is how the brakes are proven).
 */
export type AiLimits = { userHour: number; userDayUsd: number; globalDayUsd: number; placesUserDay: number };
export type AiConfig = AiLimits & { enabled: boolean };

/** What sql/042 seeds; used when a key is missing so the screen never shows blanks. */
export const DEFAULT_AI_CONFIG: AiConfig = { enabled: true, userHour: 30, userDayUsd: 0.5, globalDayUsd: 5, placesUserDay: 20 };

export const AI_CONFIG_KEYS = {
  enabled: 'ai_enabled',
  userHour: 'ai_limit_user_hour',
  userDayUsd: 'ai_cap_user_day_usd',
  globalDayUsd: 'ai_cap_global_day_usd',
  placesUserDay: 'ai_limit_places_user_day',
} as const;

/** "0,5" and "0.5" both work (Dominican keyboards); blank, negative, NaN or infinite is null. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type LimitFields = { userHour: string; userDayUsd: string; globalDayUsd: string; placesUserDay: string };

/** Counts are whole numbers; dollar caps may have decimals. null when any field is invalid (nothing is saved). */
export function parseLimits(f: LimitFields): AiLimits | null {
  const userHour = parseAmount(f.userHour);
  const userDayUsd = parseAmount(f.userDayUsd);
  const globalDayUsd = parseAmount(f.globalDayUsd);
  const placesUserDay = parseAmount(f.placesUserDay);
  if (userHour == null || userDayUsd == null || globalDayUsd == null || placesUserDay == null) return null;
  if (!Number.isInteger(userHour) || !Number.isInteger(placesUserDay)) return null;
  return { userHour, userDayUsd, globalDayUsd, placesUserDay };
}

/** The config rows the app can read as the admin → one typed object, defaults where a key is absent or malformed. */
export function configFromRows(rows: Record<string, unknown> | null): AiConfig {
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  const r = rows ?? {};
  return {
    enabled: typeof r[AI_CONFIG_KEYS.enabled] === 'boolean' ? (r[AI_CONFIG_KEYS.enabled] as boolean) : DEFAULT_AI_CONFIG.enabled,
    userHour: num(r[AI_CONFIG_KEYS.userHour], DEFAULT_AI_CONFIG.userHour),
    userDayUsd: num(r[AI_CONFIG_KEYS.userDayUsd], DEFAULT_AI_CONFIG.userDayUsd),
    globalDayUsd: num(r[AI_CONFIG_KEYS.globalDayUsd], DEFAULT_AI_CONFIG.globalDayUsd),
    placesUserDay: num(r[AI_CONFIG_KEYS.placesUserDay], DEFAULT_AI_CONFIG.placesUserDay),
  };
}

export function fieldsFromConfig(c: AiLimits): LimitFields {
  return { userHour: String(c.userHour), userDayUsd: String(c.userDayUsd), globalDayUsd: String(c.globalDayUsd), placesUserDay: String(c.placesUserDay) };
}

/** The summary admin_ai_usage() returns (sql/042). Numbers may arrive as strings (numeric). */
export type AiUsageSummary = {
  at: string;
  today: { calls: number; errors: number; cost_usd: number };
  d7: { calls: number; errors: number; cost_usd: number };
  d30: { calls: number; errors: number; cost_usd: number };
  by_function: { function: string; calls: number; errors: number; cost_usd: number }[];
  by_user: { user_id: string; display_name: string | null; calls: number; cost_usd: number }[];
  consented_users: number;
};

export function usd(n: number | string): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
