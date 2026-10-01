/**
 * Feature flags of IMP 30092026, kept apart from lib/flags.ts because that file
 * reads expo-constants and the data layer (lib/db/repos) needs FEATURE_EVENTS
 * without it. Same rule as lib/flags.ts: a flag flips with the screen it guards.
 */

/** MapLibre trip map — PROMPT-04. */
export const FEATURE_MAP_V2 = true;
/** Modo conducir + centre button — PROMPT-04. */
export const FEATURE_DRIVE_MODE = true;
/** es/en language switch (ADR-39) — PROMPT-03. On since Phase 3A: parity test green, Más → Idioma. */
export const FEATURE_I18N = true;
/** Eventos on milestones (ADR-44) — PROMPT-05. Off: history_feed's 'evento' rows read as 'hito'. */
export const FEATURE_EVENTS = false;
/** Perfil + bienvenida v2 — PROMPT-06. */
export const FEATURE_ONBOARDING_V2 = false;
/** Términos y privacidad acceptance — PROMPT-06. */
export const FEATURE_LEGAL = false;
