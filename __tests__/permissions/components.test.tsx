/**
 * The permission components (IMP 16102026 ADR-59, SPEC-A "Pruebas"): the primer comes before the system dialog,
 * "Ahora no" asks nothing, a blocked permission shows the way out, and the state corrects itself when the app comes
 * back. The registry's platform half is mocked; the store, the hook and the components are the real ones.
 */
import React from 'react';
import { AppState, Text, View } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/constants/theme').palette.dark, scheme: 'dark' }) }));
jest.mock('@/components/T', () => ({ T: ({ children }: { children?: React.ReactNode }) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('@/components/ui', () => {
  const R = require('react');
  const { Pressable: P, Text: Tx, View: V } = require('react-native');
  const button = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) =>
    R.createElement(P, { onPress, disabled, accessibilityRole: 'button', label }, R.createElement(Tx, null, label));
  return {
    PrimaryButton: button,
    GhostButton: button,
    Surface: ({ children }: { children?: React.ReactNode }) => R.createElement(V, null, children),
    Badge: ({ label }: { label: string }) => R.createElement(Tx, null, label),
    Sheet: ({ visible, title, children }: { visible: boolean; title?: string; children?: React.ReactNode }) =>
      visible ? R.createElement(V, { sheet: title }, R.createElement(Tx, null, title), children) : null,
  };
});
jest.mock('@/lib/db/repos', () => ({ settings: { get: jest.fn(async () => []), set: jest.fn(async () => {}) } }));
jest.mock('@/lib/diagnostics', () => ({ recordError: jest.fn() }));
jest.mock('@/lib/permissions/impl', () => {
  const make = () => ({ check: jest.fn(), request: jest.fn() });
  return {
    impl: {
      location_foreground: make(),
      location_background: make(),
      notifications: make(),
      camera: make(),
      photos: make(),
      battery_unrestricted: make(),
      storage_persist: make(),
      install_unknown_apps: make(),
    },
    openAppSettings: jest.fn(async () => {}),
    managePhotoAccess: jest.fn(async () => {}),
    rawLocationPermissions: jest.fn(),
  };
});

const mockPush = jest.fn();
type Mocked = { check: jest.Mock; request: jest.Mock; openSettings?: jest.Mock };
const impl = (jest.requireMock('@/lib/permissions/impl') as { impl: Record<string, Mocked> }).impl;

import { PermissionBanner } from '@/components/permissions/PermissionBanner';
import { chipLabel, PermissionChip } from '@/components/permissions/PermissionChip';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { rowAction } from '@/components/permissions/PermissionRow';
import { usePermissionRequest } from '@/components/permissions/usePermissionRequest';
import { __resetPermissions } from '@/lib/permissions/store';

const texts = (root: ReactTestInstance) => root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
const button = (root: ReactTestInstance, label: string) => root.findAll((n) => n.props.label === label && typeof n.props.onPress === 'function')[0];
/** The pressable controls (react-native's Pressable is a memo component: found by role and handler). */
const pressables = (root: ReactTestInstance) => root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function');
const flush = () => act(async () => {});

let appHandler: ((s: string) => void) | null = null;

beforeEach(() => {
  __resetPermissions();
  mockPush.mockClear();
  appHandler = null;
  for (const m of Object.values(impl)) {
    m.check.mockReset();
    m.request.mockReset();
  }
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    appHandler = h;
    return { remove: jest.fn() };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

/** Mounts a probe that exposes the hook's value. */
function mount(id: Parameters<typeof usePermissionRequest>[0]) {
  const ref: { current: ReturnType<typeof usePermissionRequest> | null } = { current: null };
  function Probe() {
    const v = usePermissionRequest(id);
    ref.current = v;
    return React.createElement(View, null, v.sheet);
  }
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(React.createElement(Probe));
  });
  return { tree, ref };
}

describe('usePermissionRequest.ensure — the primer comes first', () => {
  it('already granted: true at once, nothing shown, nothing asked', async () => {
    impl.location_foreground.check.mockResolvedValue({ status: 'granted' });
    const { tree, ref } = mount('location_foreground');
    await flush();
    await expect(ref.current!.ensure()).resolves.toBe(true);
    expect(impl.location_foreground.request).not.toHaveBeenCalled();
    expect(texts(tree.root).join('|')).not.toMatch(/Tu ubicación/);
  });

  it('never asked: the primer shows, and the system dialog waits for "Permitir ubicación"', async () => {
    impl.location_foreground.check.mockResolvedValue({ status: 'undetermined' });
    impl.location_foreground.request.mockResolvedValue({ status: 'granted' });
    const { tree, ref } = mount('location_foreground');
    await flush();
    let result: boolean | undefined;
    await act(async () => {
      void ref.current!.ensure().then((ok) => (result = ok));
    });
    expect(texts(tree.root).join('|')).toMatch(/Para mostrarte en el mapa y grabar tus viajes/);
    expect(impl.location_foreground.request).not.toHaveBeenCalled(); // not in cold
    expect(result).toBeUndefined();

    await act(async () => {
      button(tree.root, 'Permitir ubicación').props.onPress();
    });
    expect(impl.location_foreground.request).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('"Ahora no" asks nothing and answers false', async () => {
    impl.camera.check.mockResolvedValue({ status: 'undetermined' });
    const { tree, ref } = mount('camera');
    await flush();
    let result: boolean | undefined;
    await act(async () => {
      void ref.current!.ensure().then((ok) => (result = ok));
    });
    await act(async () => {
      button(tree.root, 'Ahora no').props.onPress();
    });
    expect(result).toBe(false);
    expect(impl.camera.request).not.toHaveBeenCalled();
  });

  it('refused but askable (Android): the primer again', async () => {
    impl.notifications.check.mockResolvedValue({ status: 'denied_can_ask' });
    const { tree, ref } = mount('notifications');
    await flush();
    await act(async () => {
      void ref.current!.ensure();
    });
    expect(button(tree.root, 'Permitir avisos')).toBeTruthy();
  });

  it('blocked: no dialog, the steps with "Ya la activé"; tapping it reads the state again', async () => {
    impl.location_foreground.check.mockResolvedValue({ status: 'denied_blocked' });
    const { tree, ref } = mount('location_foreground');
    await flush();
    await act(async () => {
      await expect(ref.current!.ensure()).resolves.toBe(false);
    });
    expect(impl.location_foreground.request).not.toHaveBeenCalled();
    expect(texts(tree.root).join('|')).toMatch(/Cómo activarlo/);
    const calls = impl.location_foreground.check.mock.calls.length;
    await act(async () => {
      button(tree.root, 'Ya la activé').props.onPress();
    });
    expect(impl.location_foreground.check.mock.calls.length).toBeGreaterThan(calls);
  });

  it('location services off shows the phone-switch steps, not a permission dialog', async () => {
    impl.location_foreground.check.mockResolvedValue({ status: 'services_off' });
    const { tree, ref } = mount('location_foreground');
    await flush();
    await act(async () => {
      await expect(ref.current!.ensure()).resolves.toBe(false);
    });
    expect(texts(tree.root).join('|')).toMatch(/Activa «Ubicación»/);
  });

  it('the phone cannot tell (unknown): the function is allowed to try', async () => {
    impl.battery_unrestricted.check.mockResolvedValue({ status: 'unknown' });
    const { ref } = mount('battery_unrestricted');
    await flush();
    await expect(ref.current!.ensure()).resolves.toBe(true);
  });
});

describe('PermissionChip', () => {
  const render = async (id: Parameters<typeof chipLabel>[0], snap: { status: string }) => {
    impl[id].check.mockResolvedValue(snap);
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(PermissionChip, { id }));
    });
    await flush();
    return tree;
  };

  it('granted: nothing', async () => {
    const tree = await render('location_foreground', { status: 'granted' });
    expect(pressables(tree.root)).toHaveLength(0);
  });

  it('never asked: "Activar mi ubicación" — and pressing it shows the primer, not the dialog', async () => {
    const tree = await render('location_foreground', { status: 'undetermined' });
    const chip = pressables(tree.root)[0];
    expect(chip.props.accessibilityLabel).toMatch(/Activar la ubicación/);
    await act(async () => {
      chip.props.onPress();
    });
    expect(texts(tree.root).join('|')).toMatch(/Tu ubicación/);
    expect(impl.location_foreground.request).not.toHaveBeenCalled();
  });

  it('the words for each state', () => {
    expect(chipLabel('location_foreground', 'denied_blocked')?.label).toBe('Ubicación bloqueada · Cómo activarla');
    expect(chipLabel('location_foreground', 'services_off')?.label).toBe('Activa la ubicación del teléfono');
    expect(chipLabel('camera', 'denied_blocked')?.label).toBe('Cámara bloqueado · Cómo activarlo');
    expect(chipLabel('camera', 'undetermined')?.label).toBe('Activar: Cámara');
    expect(chipLabel('camera', 'granted')).toBeNull();
    expect(chipLabel('camera', 'unavailable')).toBeNull();
    expect(chipLabel('location_foreground', 'unavailable')?.label).toMatch(/HTTPS/);
  });
});

describe('PermissionGate', () => {
  const gate = () => (
    <PermissionGate id="camera">
      <Text>FEATURE</Text>
    </PermissionGate>
  );

  it('granted: the feature', async () => {
    impl.camera.check.mockResolvedValue({ status: 'granted' });
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(gate());
    });
    await flush();
    expect(texts(tree.root)).toContain('FEATURE');
  });

  it('missing: what it is for, and the chip — not the feature', async () => {
    impl.camera.check.mockResolvedValue({ status: 'undetermined' });
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(gate());
    });
    await flush();
    const all = texts(tree.root).join('|');
    expect(all).not.toContain('FEATURE');
    expect(all).toMatch(/Para fotografiar tu carro/);
    expect(pressables(tree.root).length).toBeGreaterThan(0);
  });

  it('coming back from the settings corrects it by itself (AppState active)', async () => {
    impl.camera.check.mockResolvedValue({ status: 'denied_blocked' });
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(gate());
    });
    await flush();
    expect(texts(tree.root)).not.toContain('FEATURE');

    // The person turned it on in the system settings and returns to the app.
    impl.camera.check.mockResolvedValue({ status: 'granted' });
    await act(async () => {
      appHandler?.('active');
    });
    await flush();
    expect(texts(tree.root)).toContain('FEATURE');
  });
});

