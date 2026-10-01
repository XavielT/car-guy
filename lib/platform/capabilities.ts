/**
 * Platform truth (IMP 01102026 ADR-48, conventions §1): what this device can actually do, so the copy never
 * promises background work a platform forbids. Pure classification + a cached `currentPlatform()`.
 *
 * - android-native — the APK: background location, Automático, the foreground service.
 * - web-ios-pwa — Safari "Agregar a inicio": no background location, no background tasks; manual trips only
 *   with the screen on (Safari's rule, not Car Guy's).
 * - web-ios-safari — a Safari tab on iPhone/iPad: same limits, and its storage is separate from the PWA's.
 * - web-android — Chrome & co. on Android: manual only (the APK is the way to Automático).
 * - web-desktop — everything else on the web.
 */
import { Platform } from 'react-native';

export type AppPlatform = 'android-native' | 'ios-native' | 'web-ios-pwa' | 'web-ios-safari' | 'web-android' | 'web-desktop';

export type PlatformProbe = {
  os: string;
  userAgent?: string;
  /** iPadOS 13+ reports a Mac UA; touch points tell them apart. */
  maxTouchPoints?: number;
  /** `navigator.standalone` (iOS) or `display-mode: standalone`. */
  standalone?: boolean;
};

export function classifyPlatform(p: PlatformProbe): AppPlatform {
  if (p.os === 'android') return 'android-native';
  if (p.os === 'ios') return 'ios-native';
  const ua = p.userAgent ?? '';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (p.maxTouchPoints ?? 0) > 1);
  if (ios) return p.standalone ? 'web-ios-pwa' : 'web-ios-safari';
  if (/Android/i.test(ua)) return 'web-android';
  return 'web-desktop';
}

export const isIosWeb = (p: AppPlatform) => p === 'web-ios-pwa' || p === 'web-ios-safari';

/** Automatic trip detection exists only in the Android app. */
export const canAutoTrips = (p: AppPlatform) => p === 'android-native';

let cached: AppPlatform | null = null;

export function currentPlatform(): AppPlatform {
  if (cached) return cached;
  if (Platform.OS !== 'web') return (cached = classifyPlatform({ os: Platform.OS }));
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { standalone?: boolean }) : undefined;
  const standalone =
    Boolean(nav?.standalone) ||
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
  return (cached = classifyPlatform({ os: 'web', userAgent: nav?.userAgent, maxTouchPoints: nav?.maxTouchPoints, standalone }));
}

/**
 * Asks the browser to keep this site's data (OPFS / IndexedDB) under storage pressure — WebKit grants it to
 * Home-Screen apps by heuristics (research 01 §1.3). Once per device, after the first vehicle exists; the
 * answer is remembered by the caller. Resolves null where the API does not exist.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
