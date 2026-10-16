/**
 * The permission registry's vocabulary (IMP 16102026 ADR-59, SPEC-A). One list of what the app can ask for, one set
 * of states, whatever the platform: Android (APK) or the web / iPhone PWA.
 */
export type PermissionId =
  | 'location_foreground'
  | 'location_background'
  | 'notifications'
  | 'camera'
  | 'photos'
  | 'battery_unrestricted'
  | 'storage_persist'
  | 'install_unknown_apps';

/**
 * - `undetermined`    never asked: the system dialog has not been shown.
 * - `denied_can_ask`  refused, but the system will ask again (Android `canAskAgain`).
 * - `denied_blocked`  only the settings can change it (Android after "no volver a preguntar"; the web, always: a page cannot ask twice).
 * - `services_off`    the permission is there but the phone's location services are off.
 * - `unavailable`     this platform cannot do it (no GPS, not HTTPS, no background on the web).
 * - `unknown`         the phone does not say (MIUI battery on an old APK, "install unknown apps").
 */
export type PermissionStatus = 'granted' | 'undetermined' | 'denied_can_ask' | 'denied_blocked' | 'services_off' | 'unavailable' | 'unknown';

/** What a check or a request returns: the status, plus what is worth saying about a "granted". */
export type PermissionSnapshot = {
  status: PermissionStatus;
  /** `approximate`: Android gave only coarse location · `limited`: partial photo access · `needs_foreground`: background asked before foreground. */
  detail?: 'approximate' | 'limited' | 'needs_foreground';
};

export type PermissionPlatform = 'android' | 'web';

/** What a platform implements for one permission (lib/permissions/impl.ts and impl.web.ts). */
export type PermissionImpl = {
  check(): Promise<PermissionSnapshot>;
  /** Shows the system dialog, or sends to the system screen when there is no dialog (Android 11+ background). */
  request(): Promise<PermissionSnapshot>;
  /** The system screen where the person can change it; absent on the web (a page cannot open them). */
  openSettings?(): Promise<void>;
};

export type PermissionDef = {
  id: PermissionId;
  platforms: PermissionPlatform[];
  /** Ionicons glyph. */
  icon: string;
  /** Which functions need it (shown on the Permisos screen). */
  usedBy: string[];
};
