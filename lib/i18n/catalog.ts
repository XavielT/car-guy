/**
 * The seeded catalogue in English (IMP 30092026 note 2, ADR-39, Part A step 4).
 *
 * The catalogue rows live in SQLite in Spanish — service types, check
 * templates and their items, mod categories, venues, the seeded reminders, the
 * fluids guide — and the rows are the user's to edit. So the English is not
 * written to the database: it is looked up at display time, and only for a row
 * that is still exactly what the seeder wrote. The comparison is against the
 * seed *definition* (lib/domain/catalog.ts, lib/domain/fluids.ts), not the
 * database, so a row the user renamed shows what they typed, in any language.
 *
 * - `catalogLabel(kind, row, field)` — a database row.
 * - `catalogText(kind, id, field, spanish)` — an in-code constant (ficha
 *   labels, build/track field labels, lamp names, badges…); no comparison,
 *   the constant *is* the seed.
 * - `refLabel(item)` / `refNote(item)` — refdata items with `es`/`en`.
 * - `dtcText(dtc)` — a DTC description: the bundled table keeps the original
 *   English (`descEn`), so English users read that.
 *
 * All of them read `currentLanguage()` at call time, like `t`.
 */
import {
  INSPECTION_TEMPLATES,
  LEGAL_REMINDERS,
  MOD_CATEGORIES,
  SERVICE_TYPES,
  VENUES,
} from '../domain/catalog';
import type { Dtc } from '../domain/dtc';
import { FLUID_KINDS } from '../domain/fluids';
import EN from './catalogTranslations.en.json';
import { currentLanguage } from './index';

type Fields = Record<string, string>;
type Table = Record<string, Fields>;

/** Kinds whose rows live in the database and can be edited by the user. */
export type CatalogRowKind = 'serviceType' | 'inspectionTemplate' | 'checkItem' | 'modCategory' | 'venue' | 'reminder' | 'fluid';

/** Kinds that are constants in code (catalogText). */
export type CatalogTextKind =
  | 'serviceType'
  | 'legalReminder'
  | 'inspectionTemplate'
  | 'modCategory'
  | 'venue'
  | 'fluid'
  | 'fichaField'
  | 'fichaSection'
  | 'fichaText'
  | 'specPreset'
  | 'specField'
  | 'specGroup'
  | 'sheetField'
  | 'sheetWord'
  | 'oilType'
  | 'lamp'
  | 'statusBadge'
  | 'dtc'
  | 'refdata';

/** Every English entry, by kind → seed id → field. */
export const CATALOG_EN = EN as unknown as Record<string, Table>;

// ------------------------------------------------------------ the seeds ---

let seeds: Record<CatalogRowKind, Table> | null = null;

/** The Spanish the seeder writes, by kind → seed id → field. Built on first use. */
export function seedSpanish(): Record<CatalogRowKind, Table> {
  if (seeds) return seeds;
  const serviceType: Table = {};
  const reminder: Table = {};
  for (const s of SERVICE_TYPES) {
    serviceType[s.id] = { name: s.name, ...(s.notes ? { notes: s.notes } : {}) };
    // seedVehicleDefaults: title = the service name, notes = its notes.
    reminder[s.id] = { title: s.name, notes: s.notes ?? '' };
  }
  for (const r of LEGAL_REMINDERS) reminder[`legal:${r.kind}`] = { title: r.title, notes: r.notes };

  const inspectionTemplate: Table = {};
  const checkItem: Table = {};
  for (const tpl of INSPECTION_TEMPLATES) {
    inspectionTemplate[tpl.id] = { name: tpl.name };
    tpl.items.forEach((item, i) => {
      checkItem[`${tpl.id}__${i}`] = { groupName: item.group, label: item.label, how: item.how, warning: item.warning };
    });
  }
  const modCategory: Table = Object.fromEntries(MOD_CATEGORIES.map((c) => [c.id, { name: c.name }]));
  const venue: Table = Object.fromEntries(VENUES.map((v) => [v.id, { name: v.name, city: v.city }]));
  const fluid: Table = Object.fromEntries(FLUID_KINDS.map((f) => [f.kind, { label: f.label, how: f.how }]));
  seeds = { serviceType, inspectionTemplate, checkItem, modCategory, venue, reminder, fluid };
  return seeds;
}

type Row = Record<string, unknown> & {
  id?: string | null;
  serviceTypeId?: string | null;
  legalKind?: string | null;
  kind?: string | null;
};

/**
 * The seed id a row stands for, or null. A vehicle's own copy of a template
 * (and its items) is `<seed>@<vehicleId>`; a seeded reminder is known by its
 * service type or its legal kind; a fluids-guide card by its kind.
 */
function seedKey(kind: CatalogRowKind, row: Row): string | null {
  switch (kind) {
    case 'inspectionTemplate':
    case 'checkItem':
      return row.id ? String(row.id).split('@')[0] : null;
    case 'reminder':
      return row.legalKind ? `legal:${row.legalKind}` : row.serviceTypeId ?? null;
    case 'fluid':
      return row.kind ?? null;
    default:
      return row.id ?? null;
  }
}

function english(kind: CatalogRowKind, key: string, field: string): string | undefined {
  if (kind === 'reminder') {
    if (key.startsWith('legal:')) return CATALOG_EN.legalReminder?.[key.slice(6)]?.[field];
    return CATALOG_EN.serviceType?.[key]?.[field === 'title' ? 'name' : field];
  }
  return CATALOG_EN[kind]?.[key]?.[field];
}

/**
 * A catalogue row's text for the screen: English when the app is in English
 * and the row is an untouched seed (its id is a seed id and `field` still
 * holds the seed's Spanish), otherwise the row's own value.
 */
export function catalogLabel(kind: CatalogRowKind, row: Row | null | undefined, field = 'name'): string {
  const raw = row?.[field];
  const value = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
  if (!row || currentLanguage() !== 'en') return value;
  const key = seedKey(kind, row);
  if (!key) return value;
  const seed = seedSpanish()[kind][key]?.[field];
  if (seed == null || seed !== value) return value;
  return english(kind, key, field) ?? value;
}

/** An in-code catalogue constant: English when there is one and the app is in English, else the Spanish given. */
export function catalogText(kind: CatalogTextKind, id: string, field: string, spanish: string): string {
  if (currentLanguage() !== 'en') return spanish;
  return CATALOG_EN[kind]?.[id]?.[field] ?? spanish;
}

// ------------------------------------------------------------- refdata ---

/** A refdata item's label (colours, body types, materials, oil, fluids). */
export function refLabel(item: { es: string; en?: string | null }): string {
  return currentLanguage() === 'en' && item.en ? item.en : item.es;
}

/** A refdata item's note (fluids), if any. */
export function refNote(item: { note?: string | null; noteEn?: string | null }): string | null {
  if (!item.note) return null;
  return currentLanguage() === 'en' && item.noteEn ? item.noteEn : item.note;
}

// ----------------------------------------------------------------- DTC ---

/**
 * A code's description. Spanish: the bundled glossary translation. English:
 * the original wording the table keeps verbatim (`descEn`); if a row ever
 * lacks it, the Spanish with a note saying so.
 */
export function dtcText(dtc: Pick<Dtc, 'descEs' | 'descEn'> | null | undefined): string | null {
  if (!dtc) return null;
  if (currentLanguage() !== 'en') return dtc.descEs;
  if (dtc.descEn) return dtc.descEn;
  return `${dtc.descEs}${catalogText('dtc', 'spanishOnly', 'label', '')}`;
}
