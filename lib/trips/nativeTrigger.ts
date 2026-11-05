/**
 * Automatic trips, the JS half of the native trigger (IMP 03112026 PROMPT-09; modules/trip-trigger).
 *
 * With the app closed, Android's Activity Recognition says "in a vehicle" and a native service records the fixes to a file.
 * Here the app takes those files when it opens and runs them through the SAME trip machine as every other fix (`feed`),
 * so the start/stop rules, the SpeedEngine, the filters and the finalize code are the ones already tested.
 *
 * Pure parts (parse / order / chunk) are tested on their own; the rest is glue.
 */
import { Platform } from 'react-native';

import { recordError, recordNote } from '../diagnostics';
import { settings } from '../db/repos';
import {
  ackNativeSession,
  armTripTrigger,
  clearNativeEvents,
  disarmTripTrigger,
  drainNativeSessions,
  hasActivityPermission,
  holdNativeForJs,
  isNativeRecording,
  nativeEvents,
  stopNativeRecorder,
  tripTriggerAvailable,
} from '../../modules/trip-trigger';
import { feed, tick } from './engine';
import type { Fix } from './geo';
import { logTimeline } from './timeline';

const LAST_T_KEY = 'trip_native_last_t';
/** Fixes handed to the machine per call (a one-hour drive at 1 Hz is 3,600). */
export const CHUNK = 400;

type Raw = { t?: unknown; la?: unknown; lo?: unknown; ac?: unknown; sp?: unknown; br?: unknown; al?: unknown };
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** One recorded session (a line per fix) → fixes, oldest first, skipping anything not parseable or not after `afterT`. Pure. */
export function parseSession(text: string, afterT = 0): Fix[] {
  const out: Fix[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let raw: Raw;
    try {
      raw = JSON.parse(line) as Raw;
    } catch {
      continue; // a half-written last line from a killed service
    }
    const t = num(raw.t);
    const lat = num(raw.la);
    const lng = num(raw.lo);
    if (t == null || lat == null || lng == null || t <= afterT) continue;
    out.push({ t, lat, lng, speed: num(raw.sp), acc: num(raw.ac), alt: num(raw.al), heading: num(raw.br) });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

export function chunks<T>(list: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export type ArmResult = { native: boolean; reason: string };

/**
 * Registers the native trigger. `native: true` means the OS will start recording by itself when the person gets in a
 * vehicle, so the app's own always-on "watching" service is not needed (it was the CPU the system kept punishing).
 * `native: false` (no Play services, no Activity Recognition permission, old APK): the old foreground-service path runs.
 */
export async function armNativeTrigger(): Promise<ArmResult> {
  if (Platform.OS !== 'android' || !tripTriggerAvailable) return { native: false, reason: 'unavailable' };
  const result = await armTripTrigger();
  if (result !== 'ok') {
    logTimeline({ kind: 'native', event: 'arm-failed', detail: result.slice(0, 80) });
    return { native: false, reason: result };
  }
  return { native: true, reason: 'ok' };
}

export async function disarmNativeTrigger(): Promise<void> {
  if (Platform.OS !== 'android' || !tripTriggerAvailable) return;
  await disarmTripTrigger();
}

/** The app's own location service is recording: the native recorder must not start (or must yield). */
export function holdNative(forMs = 180_000): void {
  holdNativeForJs(Date.now() + forMs);
}

export function activityPermissionGranted(): boolean {
  return hasActivityPermission();
}

/**
 * Takes the recorded sessions and replays them through the machine; then closes a trip left open. Safe to call often:
 * nothing recorded means nothing happens. The app is in front here, so a native recorder still running hands over.
 */
export async function ingestNativeSessions(): Promise<{ sessions: number; fixes: number }> {
  if (Platform.OS !== 'android' || !tripTriggerAvailable) return { sessions: 0, fixes: 0 };
  let sessions = 0;
  let total = 0;
  try {
    importNativeEvents();
    const lastT = await settings.get<number>(LAST_T_KEY, 0);
    let last = lastT;
    for (const s of drainNativeSessions()) {
      const fixes = parseSession(s.text, lastT);
      if (fixes.length) {
        for (const part of chunks(fixes)) await feed(part, {}, { replay: true, liveFixes: false });
        last = Math.max(last, fixes[fixes.length - 1].t);
        total += fixes.length;
        logTimeline({ kind: 'native', event: 'ingested', detail: `${fixes.length} fixes` });
      }
      ackNativeSession(s.id);
      sessions += 1;
    }
    if (last > lastT) await settings.set(LAST_T_KEY, last);
    // An old drive: let the machine notice it has been parked for a long time (its stop rule is time-based).
    if (total > 0) await tick(Date.now());
  } catch (error) {
    recordError('trip-native-ingest', error);
  }
  return { sessions, fixes: total };
}

/** If the native recorder is still running while the app is in front, the app's service takes over (ingest first). */
export async function handOverToApp(): Promise<void> {
  if (Platform.OS !== 'android' || !tripTriggerAvailable || !isNativeRecording()) return;
  holdNative();
  stopNativeRecorder();
  logTimeline({ kind: 'native', event: 'handover' });
  // The service closes its file when it is destroyed, a moment after stopService returns.
  await new Promise((resolve) => setTimeout(resolve, 800));
  await ingestNativeSessions();
}

/** The native event log → the journal (once; the native copy is cleared). */
export function importNativeEvents(): void {
  const events = nativeEvents();
  if (!events.length) return;
  for (const e of events) logTimeline({ at: e.t, kind: 'native', event: e.e, detail: e.d || undefined });
  clearNativeEvents();
  recordNote('trip-native', `${events.length} native event(s) imported`);
}
