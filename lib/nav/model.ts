/**
 * The navigation as DATA (SPEC-K §K2, PROMPT-12 step 5): the phone's tab bar and the desktop side rail read this one list, so a rename or a
 * new destination is made once. Names say what the person wants to do or see, not what the module is called.
 *
 * Phone (≤ 5 slots): Hoy · Garaje · [CONDUCIR disc] · Historial · Más — `tab: true` marks them; the CONDUCIR disc is drawn by the tab bar
 * itself (ADR-43) and lives here as a tab so the rail and the bar agree. Desktop rail: all six (the hub "Todas las funciones" is a rail row).
 * `id`s are the ones `railActive` (lib/theme/layout.ts) returns.
 */
import type Ionicons from '@expo/vector-icons/Ionicons';

import { t } from '../i18n';
import type { RailId } from '../theme/layout';

export type NavItem = {
  id: RailId;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: () => string;
  /** Keyboard chord on the desktop (g + letter). */
  key: string;
  /** On the phone's tab bar. */
  tab: boolean;
  /** The expo-router tab name, when it is a tab. */
  tabName?: 'index' | 'garaje' | 'historial' | 'mas';
};

export const NAV_ITEMS: NavItem[] = [
  { id: 'inicio', href: '/', icon: 'speedometer-outline', label: () => t.tabs.inicio, key: 'g i', tab: true, tabName: 'index' },
  { id: 'garaje', href: '/garaje', icon: 'car-sport-outline', label: () => t.tabs.garaje, key: 'g g', tab: true, tabName: 'garaje' },
  { id: 'conducir', href: '/conducir', icon: 'navigate-circle-outline', label: () => t.tabs.conducir, key: 'g c', tab: false },
  { id: 'historial', href: '/historial', icon: 'time-outline', label: () => t.tabs.historial, key: 'g h', tab: true, tabName: 'historial' },
  { id: 'herramientas', href: '/herramientas', icon: 'apps-outline', label: () => t.features.title, key: 'g t', tab: false },
  { id: 'mas', href: '/mas', icon: 'ellipsis-horizontal', label: () => t.tabs.mas, key: 'g m', tab: true, tabName: 'mas' },
];

/** The phone's tab slots: the four tabs plus the CONDUCIR disc = 5 (the SPEC-K ceiling). */
export const PHONE_SLOTS = NAV_ITEMS.filter((i) => i.tab).length + 1;

export const navItem = (id: RailId): NavItem => NAV_ITEMS.find((i) => i.id === id) as NavItem;
