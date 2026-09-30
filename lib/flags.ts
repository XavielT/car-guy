import Constants from 'expo-constants';

/**
 * Feature flags — things that are built but not yet finished.
 *
 * A flag here is a promise about what the UI may claim, not a switch for
 * half-working code: it goes true in the same change that ships the screen able
 * to report the feature's state, so the app never claims something it cannot
 * show the user the result of.
 */

/**
 * Phase 9. True now that the engine, the triggers and the UI all exist: the
 * Cuenta screen shows the last sync, what is still waiting and any error, and
 * Más carries the status pill. Turning this off again makes the app local-only
 * and silent about syncing — no trigger fires and nothing is uploaded.
 */
export const FEATURE_SYNC = true;

/*
 * IMP 28092026 (ADR-24): each flips to true in the commit that meets its
 * phase's acceptance criteria. Until then its screens are unreachable from
 * navigation; the schema they need already exists (migration v2).
 */
/** Álbum, memoria, Ex vehicles — PROMPT-03. */
export const FEATURE_ALBUM = true;
/** Build log: mods, specs, wishlist, inventario — PROMPT-04. */
export const FEATURE_BUILD = true;
/** Ficha técnica, fluidos, OBD, contactos — PROMPT-05. */
export const FEATURE_DIY = true;
/** Pista: eventos, sesiones, setup sheets — PROMPT-06. */
export const FEATURE_TRACK = true;
/** Ficha pública, libro PDF, garaje compartido — PROMPT-07. */
export const FEATURE_SHARE = true;

/*
 * IMP 29092026 (2.2 "Kaidō"): schema v6 has everything these need; each flips
 * in the phase that ships its screens.
 */
/**
 * "Car Guy (prueba)" (APP_VARIANT=test, app.config.js) switches on the features
 * still being verified, so a phase can be tried on a real phone next to the
 * real app. Every release build has variant null and keeps them off.
 */
const TEST_VARIANT = (Constants.expoConfig?.extra as { variant?: string | null } | undefined)?.variant === 'test';

/** Viajes: manual and automatic trips — PROMPT-05. On since 2.2.0 (default Solo manual; Automático is opt-in). */
export const FEATURE_TRIPS = true;
/**
 * Comentarios / reportar un problema — PROMPT-06. On: the form works signed out
 * and offline (outbox); until sql/021 is applied a send is kept and retried.
 */
export const FEATURE_FEEDBACK = true;
/** Garaje v2: grid / list / covers, user order, galleries — PROMPT-06. */
export const FEATURE_GARAGE_V2 = true;
/** Animated launch (ADR-36): components/LaunchOverlay.tsx over the native splash — PROMPT-06. */
export const FEATURE_LAUNCH_ANIM = true;

/**
 * True when the app is running from a dev server. `__DEV__` is inlined by
 * Metro, so a production bundle drops the branches that read it entirely.
 */
export const IS_DEV = __DEV__;
