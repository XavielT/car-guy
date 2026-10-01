import { Platform } from 'react-native';

import { recordError } from '../diagnostics';
import { isRecordingTrip } from '../trips/live';
import { setUpdateState } from './store';

/**
 * EAS Update (IMP 01102026 Phase 4, ADR-52, research 01 §3a): JS and assets reach installed APKs without a
 * new binary. `checkAutomatically: ON_LOAD` already fetches at launch; this adds a check on demand and when
 * the app comes back, downloads in the background, and lets the banner offer "Reiniciar". Native-only and
 * never in development (expo-updates is disabled there).
 */
async function updates() {
  if (Platform.OS === 'web' || __DEV__) return null;
  const U = await import('expo-updates');
  return U.isEnabled ? U : null;
}

/** Check → fetch. True when an update is downloaded and waiting. Offline is not an error. */
export async function checkOta(): Promise<boolean> {
  const U = await updates();
  if (!U) return false;
  try {
    const r = await U.checkForUpdateAsync();
    if (!r.isAvailable) return false;
    const f = await U.fetchUpdateAsync();
    if (f.isNew) setUpdateState({ otaReady: true });
    return f.isNew;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!/network|offline|timeout|failed to connect/i.test(message)) recordError('ota', message);
    return false;
  }
}

/** "Reiniciar" — never in the middle of a trip (the recording would stop). */
export async function applyOta(): Promise<'reloaded' | 'trip' | 'none'> {
  if (isRecordingTrip()) return 'trip';
  const U = await updates();
  if (!U) return 'none';
  await U.reloadAsync();
  return 'reloaded';
}

/** What Novedades shows: the channel and the running update (null on web / dev / an embedded launch). */
export async function otaInfo(): Promise<{ channel: string | null; updateId: string | null; runtimeVersion: string | null; embedded: boolean } | null> {
  const U = await updates();
  if (!U) return null;
  return { channel: U.channel, updateId: U.updateId, runtimeVersion: U.runtimeVersion, embedded: U.isEmbeddedLaunch };
}
