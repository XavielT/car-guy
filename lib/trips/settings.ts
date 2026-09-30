/**
 * Trip settings (01-data-model-v6.md §1.7). Local to the device: whether this
 * phone records trips is a fact about the phone, not about the account.
 *
 * 'manual' is the default once FEATURE_TRIPS is on; 'auto' (Part B) needs the
 * background permission and is armed by lib/trips/auto.ts.
 */
import { settings as settingsRepo } from '../db/repos';

export type TripsMode = 'auto' | 'manual' | 'off';

export async function tripsMode(): Promise<TripsMode> {
  const v = await settingsRepo.get<string>('trips_enabled', 'manual');
  return v === 'auto' || v === 'off' ? v : 'manual';
}

export async function setTripsMode(mode: TripsMode): Promise<void> {
  await settingsRepo.set('trips_enabled', mode);
}

/** Keep the screen on while the speed cluster is up (ADR-31). Default on. */
export async function tripsKeepAwake(): Promise<boolean> {
  const v = await settingsRepo.get<number | boolean>('trips_keep_awake', 1);
  return v !== 0 && v !== false;
}

export async function setTripsKeepAwake(on: boolean): Promise<void> {
  await settingsRepo.set('trips_keep_awake', on ? 1 : 0);
}

/**
 * ADR-27's fallback: set once a switch between vigilando and grabando failed
 * with the app in the background — from then on the service runs one
 * configuration all the time.
 */
export async function tripsSingleConfig(): Promise<boolean> {
  const v = await settingsRepo.get<number | boolean>('trips_single_config', 0);
  return v === 1 || v === true;
}

export async function setTripsSingleConfig(on: boolean): Promise<void> {
  await settingsRepo.set('trips_single_config', on ? 1 : 0);
}

/** The advanced thresholds (Ajustes → avanzado), a partial TripCfg; the machine fills the rest. */
export async function tripsThresholds(): Promise<Record<string, number>> {
  const v = await settingsRepo.get<unknown>('trips_thresholds', null);
  let o: unknown = v;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      o = null;
    }
  }
  if (!o || typeof o !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(o as Record<string, unknown>)) if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = n;
  return out;
}

export async function setTripsThresholds(t: Record<string, number>): Promise<void> {
  await settingsRepo.set('trips_thresholds', t);
}
