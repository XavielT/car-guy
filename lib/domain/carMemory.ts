/**
 * "Mi carro, de memoria" (IMP 30092026 note 6, data model v8 §1.3). Pure and tested.
 *
 * What the car takes (the specsheet's grades, part numbers and sizes), what the
 * owner actually buys (the v8 "what I buy" columns) and anything else they want
 * to remember (`vehicle_fact`, free label/value) in one searchable list of
 * sections — the Ficha's "Lo que uso" tab. `suggestionsFor` feeds the service
 * form's "Igual que siempre" chip from the same rows.
 */
import type { VehicleSpecsheet } from '../db/types';
import { localeTag, t, type Dict } from '../i18n';
import type { OilFields } from './oil';
import { matchesQuery } from './text';

/** The v8 "what I buy" columns on `vehicle_specsheet`. */
export type MemoryBuyFields = {
  oilBrand: string | null;
  oilProduct: string | null;
  oilFilterBrand: string | null;
  airFilterPn: string | null;
  cabinFilterPn: string | null;
  fuelFilterPn: string | null;
  wiperSizes: string | null;
  bulbLow: string | null;
  bulbHigh: string | null;
  tireCurrentF: string | null;
  tireCurrentR: string | null;
  batteryBrand: string | null;
  whereBought: string;
};

/** Any specsheet row, with or without the v8 columns (every field optional: a car may have no specsheet yet). */
export type MemorySpecsheet = Partial<VehicleSpecsheet> & Partial<MemoryBuyFields>;

export type FactGroup = 'motor' | 'gomas' | 'electrico' | 'carroceria' | 'interior' | 'papeles' | 'otros';

export const FACT_GROUPS: FactGroup[] = ['motor', 'gomas', 'electrico', 'carroceria', 'interior', 'papeles', 'otros'];

export type VehicleFactRow = {
  id: string;
  vehicleId: string;
  label: string;
  value: string;
  groupName: FactGroup;
  sortOrder: number;
  deletedAt?: string | null;
};

export type SectionId = 'aceite' | FactGroup;

/** A section's title, in the current language. */
export function sectionTitle(id: SectionId): string {
  return t.carMemory.sections[id];
}

const SECTION_ORDER: SectionId[] = ['aceite', 'motor', 'gomas', 'electrico', 'carroceria', 'interior', 'papeles', 'otros'];

export type MemoryRow = {
  /** Specsheet column name, or `fact:<id>`. */
  key: string;
  label: string;
  value: string;
  /** 'ficha' = a specsheet column (edited in the Ficha), 'dato' = a vehicle_fact row. */
  source: 'ficha' | 'dato';
  factId?: string;
};

export type MemorySection = { id: SectionId; title: string; rows: MemoryRow[] };

type SheetKey = keyof MemoryBuyFields | keyof VehicleSpecsheet;

type FieldDef = { key: keyof Dict['carMemory']['fields']; section: SectionId; unit?: string };

/** Specsheet columns in display order. The "what I buy" fields come first in their section. */
const FIELDS: FieldDef[] = [
  { key: 'oilBrand', section: 'aceite' },
  { key: 'oilProduct', section: 'aceite' },
  { key: 'oilGrade', section: 'aceite' },
  { key: 'oilSpec', section: 'aceite' },
  { key: 'oilCapacityFilterL', section: 'aceite', unit: 'L' },
  { key: 'oilCapacityL', section: 'aceite', unit: 'L' },
  { key: 'oilFilterBrand', section: 'aceite' },
  { key: 'oilFilterPn', section: 'aceite' },
  { key: 'airFilterPn', section: 'aceite' },
  { key: 'cabinFilterPn', section: 'aceite' },
  { key: 'fuelFilterPn', section: 'aceite' },
  { key: 'sparkPlugPn', section: 'motor' },
  { key: 'plugGapMm', section: 'motor', unit: 'mm' },
  { key: 'coolantType', section: 'motor' },
  { key: 'coolantCapacityL', section: 'motor', unit: 'L' },
  { key: 'transOilSpec', section: 'motor' },
  { key: 'transOilL', section: 'motor', unit: 'L' },
  { key: 'diffOilSpec', section: 'motor' },
  { key: 'diffOilL', section: 'motor', unit: 'L' },
  { key: 'brakeFluid', section: 'motor' },
  { key: 'psFluid', section: 'motor' },
  { key: 'tireCurrentF', section: 'gomas' },
  { key: 'tireCurrentR', section: 'gomas' },
  { key: 'tireSizeOemF', section: 'gomas' },
  { key: 'tireSizeOemR', section: 'gomas' },
  { key: 'psiOemF', section: 'gomas', unit: 'psi' },
  { key: 'psiOemR', section: 'gomas', unit: 'psi' },
  { key: 'boltPattern', section: 'gomas' },
  { key: 'centerBoreMm', section: 'gomas', unit: 'mm' },
  { key: 'lugThread', section: 'gomas' },
  { key: 'lugTorqueNm', section: 'gomas', unit: 'N·m' },
  { key: 'batteryBrand', section: 'electrico' },
  { key: 'batterySpec', section: 'electrico' },
  { key: 'bulbLow', section: 'electrico' },
  { key: 'bulbHigh', section: 'electrico' },
  { key: 'wiperSizes', section: 'carroceria' },
  { key: 'whereBought', section: 'otros' },
];

