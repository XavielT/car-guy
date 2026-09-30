import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';

import type { Dict, Lang } from './dict';
import { en } from './en';
import { es } from './es';

export type { Dict, Lang } from './dict';

/**
 * The app's language (IMP 30092026 note 2, ADR-39): Spanish or English, the
 * device's by default, switched in Más → Idioma.
 *
 * - `t` is the dictionary of the current language, read at the moment of use
 *   (a Proxy over es/en). Screens, notifications, the background trip task and
 *   the PDF renderers all read it the same way, inside the function that shows
 *   the text — a string copied into a module-level constant would freeze in the
 *   language of the first launch (lint + __tests__/i18n/frozen.test.ts watch).
 * - `useT()` / `useLanguage()` subscribe a component; the root layout keys the
 *   navigator on the language, so every mounted screen re-renders on a switch.
 * - The preference lives in AsyncStorage (`car-guy/language`, like the theme),
 *   is read before the splash hides, and 'system' is re-resolved when the app
 *   comes back to the foreground (Android does not restart on a device change).
 *
 * Spanish is the default for any device language other than English.
 */

export type LanguagePreference = 'system' | Lang;

const KEY = 'car-guy/language';

/** Loaded on first use, so plain-node code (tests, the data layer) can import this module. */
type KeyValue = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
async function storage(): Promise<KeyValue> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose (see above)
  return require('@react-native-async-storage/async-storage').default as KeyValue;
}
const PREFERENCES: LanguagePreference[] = ['system', 'es', 'en'];
const DICTS: Record<Lang, Dict> = { es, en };

let preference: LanguagePreference = 'system';
let resolved: Lang = deviceLanguage();
let snapshot: { preference: LanguagePreference; resolved: Lang } = { preference, resolved };
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = { preference, resolved };
  for (const l of listeners) l();
}

/** The device's first language, if it is one we have; Spanish otherwise. */
export function deviceLanguage(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

function resolve(pref: LanguagePreference): Lang {
  return pref === 'system' ? deviceLanguage() : pref;
}

/** The live dictionary: `t.fuel.save`, `t.trips.km(n)` — always the current language. */
export const t: Dict = new Proxy({} as Dict, {
  get: (_target, key) => (DICTS[resolved] as unknown as Record<string | symbol, unknown>)[key],
  has: (_target, key) => key in DICTS[resolved],
  ownKeys: () => Reflect.ownKeys(DICTS[resolved]),
  getOwnPropertyDescriptor: (_target, key) => {
    const value = (DICTS[resolved] as unknown as Record<string | symbol, unknown>)[key];
    return value === undefined ? undefined : { value, enumerable: true, configurable: true, writable: false };
  },
});

/** The current language, for code outside React (formatters, notifications, tasks). */
export function currentLanguage(): Lang {
  return resolved;
}

/** BCP 47 tag for Intl: dates, numbers. RD$ is formatted the same in both. */
export function localeTag(lang: Lang = resolved): 'es-DO' | 'en-US' {
  return lang === 'en' ? 'en-US' : 'es-DO';
}

const MIGRATED_KEY = 'car-guy/language-migrated';

/**
 * 2.4 is the first version with English. Someone who already has a garage
 * chose a Spanish app — their phone being set to English should not flip it
 * on the day they update — so an install that has vehicles the first time
 * this runs is pinned to Spanish; a new install follows the device. Once.
 * Más → Idioma changes either.
 */
async function keepSpanishForExistingInstall(kv: KeyValue): Promise<void> {
  if (await kv.getItem(MIGRATED_KEY)) return;
  await kv.setItem(MIGRATED_KEY, '1');
  if (await kv.getItem(KEY)) return;
  // Lazy: lib/db imports this module (a cycle at load time otherwise).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getDb } = require('../db/client') as typeof import('../db/client');
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM vehicle');
  if ((row?.n ?? 0) > 0) {
    preference = 'es';
    await kv.setItem(KEY, 'es');
  }
}

/** Reads the stored preference. Called once before the splash hides, and by headless tasks. */
export async function initLanguage(): Promise<Lang> {
  try {
    const kv = await storage();
    await keepSpanishForExistingInstall(kv).catch(() => {});
    const raw = await kv.getItem(KEY);
    if (raw && (PREFERENCES as string[]).includes(raw)) preference = raw as LanguagePreference;
  } catch {
    // Storage unavailable (private window, headless start): stay on the device language.
  }
  const next = resolve(preference);
  if (next !== resolved || snapshot.preference !== preference) {
    resolved = next;
    emit();
  }
  return resolved;
}

export function setLanguagePreference(next: LanguagePreference): void {
  preference = next;
  resolved = resolve(next);
  emit();
  storage()
    .then((s) => s.setItem(KEY, next))
    .catch(() => {});
}

/** Foreground re-check: a 'system' user who changed the device language gets it now. */
export function refreshSystemLanguage(): void {
  if (preference !== 'system') return;
  const next = deviceLanguage();
  if (next !== resolved) {
    resolved = next;
    emit();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguage(): { preference: LanguagePreference; resolved: Lang; setPreference: (p: LanguagePreference) => void } {
  const s = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  return { ...s, setPreference: setLanguagePreference };
}

/** The dictionary for the current language, re-rendering the caller on a switch. */
export function useT(): Dict {
  const { resolved: lang } = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  return DICTS[lang];
}

/** Both dictionaries, for the parity test and the language picker's own labels. */
export const DICTIONARIES = DICTS;

/** Test hook: set the language without storage. */
export function __setLanguageForTests(lang: Lang, pref: LanguagePreference = lang): void {
  preference = pref;
  resolved = lang;
  emit();
}
