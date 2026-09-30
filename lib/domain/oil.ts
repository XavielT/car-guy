/**
 * The oil that went in (IMP 29092026 Phase 3, note 16): which service items
 * get the Aceite block, how its four columns read back as one line, and how
 * the Especificación chips round-trip through the single `oil_spec` text.
 *
 * Pure (ADR-04): the screens, Historial and the tests share it.
 */
import type { OilType, ServiceCategory } from '../db/types';
import { oil, type OilItem } from './refdata';
import { foldText } from './text';

/** The four `service_record_item` columns of schema v6 §1.5. */
export type OilFields = {
  oilViscosity: string | null;
  oilType: OilType | null;
  oilSpec: string | null;
  oilBrand: string | null;
};

export const EMPTY_OIL: OilFields = { oilViscosity: null, oilType: null, oilSpec: null, oilBrand: null };

export const OIL_TYPES: OilType[] = ['mineral', 'semisintetico', 'sintetico'];

/** Lower case: the type reads as an adjective after the grade ("5W-30 sintético"). */
export const OIL_TYPE_LABEL: Record<OilType, string> = {
  mineral: 'mineral',
  semisintetico: 'semisintético',
  sintetico: 'sintético',
};

/** Several specs live in one text column, joined the way they are printed on the bottle. */
export const SPEC_SEPARATOR = ' · ';

/**
 * An item gets the Aceite block when it is the engine-oil change, or any
 * fluid whose name says "aceite" (transmission, differential) — folded, so a
 * user-edited "ACEITE" or "Aceíte" still counts.
 */
export function isOilItem(type: { id: string; category?: ServiceCategory | string | null; name?: string | null } | null | undefined): boolean {
  if (!type) return false;
  if (type.id === 'aceite_motor') return true;
  return type.category === 'fluidos' && foldText(type.name).includes('aceite');
}

const clean = (s: string | null | undefined) => (s ?? '').trim();

/** True when none of the four columns holds anything. */
export function isOilEmpty(item: Partial<OilFields> | null | undefined): boolean {
  return !item || (!clean(item.oilViscosity) && !item.oilType && !clean(item.oilSpec) && !clean(item.oilBrand));
}

/**
 * "5W-30 sintético · Castrol Edge · API SP" — grade and type together, then
 * the brand, then the spec; any part may be missing. Null when all are.
 */
export function oilSummary(item: Partial<OilFields> | null | undefined): string | null {
  if (isOilEmpty(item)) return null;
  const head = [clean(item!.oilViscosity), item!.oilType ? OIL_TYPE_LABEL[item!.oilType] : '']
    .filter(Boolean)
    .join(' ');
  const out = [head, clean(item!.oilBrand), clean(item!.oilSpec)].filter(Boolean).join(SPEC_SEPARATOR);
  return out || null;
}

/** The chip labels, in the order the user tapped them, as the stored text; null for none. */
export function joinSpecs(labels: string[]): string | null {
  const parts = labels.map((l) => l.trim()).filter(Boolean);
  return parts.length ? [...new Set(parts)].join(SPEC_SEPARATOR) : null;
}

/** The stored text back into chip labels. Free text that is not a known spec survives as its own piece. */
export function splitSpecs(spec: string | null | undefined): string[] {
  return clean(spec)
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The spec chips to offer: the ones for the vehicle's fuel (and those for
 * both), plus anything already chosen so an edit never hides a saved spec.
 */
export function specsFor(fuel: 'gasolina' | 'diesel' | null, selected: string[] = []): OilItem[] {
  const all = oil('spec');
  return all.filter((s) => !fuel || !s.fuel || s.fuel === fuel || selected.includes(s.es));
}

/** Viscosity chips: the SAE grades without the "Otro" row (the block has its own free-text chip). */
export function oilGrades(): OilItem[] {
  return oil('grade').filter((g) => !g.id.startsWith('otro'));
}

/** Brand list for the SearchSheet, without the file's own "Otro" (the sheet adds "Otro…"). */
export function oilBrands(): OilItem[] {
  return oil('brand').filter((b) => !b.id.startsWith('otr'));
}

/** Two oil blocks hold the same thing — used to hide "Igual que la última vez" once applied. */
export function sameOil(a: Partial<OilFields> | null | undefined, b: Partial<OilFields> | null | undefined): boolean {
  return oilSummary(a) === oilSummary(b);
}

/** Only the four columns, nulls for blanks — what the save writes. */
export function normalizeOil(item: Partial<OilFields> | null | undefined): OilFields {
  return {
    oilViscosity: clean(item?.oilViscosity) || null,
    oilType: item?.oilType && OIL_TYPES.includes(item.oilType) ? item.oilType : null,
    oilSpec: clean(item?.oilSpec) || null,
    oilBrand: clean(item?.oilBrand) || null,
  };
}
