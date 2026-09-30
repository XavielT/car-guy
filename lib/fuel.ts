import { displayUnitLabel, economyUnitLabel, perUnitLabel, type EconomyUnit, type VolumeUnit } from './domain/units';
import { t } from './i18n';
import type { FuelGroup, FuelType, ReferencePrices } from './types';

export type FuelMeta = {
  id: FuelType;
  group: FuelGroup;
  grade: string;
  label: string;
  shortLabel: string;
  unit: 'gal' | 'm3';
  unitLabel: string;
  perUnitLabel: string;
};

/** Labels are getters over the dictionary (ADR-39); ids, units and groups are fixed. */
export const FUEL_CATALOG: Record<FuelType, FuelMeta> = {
  premium: {
    id: 'premium',
    group: 'gasolina',
    get grade() {
      return t.fuelTypes.premium.grade;
    },
    get label() {
      return t.fuelTypes.premium.label;
    },
    get shortLabel() {
      return t.fuelTypes.premium.short;
    },
    unit: 'gal',
    unitLabel: 'gal',
    perUnitLabel: 'RD$/gal',
  },
  regular: {
    id: 'regular',
    group: 'gasolina',
    get grade() {
      return t.fuelTypes.regular.grade;
    },
    get label() {
      return t.fuelTypes.regular.label;
    },
    get shortLabel() {
      return t.fuelTypes.regular.short;
    },
    unit: 'gal',
    unitLabel: 'gal',
    perUnitLabel: 'RD$/gal',
  },
  gasoil_regular: {
    id: 'gasoil_regular',
    group: 'gasoil',
    get grade() {
      return t.fuelTypes.gasoil_regular.grade;
    },
    get label() {
      return t.fuelTypes.gasoil_regular.label;
    },
    get shortLabel() {
      return t.fuelTypes.gasoil_regular.short;
    },
    unit: 'gal',
    unitLabel: 'gal',
    perUnitLabel: 'RD$/gal',
  },
  gasoil_optimo: {
    id: 'gasoil_optimo',
    group: 'gasoil',
    get grade() {
      return t.fuelTypes.gasoil_optimo.grade;
    },
    get label() {
      return t.fuelTypes.gasoil_optimo.label;
    },
    get shortLabel() {
      return t.fuelTypes.gasoil_optimo.short;
    },
    unit: 'gal',
    unitLabel: 'gal',
    perUnitLabel: 'RD$/gal',
  },
  glp: {
    id: 'glp',
    group: 'glp',
    get grade() {
      return t.fuelTypes.glp.grade;
    },
    get label() {
      return t.fuelTypes.glp.label;
    },
    get shortLabel() {
      return t.fuelTypes.glp.short;
    },
    unit: 'gal',
    unitLabel: 'gal',
    perUnitLabel: 'RD$/gal',
  },
  gnv: {
    id: 'gnv',
    group: 'gnv',
    get grade() {
      return t.fuelTypes.gnv.grade;
    },
    get label() {
      return t.fuelTypes.gnv.label;
    },
    get shortLabel() {
      return t.fuelTypes.gnv.short;
    },
    unit: 'm3',
    unitLabel: 'm³',
    perUnitLabel: 'RD$/m³',
  },
};

export const FUEL_ORDER: FuelType[] = [
  'premium',
  'regular',
  'gasoil_regular',
  'gasoil_optimo',
  'glp',
  'gnv',
];

/** MICM week of 15–21 Aug 2026 — reference only, not a live feed. */
export const DEFAULT_REFERENCE_PRICES: ReferencePrices = {
  premium: 341.1,
  regular: 307.5,
  gasoil_regular: 259.8,
  gasoil_optimo: 293.1,
  glp: 135.2,
  gnv: 43.97,
};

export const DEFAULT_PRICE_WEEK = '15–21 ago 2026 (MICM)';

// Station brands: lib/domain/stations.ts (refdata/stations.json, IMP 30092026 note 7).

/** Read at the moment of use, so it follows the language (ADR-39). */
export const GROUP_LABEL: Record<FuelGroup, string> = new Proxy({} as Record<FuelGroup, string>, {
  get: (_target, key) => (t.fuelGroups as Record<string, string>)[key as string],
});

/** "km/gal", "km/L" or "km/m³" — the vehicle's volume unit decides (v6). */
export function economyLabel(type: FuelType, unit: VolumeUnit = 'gal', economy?: EconomyUnit | null): string {
  if (economy === 'l_100km' && type !== 'gnv') return economyUnitLabel(type, 'l_100km');
  return economyUnitLabel(type, unit === 'l' ? 'km_l' : 'km_gal');
}

/** "gal", "L" or "m³". */
export function unitLabelFor(type: FuelType, unit: VolumeUnit = 'gal'): string {
  return displayUnitLabel(type, unit);
}

/** "RD$/gal", "RD$/L" or "RD$/m³". */
export function perUnitLabelFor(type: FuelType, unit: VolumeUnit = 'gal'): string {
  return perUnitLabel(type, unit);
}
