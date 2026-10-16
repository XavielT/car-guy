import type { PermissionSnapshot, PermissionStatus } from './types';

/** The shape expo-location / expo-notifications / expo-image-picker / expo-media-library all answer with. */
export type PermissionResponseLike = { granted?: boolean; status?: string; canAskAgain?: boolean };

/**
 * A system permission response as the app's states. Pure.
 *
 * - The expo-location web shim answers `{status: 'granted', granted: false}` to a position error (code 2/3): the
 *   permission is there, the position is not — so `status === 'granted'` counts.
 * - It also answers `canAskAgain: true` to a refusal. A page cannot ask twice, so on the web every refusal is blocked.
 */
export function fromResponse(r: PermissionResponseLike, os: 'native' | 'web'): PermissionSnapshot {
  if (r.granted || r.status === 'granted') return { status: 'granted' };
  if (r.status === 'undetermined') return { status: 'undetermined' };
  if (r.status === 'denied' || r.granted === false) {
    if (os === 'web') return { status: 'denied_blocked' };
    return { status: r.canAskAgain === false ? 'denied_blocked' : 'denied_can_ask' };
  }
  return { status: 'unknown' };
}

/** `navigator.permissions.query` state → status. */
export function fromWebQuery(state: string | undefined): PermissionSnapshot {
  if (state === 'granted') return { status: 'granted' };
  if (state === 'prompt') return { status: 'undetermined' };
  if (state === 'denied') return { status: 'denied_blocked' };
  return { status: 'unknown' };
}

/** Location: Android's coarse-only grant and the phone's location services on top of the permission. */
export function withLocationDetail(
  base: PermissionSnapshot,
  response: { android?: { accuracy?: string } } | null | undefined,
  servicesEnabled: boolean | null,
): PermissionSnapshot {
  if (base.status !== 'granted') return base;
  if (servicesEnabled === false) return { status: 'services_off' };
  if (response?.android?.accuracy === 'coarse') return { status: 'granted', detail: 'approximate' };
  return base;
}

/** MIUI/Android battery optimisation: `optimized` can be changed from the settings; `unknown` cannot be read. */
export function fromBattery(state: 'unrestricted' | 'optimized' | 'unknown'): PermissionSnapshot {
  if (state === 'unrestricted') return { status: 'granted' };
  if (state === 'optimized') return { status: 'denied_can_ask' };
  return { status: 'unknown' };
}

export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unknown';

/**
 * Why a position could not be read (IMP 16102026 M-5). The browser's codes: 1 permission denied (on iOS also the
 * location services being off), 2 position unavailable, 3 timeout. expo-location's web shim hands the error handler
 * only a string (`error.message`, or `geolocation error N` when empty), so the text is read too.
 */
export function geoErrorKind(error: unknown): GeoErrorKind {
  const code = typeof error === 'number' ? error : typeof (error as { code?: unknown })?.code === 'number' ? (error as { code: number }).code : null;
  if (code === 1) return 'denied';
  if (code === 2) return 'unavailable';
  if (code === 3) return 'timeout';
  const text = typeof error === 'string' ? error : error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? '');
  const n = /geolocation error (\d)/i.exec(text)?.[1];
  if (n) return geoErrorKind(Number(n));
  if (/denied|permission/i.test(text)) return 'denied';
  if (/time ?out|timed out/i.test(text)) return 'timeout';
  if (/unavailable|position|location/i.test(text)) return 'unavailable';
  return 'unknown';
}

export const canAskInApp = (s: PermissionStatus) => s === 'undetermined' || s === 'denied_can_ask';
export const needsSettings = (s: PermissionStatus) => s === 'denied_blocked' || s === 'services_off';
export const isMissing = (s: PermissionStatus) => s !== 'granted' && s !== 'unavailable' && s !== 'unknown';
