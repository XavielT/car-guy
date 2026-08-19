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

export const FUEL_CATALOG: Record<FuelType, FuelMeta> = {
  premium: {
    id: 'premium',
    group: 'gasolina',
    grade: 'Premium',
    label: 'Gasolina Premium',
    shortLabel: 'Premium',
    unit: 'gal',
    unitLabel: 'gal',
    perUnitLabel: 'RD$/gal',
  },
  regular: {
    id: 'regular',
    group: 'gasolina',
    grade: 'Regular',
    label: 'Gasolina Regular',
    shortLabel: 'Regular',
    unit: 'gal',
    unitLabel: 'gal',
    perUnitLabel: 'RD$/gal',
  },
  gasoil_regular: {
    id: 'gasoil_regular',
    group: 'gasoil',
    grade: 'Regular',
    label: 'Gasoil Regular',
    shortLabel: 'Gasoil R.',
    unit: 'gal',
    unitLabel: 'gal',
    perUnitLabel: 'RD$/gal',
  },
  gasoil_optimo: {
    id: 'gasoil_optimo',
    group: 'gasoil',
    grade: 'Óptimo',
    label: 'Gasoil Óptimo',
    shortLabel: 'Óptimo',
    unit: 'gal',
    unitLabel: 'gal',
    perUnitLabel: 'RD$/gal',
  },
  glp: {
    id: 'glp',
    group: 'glp',
    grade: 'GLP',
    label: 'GLP',
    shortLabel: 'GLP',
    unit: 'gal',
    unitLabel: 'gal',
    perUnitLabel: 'RD$/gal',
  },
  gnv: {
    id: 'gnv',
    group: 'gnv',
    grade: 'GNV',
    label: 'Gas natural (GNV)',
    shortLabel: 'GNV',
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

export const STATIONS = [
  'Texaco',
  'Shell',
  'TotalEnergies',
  'Next',
  'Isla',
  'Esso',
  'Pueblo',
  'Otra',
] as const;

export const GROUP_LABEL: Record<FuelGroup, string> = {
  gasolina: 'Gasolina',
  gasoil: 'Gasoil',
  glp: 'GLP',
  gnv: 'Gas natural',
};

export function economyLabel(type: FuelType): string {
  return FUEL_CATALOG[type].unit === 'm3' ? 'km/m³' : 'km/gal';
}
