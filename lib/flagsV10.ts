/**
 * Feature flags of IMP 01102026 (Car Guy 2.5), apart from lib/flags.ts for the same reason as
 * lib/flagsV8.ts: the data layer may read them without expo-constants. All off after Phase 2 (schema
 * only); each flips with the screen it guards.
 */

/** Gauge by squares/percent + learned liters (ADR-51) — PROMPT-03. On: vehicle form, fill-up pickers, hub tank row, fuel lamp, Ficha → Medidor. */
export const FEATURE_GAUGE_SEGMENTS = true;
/** EAS Update OTA + in-app APK updater (ADR-52) — PROMPT-04. On: Inicio banner, Novedades check, boot checks (native). */
export const FEATURE_OTA = true;
/** "Apoyar Car Guy" + admin Uso y costos (ADR-53) — PROMPT-04. On: Más → Apoyar (last row), Admin → Uso y costos. */
export const FEATURE_SUPPORT = true;
/** @handle, public profiles, follows, privacy, shared trips (ADR-54…56) — PROMPT-05. */
export const FEATURE_SOCIAL = false;
/** Juntes with the live map (ADR-57) — PROMPT-06. */
export const FEATURE_JUNTES = false;
/** Junte chat: built in PROMPT-06 but stays off until push notifications exist. */
export const FEATURE_JUNTE_CHAT = false;