const FIELD_BY_KEY = new Map<SheetKey, FieldDef>(FIELDS.map((f) => [f.key, f]));

/** The field's label, in the current language. */
function fieldLabel(def: FieldDef): string {
  return t.carMemory.fields[def.key];
}

function fieldValue(sheet: MemorySpecsheet | null | undefined, def: FieldDef): string | null {
  const raw = sheet?.[def.key as keyof MemorySpecsheet];
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? `${new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 2 }).format(raw)}${def.unit ? ` ${def.unit}` : ''}` : null;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return text ? text : null;
}

function fieldRow(sheet: MemorySpecsheet | null | undefined, key: SheetKey): MemoryRow | null {
  const def = FIELD_BY_KEY.get(key);
  if (!def) return null;
  const value = fieldValue(sheet, def);
  return value == null ? null : { key: def.key, label: fieldLabel(def), value, source: 'ficha' };
}

/**
 * The "Lo que uso" tab: specsheet fields with a value, then the car's facts
 * (tombstones out, by sort order then label) in their group. Empty sections are
 * left out; order Aceite y filtros · Motor · Gomas · Eléctrico · Carrocería ·
 * Interior · Papeles · Otros.
 */
export function carMemory(
  specsheet: MemorySpecsheet | null | undefined,
  facts: readonly VehicleFactRow[] = [],
): MemorySection[] {
  const rows = new Map<SectionId, MemoryRow[]>(SECTION_ORDER.map((id) => [id, []]));
  for (const def of FIELDS) {
    const r = fieldRow(specsheet, def.key);
    if (r) rows.get(def.section)!.push(r);
  }
  const live = facts
    .filter((f) => !f.deletedAt && f.label.trim() && f.value.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, localeTag()));
  for (const f of live) {
    const group: FactGroup = FACT_GROUPS.includes(f.groupName) ? f.groupName : 'otros';
    rows.get(group)!.push({ key: `fact:${f.id}`, label: f.label.trim(), value: f.value.trim(), source: 'dato', factId: f.id });
  }
  return SECTION_ORDER.filter((id) => rows.get(id)!.length > 0).map((id) => ({ id, title: sectionTitle(id), rows: rows.get(id)! }));
}

/**
 * The search box: accent- and case-insensitive, every word must appear in the
 * row's label, value or section title ("codigo radio" finds "Código de radio").
 * Sections with no match drop out; an empty query returns everything.
 */
export function searchMemory(sections: readonly MemorySection[], query: string): MemorySection[] {
  if (!query.trim()) return sections.slice();
  const out: MemorySection[] = [];
  for (const s of sections) {
    const rows = s.rows.filter((r) => matchesQuery(`${s.title} ${r.label} ${r.value}`, query));
    if (rows.length) out.push({ ...s, rows });
  }
  return out;
}

// ---------------------------------------------------------------------------
// "Igual que siempre"
// ---------------------------------------------------------------------------

export type MemorySuggestion = {
  /** Chip text: "Igual que siempre: Castrol Edge 5W-30 · Fram PH6607". */
  label: string;
  /** "Castrol Edge 5W-30 · Fram PH6607" — the part after the colon. */
  summary: string;
  rows: MemoryRow[];
  /** Only for the oil change: what the service form's oil block can fill. */
  oil?: Partial<OilFields>;
};

/** "Igual que siempre", in the current language. */
export function sameAsAlways(): string {
  return t.carMemory.sameAsAlways;
}

