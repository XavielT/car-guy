import { Platform } from 'react-native';

import type { PermissionDef, PermissionId, PermissionPlatform } from './types';

/**
 * What the app can ask for, and where (IMP 16102026 ADR-59). The list the Permisos screen walks, in the order it
 * shows them; the texts live in `t.permissions.items[id]`.
 */
export const DEFS: PermissionDef[] = [
  { id: 'location_foreground', platforms: ['android', 'web'], icon: 'location-outline', usedBy: ['drive', 'trips', 'juntes', 'zones'] },
  { id: 'location_background', platforms: ['android'], icon: 'navigate-circle-outline', usedBy: ['auto'] },
  { id: 'notifications', platforms: ['android'], icon: 'notifications-outline', usedBy: ['reminders', 'auto'] },
  { id: 'camera', platforms: ['android'], icon: 'camera-outline', usedBy: ['photos', 'profile'] },
  { id: 'photos', platforms: ['android'], icon: 'images-outline', usedBy: ['album'] },
  { id: 'battery_unrestricted', platforms: ['android'], icon: 'battery-charging-outline', usedBy: ['auto'] },
  { id: 'install_unknown_apps', platforms: ['android'], icon: 'download-outline', usedBy: ['updates'] },
  { id: 'storage_persist', platforms: ['web'], icon: 'save-outline', usedBy: ['data'] },
];

export const currentPlatform = (): PermissionPlatform => (Platform.OS === 'web' ? 'web' : 'android');

export function defOf(id: PermissionId): PermissionDef {
  return DEFS.find((d) => d.id === id)!;
}

export function appliesHere(id: PermissionId, platform: PermissionPlatform = currentPlatform()): boolean {
  return defOf(id).platforms.includes(platform);
}

/** The permissions that exist on this platform, in screen order. */
export function permissionsHere(platform: PermissionPlatform = currentPlatform()): PermissionId[] {
  return DEFS.filter((d) => d.platforms.includes(platform)).map((d) => d.id);
}
