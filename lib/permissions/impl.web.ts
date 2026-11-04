/**
 * The web / iPhone-PWA half of the permission registry (IMP 16102026 ADR-59). A page cannot open the system settings
 * and cannot ask twice: every refusal is `denied_blocked`, and the screens show the steps instead (SPEC-A).
 *
 * Safari 16+ has `navigator.permissions.query({name: 'geolocation'})`: it reads the state without showing a dialog.
 * Where it is missing the state is `unknown` until the first request.
 */
import { WEB_PRECISE_GPS } from '../trips/webGeo';
import { fromWebQuery, geoErrorKind } from './map';
import type { PermissionId, PermissionImpl, PermissionSnapshot } from './types';

const nope = async (): Promise<PermissionSnapshot> => ({ status: 'unavailable' });
const none: PermissionImpl = { check: nope, request: nope };

function geoSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator && (typeof window === 'undefined' || window.isSecureContext !== false);
}

async function queryGeolocation(): Promise<PermissionSnapshot> {
  if (!geoSupported()) return { status: 'unavailable' };
  try {
    const q = await navigator.permissions?.query?.({ name: 'geolocation' as PermissionName });
    return fromWebQuery(q?.state);
  } catch {
    return { status: 'unknown' };
  }
}

/** Shows the browser's dialog (it needs a gesture) with the precise options, and reads why it failed (codes 1/2/3). */
function askGeolocation(): Promise<PermissionSnapshot> {
  return new Promise((resolve) => {
    if (!geoSupported()) return resolve({ status: 'unavailable' });
    navigator.geolocation.getCurrentPosition(
      () => resolve({ status: 'granted' }),
      async (error) => {
        // 1 = refused. 2 and 3 are about the position, not the permission: read the permission again.
        if (geoErrorKind(error) === 'denied') return resolve({ status: 'denied_blocked' });
        const now = await queryGeolocation();
        resolve(now.status === 'unknown' ? { status: 'granted' } : now);
      },
      { enableHighAccuracy: WEB_PRECISE_GPS.enableHighAccuracy, maximumAge: 0, timeout: WEB_PRECISE_GPS.timeout },
    );
  });
}

function micSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && (typeof window === 'undefined' || window.isSecureContext !== false);
}

/** Reads the state without a dialog where the browser can (Chrome, Firefox, Safari 16+); `unknown` until asked elsewhere. */
async function queryMicrophone(): Promise<PermissionSnapshot> {
  if (!micSupported()) return { status: 'unavailable' };
  try {
    const q = await navigator.permissions?.query?.({ name: 'microphone' as PermissionName });
    return fromWebQuery(q?.state);
  } catch {
    return { status: 'unknown' };
  }
}

/** Shows the browser's dialog (it needs a gesture); the stream is closed at once, the recorder opens its own. */
async function askMicrophone(): Promise<PermissionSnapshot> {
  if (!micSupported()) return { status: 'unavailable' };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { status: 'granted' };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    // Refused or blocked: a page cannot ask twice. No microphone at all is not a refusal.
    return name === 'NotFoundError' || name === 'OverconstrainedError' ? { status: 'unavailable' } : { status: 'denied_blocked' };
  }
}

export const impl: Record<PermissionId, PermissionImpl> = {
  location_foreground: { check: queryGeolocation, request: askGeolocation },
  location_background: none,
  notifications: none,
  camera: none,
  microphone: { check: queryMicrophone, request: askMicrophone },
  photos: none,
  battery_unrestricted: none,
  install_unknown_apps: none,
  storage_persist: {
    async check() {
      if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return { status: 'unavailable' };
      return (await navigator.storage.persisted()) ? { status: 'granted' } : { status: 'undetermined' };
    },
    async request() {
      if (typeof navigator === 'undefined' || !navigator.storage?.persist) return { status: 'unavailable' };
      try {
        return (await navigator.storage.persist()) ? { status: 'granted' } : { status: 'denied_blocked' };
      } catch {
        return { status: 'unknown' };
      }
    },
  },
};

export async function rawLocationPermissions() {
  const q = await navigator.permissions?.query?.({ name: 'geolocation' as PermissionName }).catch(() => null);
  const state = q?.state;
  const foreground = state ? { status: state === 'prompt' ? 'undetermined' : state, granted: state === 'granted', canAskAgain: state === 'prompt' } : null;
  return { foreground, background: null };
}

export async function managePhotoAccess(): Promise<void> {}

export async function openAppSettings(): Promise<void> {
  // A page cannot open the browser's or iOS's settings.
}
