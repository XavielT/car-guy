/**
 * Automatic trips, the native half (modules/trip-trigger, Android only; IMP 03112026 PROMPT-09).
 *
 * Google Play services' Activity Recognition tells Car Guy "you are in a vehicle" even with the app closed; a native
 * foreground service then records the fixes to a file, and the app replays them through the trip machine when it opens
 * (lib/trips/nativeTrigger.ts). Every function is safe to call anywhere: on web, iOS, Expo Go or an older APK without the
 * module it returns the "not available" answer instead of throwing.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

type Native = {
  hasActivityPermission(): boolean;
  arm(): Promise<string>;
  disarm(): Promise<boolean>;
  isArmed(): boolean;
  isRecording(): boolean;
  stopRecorder(): boolean;
  holdForJs(untilMs: number): void;
  drainSessions(): { id: string; text: string }[];
  ackSession(id: string): boolean;
  events(): string;
  clearEvents(): void;
  lastExitReasons(): string;
};

const native = requireOptionalNativeModule<Native>('TripTrigger');

export const tripTriggerAvailable = native != null;

export type NativeEvent = { t: number; e: string; d: string };
export type ExitReason = { t: number; reason: number; importance: number; description: string };
export type NativeSession = { id: string; text: string };

/** "ok" · "no-permission" (Activity Recognition not granted) · "unavailable" (no module) · "error: ..." */
export async function armTripTrigger(): Promise<string> {
  try {
    return native ? await native.arm() : 'unavailable';
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function disarmTripTrigger(): Promise<void> {
  try {
    await native?.disarm();
  } catch {
    // nothing to undo
  }
}

export function hasActivityPermission(): boolean {
  try {
    return native?.hasActivityPermission() ?? false;
  } catch {
    return false;
  }
}

export function isTripTriggerArmed(): boolean {
  try {
    return native?.isArmed() ?? false;
  } catch {
    return false;
  }
}

export function isNativeRecording(): boolean {
  try {
    return native?.isRecording() ?? false;
  } catch {
    return false;
  }
}

/** Stops the native recorder (the app is in front and records itself). Returns whether it was running. */
export function stopNativeRecorder(): boolean {
  try {
    return native?.stopRecorder() ?? false;
  } catch {
    return false;
  }
}

/** The app's own location service is recording until `untilMs`: the native recorder must not start (or must stop). */
export function holdNativeForJs(untilMs: number): void {
  try {
    native?.holdForJs(untilMs);
  } catch {
    // best effort
  }
}

export function drainNativeSessions(): NativeSession[] {
  try {
    return native?.drainSessions() ?? [];
  } catch {
    return [];
  }
}

export function ackNativeSession(id: string): void {
  try {
    native?.ackSession(id);
  } catch {
    // it will be offered again
  }
}

export function nativeEvents(): NativeEvent[] {
  try {
    const parsed: unknown = JSON.parse(native?.events() ?? '[]');
    return Array.isArray(parsed) ? (parsed as NativeEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearNativeEvents(): void {
  try {
    native?.clearEvents();
  } catch {
    // best effort
  }
}

/** The system's record of why the process ended, newest first (Android 11+; empty elsewhere). */
export function lastExitReasons(): ExitReason[] {
  try {
    const parsed: unknown = JSON.parse(native?.lastExitReasons() ?? '[]');
    return Array.isArray(parsed) ? (parsed as ExitReason[]) : [];
  } catch {
    return [];
  }
}
