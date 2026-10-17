/**
 * The surfaces fed by the registry (IMP 16102026 ADR-62): shortcuts present and navigating, the tab strip's edge
 * logic (X4), telltales opening their destination, and "Descubre" picking an unused function.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('@/lib/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/constants/theme').palette.dark, scheme: 'dark' }) }));
jest.mock('@/components/T', () => ({ T: ({ children }: { children?: React.ReactNode }) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('@/lib/features/usage', () => ({ markFeatureUsed: jest.fn(async () => {}) }));

import { ShortcutRow } from '@/components/vehicle/ShortcutRow';
import { centerOffset, edgeState } from '@/components/ui/EdgeScroll';
import { DISCOVER_ORDER, pickDiscover } from '@/lib/features/discover';
import { activeFeatures, featureById, featureForTelltale, LAMP_TELLTALE } from '@/lib/features/registry';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

const press = (root: ReactTestInstance, label: string) => {
  const node = root.findAll((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label)[0];
  if (!node) throw new Error(`no ${label}`);
  act(() => node.props.onPress({}));
};

describe('vehicle shortcuts', () => {
  beforeEach(() => mockPush.mockClear());

  it('shows + Reparación, OBD, + Echada, + Evento, + Mod, + Foto in that order', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<ShortcutRow vehicleId="v1" />);
    });
    const labels = r.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
    expect(labels).toEqual(['+ Reparación', 'OBD', '+ Echada', '+ Evento', '+ Mod', '+ Foto']);
  });

  it('each one navigates with the vehicle', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<ShortcutRow vehicleId="v1" />);
    });
    press(r.root, es.features.items.obd.title);
    expect(mockPush).toHaveBeenLastCalledWith('/obd?vehicleId=v1');
    press(r.root, es.features.items.repair.title);
    expect(mockPush).toHaveBeenLastCalledWith('/servicio/nuevo?kind=reparacion&vehicleId=v1');
    press(r.root, es.features.items.mod.title);
    expect(mockPush).toHaveBeenLastCalledWith('/mod/nuevo?vehicleId=v1');
  });
});

describe('tab strip edges (X4)', () => {
  it('no fades when everything fits', () => expect(edgeState(0, 300, 390)).toEqual({ left: false, right: false }));
  it('fades on the right at the start, on both in the middle, on the left at the end', () => {
    expect(edgeState(0, 640, 390)).toEqual({ left: false, right: true });
    expect(edgeState(100, 640, 390)).toEqual({ left: true, right: true });
    expect(edgeState(250, 640, 390)).toEqual({ left: true, right: false });
  });
  it('centres the active tab and stays inside the strip', () => {
    expect(centerOffset(400, 80, 640, 390)).toBe(245);
    expect(centerOffset(0, 80, 640, 390)).toBe(0);
    expect(centerOffset(600, 80, 640, 390)).toBe(250);
  });
});

describe('telltales', () => {
  it('every lamp the cluster can show opens a registered function', () => {
    for (const [icon, id] of Object.entries(LAMP_TELLTALE)) {
      const def = featureForTelltale(id);
      expect(def).toBeDefined();
      expect(es.features.telltale.hint[id as keyof typeof es.features.telltale.hint]).toBeTruthy();
      expect(en.features.telltale.hint[id as keyof typeof en.features.telltale.hint]).toBeTruthy();
      expect(icon).toBeTruthy();
    }
  });
  it('the destinations match SPEC-C', () => {
    expect(featureForTelltale('check')?.id).toBe('obd');
    expect(featureForTelltale('oil')?.id).toBe('service');
    expect(featureForTelltale('coolant')?.id).toBe('event');
    expect(featureForTelltale('fuel')?.id).toBe('fuel');
    expect(featureForTelltale('battery')?.id).toBe('repair');
    expect(featureForTelltale('tire')?.id).toBe('build');
    expect(featureForTelltale('weekly')?.id).toBe('check');
  });
});

describe('Descubre', () => {
  it('starts with OBD and skips what was used or dismissed', () => {
    expect(pickDiscover(new Set(), new Set())?.id).toBe('obd');
    expect(pickDiscover(new Set(['obd']), new Set())?.id).toBe('repair');
    expect(pickDiscover(new Set(['obd']), new Set(['repair']))?.id).toBe('check');
  });
  it('returns nothing when everything was seen', () => {
    expect(pickDiscover(new Set(DISCOVER_ORDER), new Set())).toBeNull();
  });
  it('only suggests functions that exist in this build', () => {
    const ids = new Set(activeFeatures().map((f) => f.id));
    for (const id of DISCOVER_ORDER) expect(ids.has(id) || !featureById(id).enabled).toBe(true);
  });
});
