import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { FEATURE_OTA } from '../flagsV10';
import { checkApk, cleanOldApks } from './apk';
import { checkOta } from './ota';

/** Coming back from the background re-checks at most this often. */
const RECHECK_MS = 30 * 60_000;

/**
 * Boot hook (IMP 01102026 Phase 4): at launch an OTA check (on top of expo-updates' own ON_LOAD fetch) and
 * one APK check; when the app comes back after 30 min, the OTA again. Android/iOS native only.
 */
export function useUpdateChecks(): void {
  useEffect(() => {
    if (!FEATURE_OTA || Platform.OS === 'web') return;
    let last = Date.now();
    void cleanOldApks();
    void checkOta();
    void checkApk();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || Date.now() - last < RECHECK_MS) return;
      last = Date.now();
      void checkOta();
    });
    return () => sub.remove();
  }, []);
}
