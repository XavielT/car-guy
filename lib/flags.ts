/**
 * Feature flags — things that are built but not yet finished.
 *
 * A flag here is a promise about what the UI may claim, not a switch for
 * half-working code. `FEATURE_SYNC` is false because Phase 8 ships the account
 * and Phase 9 ships the sync: signing in today stores a session and nothing
 * else, and telling a user "tus datos se sincronizarán" before that is true
 * would be a lie with a deadline attached.
 */

/** Phase 9. Until then the Cuenta screen says nothing about syncing in prod. */
export const FEATURE_SYNC = false;

/**
 * True when the app is running from a dev server. `__DEV__` is inlined by
 * Metro, so a production bundle drops the branches that read it entirely.
 */
export const IS_DEV = __DEV__;
