import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * "Modo diagnóstico" (IMP 29092026 Phase 1): the technical hints behind a
 * user-facing message (which env var is missing, which SQL file is not
 * applied) show only in development builds or after seven taps on the version
 * row in Más — like Android's developer options. Per device, never synced.
 */
const KEY = 'car-guy/show_diagnostics';

let enabled = false;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();

export function diagnosticsOn(): boolean {
  return __DEV__ || enabled;
}

export async function loadDiagnosticsMode(): Promise<boolean> {
  if (!loaded) {
    loaded = true;
    try {
      enabled = (await AsyncStorage.getItem(KEY)) === '1';
    } catch {
      enabled = false;
    }
  }
  return diagnosticsOn();
}

export async function setDiagnosticsMode(on: boolean): Promise<void> {
  enabled = on;
  loaded = true;
  try {
    if (on) await AsyncStorage.setItem(KEY, '1');
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // Kept in memory for this session at least.
  }
  for (const listener of listeners) listener(diagnosticsOn());
}

export function useDiagnosticsMode(): boolean {
  const [on, setOn] = useState(diagnosticsOn());
  useEffect(() => {
    listeners.add(setOn);
    void loadDiagnosticsMode().then(setOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}

/** The user's sentence, plus the developer's when diagnostics are on. */
export function withDevHint(userText: string, devText: string): string {
  return diagnosticsOn() ? `${userText}\n\n${devText}` : userText;
}
