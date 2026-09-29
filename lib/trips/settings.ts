/**
 * Trip settings (01-data-model-v6.md §1.7). Local to the device: whether this
 * phone records trips is a fact about the phone, not about the account.
 *
 * Part A offers 'manual' (the default once FEATURE_TRIPS is on) and 'off';
 * Part B adds 'auto'.
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
