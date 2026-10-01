import { useEffect, useSyncExternalStore } from 'react';

/**
 * The welcome tutorial's gate (IMP 30092026 note 11, PROMPT-06 step 2).
 *
 * `onboarded_version` (setting, integer) is the version of the welcome this
 * install has finished or skipped. Unset → the tabs layout redirects to
 * /bienvenida. 2.3.x had no welcome and no such setting, so an install that
 * already has vehicles the first time 2.4 asks is an existing user: it is marked
 * onboarded without being shown anything (the same "existing install" idea as
 * keepSpanishForExistingInstall in lib/i18n).
 *
 * Bumping ONBOARDING_VERSION shows the welcome again to everyone below it.
 */
export const ONBOARDING_VERSION = 1;
export const ONBOARDED_KEY = 'onboarded_version';

export type WelcomeDecision = 'show' | 'mark' | 'done';

/** Pure rule: what the gate does for this stored version and garage size. */
export function welcomeDecision(onboardedVersion: number | null, vehicleCount: number): WelcomeDecision {
  if (onboardedVersion != null && onboardedVersion >= ONBOARDING_VERSION) return 'done';
  // Upgraded from 2.3.x: they know the app. Only an unset version counts — a later bump
  // (version set but lower) is a "here is what is new" for everyone.
  if (onboardedVersion == null && vehicleCount > 0) return 'mark';
  return 'show';
}

/** The settings table, as the gate needs it (injectable for tests). */
export type SettingsKV = {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
};

function defaultKV(): SettingsKV {
  // Lazy: lib/db pulls expo-sqlite; tests inject their own store.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../db/repos') as typeof import('../db/repos')).settings;
}

type State = { loaded: boolean; version: number | null };
let state: State = { loaded: false, version: null };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: State): void {
  state = next;
  for (const l of listeners) l();
}

function normalise(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** Reads the stored version once per process. */
export function loadWelcomeState(kv: SettingsKV = defaultKV()): Promise<void> {
  if (state.loaded) return Promise.resolve();
  loading ??= kv
    .get<unknown>(ONBOARDED_KEY, null)
    .then((raw) => setState({ loaded: true, version: normalise(raw) }))
    // An unreadable setting must not trap anyone in the welcome: treat as done.
    .catch(() => setState({ loaded: true, version: ONBOARDING_VERSION }))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Finished, skipped, or an existing install: never show this version again. */
export async function markOnboarded(kv: SettingsKV = defaultKV()): Promise<void> {
  setState({ loaded: true, version: ONBOARDING_VERSION });
  await kv.set(ONBOARDED_KEY, ONBOARDING_VERSION).catch(() => {});
}

/**
 * The gate as one call, for the layout and the tests: loads the version, applies
 * the rule, and writes the mark for an existing install. Returns whether to show.
 */
export async function resolveWelcomeGate(vehicleCount: number, kv: SettingsKV = defaultKV()): Promise<boolean> {
  await loadWelcomeState(kv);
  const decision = welcomeDecision(state.version, vehicleCount);
  if (decision === 'mark') await markOnboarded(kv);
  return decision === 'show';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * For the tabs layout once the store is ready: 'loading' until the setting is
 * read, then 'show' or 'done'. An existing install is marked here, silently.
 */
export function useWelcomeGate(ready: boolean, vehicleCount: number, enabled: boolean): 'loading' | 'show' | 'done' {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  const decision = s.loaded ? welcomeDecision(s.version, vehicleCount) : null;
  useEffect(() => {
    if (!enabled || !ready) return;
    if (!s.loaded) void loadWelcomeState();
    else if (decision === 'mark') void markOnboarded();
  }, [enabled, ready, s.loaded, decision]);
  if (!enabled) return 'done';
  if (!ready || !s.loaded) return 'loading';
  return decision === 'show' ? 'show' : 'done';
}

/** Test hook. */
export function __resetWelcomeForTests(): void {
  state = { loaded: false, version: null };
  loading = null;
}
