import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palette, type Palette, type Scheme } from '@/constants/theme';

export type ThemePreference = 'system' | 'dark' | 'light';

/**
 * Where the preference lives until Phase 2 moves settings into SQLite. Namespaced
 * under car-guy/ so it never collides with the legacy 'tu-combustible-rd/v1' blob,
 * which the Phase 2 importer still needs to read untouched.
 */
const KEY = 'car-guy/theme';

const PREFERENCES: ThemePreference[] = ['system', 'dark', 'light'];

type ThemeValue = {
  /** The palette to paint with. */
  theme: Palette;
  /** Which scheme that palette is. */
  scheme: Scheme;
  /** What the user chose; 'system' means "follow the device". */
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // null while the system has no preference — the identity is dark, so that is
  // what an undecided device gets.
  const system = useColorScheme();
  const [preference, setStoredPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        if ((PREFERENCES as string[]).includes(raw)) setStoredPreference(raw as ThemePreference);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setStoredPreference(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  const scheme: Scheme = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeValue>(
    () => ({ theme: palette[scheme], scheme, preference, setPreference }),
    [scheme, preference, setPreference],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

/**
 * The active palette. Safe to call outside the provider — it falls back to dark,
 * which is what the app looks like anyway.
 */
export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (value) return value;
  return {
    theme: palette.dark,
    scheme: 'dark',
    preference: 'system',
    setPreference: () => {},
  };
}
