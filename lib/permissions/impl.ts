/**
 * The Android half of the permission registry (IMP 16102026 ADR-59): the only file outside `impl.web.ts` that calls a
 * system permission API. Everything else asks `lib/permissions`.
 *
 * Read the docs of Expo SDK 57 before changing a call here (AGENTS.md): expo-location, expo-notifications,
 * expo-image-picker, expo-media-library. What they say, and what this file relies on:
 * - `canAskAgain === false` → only the settings can change it.
 * - Location background (Android 11+): `requestBackgroundPermissionsAsync` opens the system settings page, after the
 *   foreground permission is granted; explain it first (the primer does).
 * - Notifications (Android 13+): the prompt only appears once a channel exists → `configure()` first.
 * - Camera: `launchCameraAsync` does not document what it does without the permission; ask first, then launch.
 */
import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { getBatteryState, openBatterySettings } from '../../modules/miui-autostart';
import { fromBattery, fromResponse, withLocationDetail } from './map';
import type { PermissionId, PermissionImpl, PermissionSnapshot } from './types';

// Loaded when used: they are native modules, and the registry is imported by half the app (and by its tests).
const imagePicker = () => import('expo-image-picker');
const mediaLibrary = () => import('expo-media-library');

const unavailable = (): PermissionSnapshot => ({ status: 'unavailable' });
const openAppSettings = () => Linking.openSettings();

async function locationForeground(): Promise<PermissionSnapshot> {
  const response = await Location.getForegroundPermissionsAsync();
  const base = fromResponse(response, 'native');
  if (base.status !== 'granted') return base;
  const services = await Location.hasServicesEnabledAsync().catch(() => null);
  return withLocationDetail(base, response, services);
}

async function locationBackground(): Promise<PermissionSnapshot> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) return { status: fg.status === 'undetermined' ? 'undetermined' : 'denied_can_ask', detail: 'needs_foreground' };
  const bg = await Location.getBackgroundPermissionsAsync();
  const snap = fromResponse(bg, 'native');
  // Android 11+ never shows a dialog for it: "denied" is a state of the settings page, not of a refusal.
  return snap.status === 'denied_blocked' ? { status: 'denied_can_ask' } : snap;
}

function withLimited(snap: PermissionSnapshot, accessPrivileges: string | undefined): PermissionSnapshot {
  return snap.status === 'granted' && accessPrivileges === 'limited' ? { status: 'granted', detail: 'limited' } : snap;
}

export const impl: Record<PermissionId, PermissionImpl> = {
  location_foreground: {
    check: locationForeground,
    async request() {
      await Location.requestForegroundPermissionsAsync();
      return locationForeground();
    },
    // The phone's location switch has its own screen; the permission lives in the app's page.
    async openSettings() {
      if ((await locationForeground()).status === 'services_off') {
        try {
          const IntentLauncher = await import('expo-intent-launcher');
          await IntentLauncher.startActivityAsync('android.settings.LOCATION_SOURCE_SETTINGS');
          return;
        } catch {
          // falls through to the app's page
        }
      }
      await openAppSettings();
    },
  },
  location_background: {
    check: locationBackground,
    async request() {
      const fg = await locationForeground();
      if (fg.status !== 'granted') return locationBackground();
      // Android 11+: opens the system page ("Permitir todo el tiempo"); the registry re-reads on return.
      await Location.requestBackgroundPermissionsAsync();
      return locationBackground();
    },
    openSettings: openAppSettings,
  },
  notifications: {
    async check() {
      const N = await import('expo-notifications');
      return fromResponse(await N.getPermissionsAsync(), 'native');
    },
    async request() {
      const N = await import('expo-notifications');
      // The Android 13 prompt only exists once there is a channel to attach it to.
      await (await import('../notifications')).configure();
      await N.requestPermissionsAsync();
      return fromResponse(await N.getPermissionsAsync(), 'native');
    },
    openSettings: openAppSettings,
  },
  camera: {
    async check() {
      return fromResponse(await (await imagePicker()).getCameraPermissionsAsync(), 'native');
    },
    async request() {
      return fromResponse(await (await imagePicker()).requestCameraPermissionsAsync(), 'native');
    },
    openSettings: openAppSettings,
  },
  photos: {
    async check() {
      const r = await (await mediaLibrary()).getPermissionsAsync(false, ['photo']);
      return withLimited(fromResponse(r, 'native'), r.accessPrivileges);
    },
    async request() {
      const r = await (await mediaLibrary()).requestPermissionsAsync(false, ['photo']);
      return withLimited(fromResponse(r, 'native'), r.accessPrivileges);
    },
    openSettings: openAppSettings,
  },
  battery_unrestricted: {
    // Not a permission the app can ask: the state is read, and the person is taken to the system's list.
    async check() {
      return fromBattery(getBatteryState());
    },
    async request() {
      if (!openBatterySettings()) await openAppSettings();
      return fromBattery(getBatteryState());
    },
    async openSettings() {
      if (!openBatterySettings()) await openAppSettings();
    },
  },
  storage_persist: { check: async () => unavailable(), request: async () => unavailable() },
  install_unknown_apps: {
    // Android shows its own screen the first time an APK is opened; there is no API to read it.
    async check() {
      return { status: 'unknown' };
    },
    async request() {
      await openInstallUnknownApps();
      return { status: 'unknown' };
    },
    openSettings: openInstallUnknownApps,
  },
};

async function openInstallUnknownApps(): Promise<void> {
  try {
    const IntentLauncher = await import('expo-intent-launcher');
    const { applicationId } = await import('expo-application');
    await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', { data: `package:${applicationId}` });
  } catch {
    await openAppSettings();
  }
}

/** Raw location answers for the trip diagnostics (lib/trips/diagnostics.ts) — the registry owns the calls. */
export async function rawLocationPermissions() {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => null),
    Location.getBackgroundPermissionsAsync().catch(() => null),
  ]);
  return { foreground, background };
}

/** Android 14+ "some photos": lets the person add more to what the app can see. */
export async function managePhotoAccess(): Promise<void> {
  await (await mediaLibrary()).presentPermissionsPicker(['photo']);
}

/** Opens the app's page in the system settings. */
export { openAppSettings };
