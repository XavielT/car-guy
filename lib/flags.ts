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

/**
 * True when the app is running from a dev server. `__DEV__` is inlined by
 * Metro, so a production bundle drops the branches that read it entirely.
 */
export const IS_DEV = __DEV__;