describe('PermissionBanner', () => {
  it('lists what is missing and goes to Permisos y acceso', async () => {
    impl.camera.check.mockResolvedValue({ status: 'denied_blocked' });
    impl.notifications.check.mockResolvedValue({ status: 'granted' });
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(PermissionBanner, { ids: ['camera', 'notifications'] }));
    });
    await flush();
    const all = texts(tree.root).join('|');
    expect(all).toMatch(/Falta un permiso/);
    expect(all).toMatch(/Cámara/);
    expect(all).not.toMatch(/Notificaciones/);
    await act(async () => {
      button(tree.root, 'Ver permisos').props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/permisos');
  });

  it('nothing when everything is in order', async () => {
    impl.camera.check.mockResolvedValue({ status: 'granted' });
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(React.createElement(PermissionBanner, { ids: ['camera'] }));
    });
    await flush();
    expect(tree.toJSON()).toBeNull();
  });
});

describe('rowAction — the one button of a Permisos row', () => {
  it('maps state → button', () => {
    expect(rowAction('camera', 'granted')).toBeNull();
    expect(rowAction('camera', 'undetermined')).toBe('allow');
    expect(rowAction('camera', 'denied_can_ask')).toBe('allow');
    expect(rowAction('camera', 'denied_blocked')).toBe('how');
    expect(rowAction('location_foreground', 'services_off')).toBe('how');
    expect(rowAction('location_foreground', 'granted', 'approximate')).toBe('settings');
    expect(rowAction('location_background', 'denied_can_ask', 'needs_foreground')).toBeNull();
    expect(rowAction('battery_unrestricted', 'unknown')).toBe('settings');
    expect(rowAction('camera', 'unavailable')).toBeNull();
  });
});

describe('web: the page becoming visible again re-reads (an installed PWA coming back from the iPhone settings)', () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it('visibilitychange → visible refreshes the state', async () => {
    const listeners: Record<string, () => void> = {};
    const doc = { visibilityState: 'hidden', addEventListener: (n: string, l: () => void) => (listeners[n] = l), removeEventListener: jest.fn() };
    (globalThis as { document?: unknown }).document = doc;
    impl.location_foreground.check.mockResolvedValue({ status: 'denied_blocked' });
    const gate = (
      <PermissionGate id="location_foreground">
        <Text>MAP</Text>
      </PermissionGate>
    );
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(gate);
    });
    await flush();
    expect(texts(tree.root)).not.toContain('MAP');

    impl.location_foreground.check.mockResolvedValue({ status: 'granted' });
    doc.visibilityState = 'visible';
    await act(async () => {
      listeners.visibilitychange?.();
    });
    await flush();
    expect(texts(tree.root)).toContain('MAP');
  });
});