/** Service type id (lib/domain/catalog.ts SERVICE_TYPES) → the columns that say what it takes. */
const SUGGESTION_FIELDS: Record<string, SheetKey[]> = {
  aceite_motor: ['oilBrand', 'oilProduct', 'oilGrade', 'oilSpec', 'oilCapacityFilterL', 'oilFilterBrand', 'oilFilterPn'],
  filtro_aire: ['airFilterPn'],
  filtro_cabina: ['cabinFilterPn'],
  filtro_combustible: ['fuelFilterPn'],
  bujias: ['sparkPlugPn', 'plugGapMm'],
  refrigerante: ['coolantType', 'coolantCapacityL'],
  liquido_frenos: ['brakeFluid'],
  aceite_transmision: ['transOilSpec', 'transOilL'],
  aceite_diferencial: ['diffOilSpec', 'diffOilL'],
  liquido_direccion: ['psFluid'],
  bateria: ['batteryBrand', 'batterySpec'],
  cambio_gomas: ['tireCurrentF', 'tireCurrentR', 'tireSizeOemF', 'tireSizeOemR'],
  rotacion_gomas: ['psiOemF', 'psiOemR', 'lugTorqueNm'],
  balanceo: ['lugTorqueNm'],
  limpiavidrios: ['wiperSizes'],
};

/** Services that buy parts: where the owner buys them is worth showing too. */
const BOUGHT = new Set(['aceite_motor', 'filtro_aire', 'filtro_cabina', 'filtro_combustible', 'bujias', 'bateria', 'cambio_gomas', 'limpiavidrios']);

const words = (...xs: (string | null | undefined)[]) => xs.map((x) => x?.trim()).filter(Boolean).join(' ');

function clean(s: string | null | undefined): string | null {
  const v = s?.trim();
  return v ? v : null;
}

/**
 * What the service form offers as "Igual que siempre" for a service type, from
 * the car's memory. Null when the type has nothing to suggest or the car has
 * none of its fields. For the oil change the summary reads the way it is bought
 * ("Castrol Edge 5W-30 · Fram PH6607": brand + grade, then the filter) and
 * `oil` carries the fields lib/domain/oil.ts's OilFields block takes.
 */
export function suggestionsFor(
  serviceTypeId: string | null | undefined,
  specsheet: MemorySpecsheet | null | undefined,
): MemorySuggestion | null {
  const keys = serviceTypeId ? SUGGESTION_FIELDS[serviceTypeId] : undefined;
  if (!keys || !specsheet) return null;
  const rows = [...keys, ...(BOUGHT.has(serviceTypeId!) ? (['whereBought'] as SheetKey[]) : [])]
    .map((k) => fieldRow(specsheet, k))
    .filter((r): r is MemoryRow => r != null);
  if (rows.length === 0 || rows.every((r) => r.key === 'whereBought')) return null;

  let summary: string;
  let oil: Partial<OilFields> | undefined;
  if (serviceTypeId === 'aceite_motor') {
    const grade = clean(specsheet.oilGrade);
    const product = clean(specsheet.oilProduct);
    // Brand + grade is how it is asked for at the counter; the product line only when there is no grade.
    const oilPart = words(specsheet.oilBrand, grade ?? product);
    const filterPart = words(specsheet.oilFilterBrand, specsheet.oilFilterPn);
    summary = [oilPart, filterPart].filter(Boolean).join(' · ');
    oil = {};
    if (grade) oil.oilViscosity = grade;
    if (clean(specsheet.oilBrand)) oil.oilBrand = clean(specsheet.oilBrand);
    if (clean(specsheet.oilSpec)) oil.oilSpec = clean(specsheet.oilSpec);
  } else {
    // Front and rear alike ("205/55R16" twice) read once.
    summary = [...new Set(rows.filter((r) => r.key !== 'whereBought').map((r) => r.value))].join(' · ');
  }
  if (!summary) summary = rows.map((r) => r.value).join(' · ');
  return { label: t.carMemory.suggestion(summary), summary, rows, ...(oil ? { oil } : {}) };
}

/** The check runner's fluid kinds (lib/domain/fluids.ts) → the service type whose memory answers "what do I put in". */
const FLUID_SERVICE: Record<string, string> = {
  aceite: 'aceite_motor',
  coolant: 'refrigerante',
  frenos: 'liquido_frenos',
  direccion: 'liquido_direccion',
  atf: 'aceite_transmision',
  bateria: 'bateria',
  filtro_aire: 'filtro_aire',
};

/** "Igual que siempre" on a check item's fluid card (the washer has nothing to remember). */
export function suggestionForFluid(
  fluidKind: string | null | undefined,
  specsheet: MemorySpecsheet | null | undefined,
): MemorySuggestion | null {
  return fluidKind ? suggestionsFor(FLUID_SERVICE[fluidKind], specsheet) : null;
}
