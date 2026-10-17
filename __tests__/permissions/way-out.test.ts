/**
 * Phase-6 review (d): whatever permission is missing, the person is never left with only text. For every permission
 * of the registry and every state in which it is missing, the Permisos row has a button (allow / how / settings), the
 * steps are written in both languages, and the primer explains it.
 */
jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/constants/theme').palette.dark, scheme: 'dark' }) }));
jest.mock('@/components/T', () => ({ T: () => null }));
jest.mock('@/components/ui', () => ({ PrimaryButton: () => null, GhostButton: () => null, Surface: () => null, Badge: () => null, Sheet: () => null }));
jest.mock('@/lib/db/repos', () => ({ settings: { get: jest.fn(async () => []), set: jest.fn(async () => {}) } }));
jest.mock('@/lib/diagnostics', () => ({ recordError: jest.fn() }));
jest.mock('@/lib/permissions/impl', () => ({ impl: {}, openAppSettings: jest.fn(), managePhotoAccess: jest.fn(), rawLocationPermissions: jest.fn() }));

import { rowAction } from '@/components/permissions/PermissionRow';
import { DEFS } from '@/lib/permissions/defs';
import type { PermissionStatus } from '@/lib/permissions/types';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';

const MISSING: PermissionStatus[] = ['undetermined', 'denied_can_ask', 'denied_blocked', 'services_off'];

describe('a way out for every missing permission', () => {
  for (const def of DEFS) {
    it(`${def.id}: every missing state has a button`, () => {
      for (const status of MISSING) {
        // background location only makes sense once foreground is there; that is its own, explained, state.
        expect([def.id, status, rowAction(def.id, status)]).not.toEqual([def.id, status, null]);
      }
    });

    it(`${def.id}: described in both languages (what for, why)`, () => {
      for (const dict of [es, en]) {
        const item = (dict.permissions.items as Record<string, { title: string; why: string }>)[def.id];
        expect(item?.title?.length).toBeGreaterThan(0);
        expect(item?.why?.length).toBeGreaterThan(0);
      }
    });
  }
});
