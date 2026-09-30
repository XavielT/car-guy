/**
 * Reference data for the vehicle pickers (IMP 29092026 Phase 2, ADR-32):
 * makes and models, body types, colours, engine oil and other fluids.
 *
 * Pure TypeScript (ADR-04), bundled, read-only. Every JSON file is
 * `{source, license, items}` so the credit travels with the data
 * (docs/CREDITS.md). Ids are stable slugs: a vehicle row stores the id *and*
 * the text it showed, so editing a list never rewrites what a person saved,
 * and "Otro" stays free text.
 *
 * makes.json keeps each model as a compact tuple to stay under the 50 KB
 * budget: `[slug, name, from|null, to|null, aliases?]`, where `to: null`
 * means still built (or end unknown). `modelsFor` expands them; the public
 * model id is `${makeId}-${slug}` ("toyota-hilux").
 */
import { foldText } from '../text';
import bodyTypesFile from './bodyTypes.json';
import colorsFile from './colors.json';
import fluidsFile from './fluids.json';
import makesFile from './makes.json';
import oilFile from './oil.json';

export type RefFile<T> = { source: string; license: string; items: T[] };

type RawModel = [slug: string, name: string, from: number | null, to: number | null, aliases?: string[]];
type RawMake = { id: string; name: string; origin: string; top?: boolean; aliases?: string[]; models: RawModel[] };

export type CarModel = {
  /** `${makeId}-${slug}`, e.g. "toyota-hilux". */
  id: string;
  makeId: string;
  name: string;
  /** First model year, or null when unknown. */
  from: number | null;
  /** Last model year, or null when still built / unknown. */
  to: number | null;
  aliases: string[];
};

export type CarMake = {
  id: string;
  name: string;
  /** ISO country of the brand ("JP", "KR", …). */
  origin: string;
  /** Common in the DR: listed first. */
  top: boolean;
  aliases: string[];
};

/**
 * One make in a search result. `models` holds the models whose name or alias
 * matched the query ("trueno" → Toyota with [Sprinter Trueno]); it is empty
 * when only the make itself matched ("toyo" → Toyota, []).
 */
export type MakeMatch = { make: CarMake; models: CarModel[] };

export type BodyType = { id: string; es: string };
export type Color = {
  id: string;
  kind: 'exterior' | 'interior' | 'material' | 'finish';
  es: string;
  /** Swatch; null for "Otro", absent for materials and finishes. */
  hex?: string | null;
  /** Pale swatch that needs a border to show on a light background. */
  light?: boolean;
};
export type OilItem = {
  id: string;
  kind: 'grade' | 'type' | 'flag' | 'spec' | 'brand';
  es: string;
  /** Specs only: the fuel the spec is for; absent when it covers both. */
  fuel?: 'gasolina' | 'diesel';
};
export type FluidItem = {
  id: string;
  kind: 'atf' | 'cvt' | 'gear' | 'coolant' | 'coolant-mix' | 'brake' | 'steering';
  es: string;
  note?: string;
};

/** Shown next to the coolant picker: people choose by colour, which is not a standard. */
export const COOLANT_COLOR_NOTE = 'El color del refrigerante no es un estándar: guíate por la tecnología que pide el manual.';

/** Earliest year the year picker offers when a model's range is unknown. */
export const DEFAULT_FIRST_YEAR = 1980;

// The 2.1.1 search fold (lib/domain/text.ts).
const fold = foldText;

const rawMakes = (makesFile as RefFile<RawMake>).items;

const MAKES: CarMake[] = rawMakes.map((m) => ({
  id: m.id,
  name: m.name,
  origin: m.origin,
  top: m.top === true,
  aliases: m.aliases ?? [],
}));

const MODELS = new Map<string, CarModel[]>(
  rawMakes.map((m) => [
    m.id,
    m.models.map(([slug, name, from, to, aliases]) => ({ id: `${m.id}-${slug}`, makeId: m.id, name, from, to, aliases: aliases ?? [] })),
  ]),
);

const MODEL_BY_ID = new Map<string, CarModel>([...MODELS.values()].flat().map((m) => [m.id, m]));

/** Top makes first, then alphabetical — the order of an empty search. */
function byTopThenName(a: CarMake, b: CarMake): number {
  return Number(b.top) - Number(a.top) || a.name.localeCompare(b.name, 'es');
}

export function allMakes(): CarMake[] {
  return [...MAKES].sort(byTopThenName);
}

export function makeById(id: string): CarMake | undefined {
  return MAKES.find((m) => m.id === id);
}

export function modelById(id: string): CarModel | undefined {
  return MODEL_BY_ID.get(id);
}

/** A make's models in the file's order (roughly small to large); [] for an unknown make. */
export function modelsFor(makeId: string): CarModel[] {
  return MODELS.get(makeId) ?? [];
}

/**
 * Accent- and case-insensitive ("citroen" finds Citroën). Matches the make's
 * name and aliases ("vw", "chevy"), and each model's name and aliases, also
 * with the make in front ("toyota hilux", "mazda 3"). Makes whose own name
 * starts with the query come first, then top makes, then the rest by name.
 * An empty query returns every make with no models.
 */
export function searchMakes(q: string): MakeMatch[] {
  const wanted = fold(q.trim()).replace(/\s+/g, ' ');
  if (!wanted) return allMakes().map((make) => ({ make, models: [] }));

  const out: (MakeMatch & { rank: number })[] = [];
  for (const make of MAKES) {
    const makeNames = [make.name, ...make.aliases].map(fold);
    // "toyota hilux": the make, then a model query scoped to it.
    const scoped = makeNames.find((n) => wanted.startsWith(`${n} `));
    const modelQuery = scoped ? wanted.slice(scoped.length + 1) : wanted;
    const makeHit = scoped != null || makeNames.some((n) => n.includes(wanted));
    const models = modelsFor(make.id).filter((model) => [model.name, ...model.aliases].some((n) => fold(n).includes(modelQuery)));
    if (!makeHit && models.length === 0) continue;
    const rank = makeNames.some((n) => n.startsWith(wanted)) || scoped ? 0 : makeHit ? 1 : 2;
    out.push({ make, models, rank });
  }
  return out
    .sort((a, b) => a.rank - b.rank || byTopThenName(a.make, b.make))
    .map(({ make, models }) => ({ make, models }));
}

/**
 * Model years to offer, newest first. With a known model: its range, with
 * unknown ends filled by DEFAULT_FIRST_YEAR and next year (new models are sold
 * as next year's). Without one, or for an unknown id: the default range.
 */
export function yearsFor(modelId?: string, now: Date = new Date()): number[] {
  const last = now.getFullYear() + 1;
  const model = modelId ? modelById(modelId) : undefined;
  const from = model?.from ?? DEFAULT_FIRST_YEAR;
  const to = Math.min(model?.to ?? last, last);
  const years: number[] = [];
  for (let y = to; y >= from; y--) years.push(y);
  return years;
}

export const bodyTypes = (): BodyType[] => (bodyTypesFile as RefFile<BodyType>).items;

export function colors(kind: Color['kind'] = 'exterior'): Color[] {
  return (colorsFile as RefFile<Color>).items.filter((c) => c.kind === kind);
}

export function oil(kind: OilItem['kind']): OilItem[] {
  return (oilFile as RefFile<OilItem>).items.filter((o) => o.kind === kind);
}

export function fluids(kind: FluidItem['kind']): FluidItem[] {
  return (fluidsFile as RefFile<FluidItem>).items.filter((f) => f.kind === kind);
}

/** Every file's credit, for docs/CREDITS.md and Más → Acerca de. */
export const REFDATA_CREDITS: { file: string; source: string; license: string }[] = [
  ['makes.json', makesFile],
  ['bodyTypes.json', bodyTypesFile],
  ['colors.json', colorsFile],
  ['oil.json', oilFile],
  ['fluids.json', fluidsFile],
].map(([file, f]) => ({ file: file as string, source: (f as RefFile<unknown>).source, license: (f as RefFile<unknown>).license }));

// ------------------------------------------------ body type ↔ legacy type ---
//
// `vehicle.type` (carro, jeepeta, camioneta, motor, camion, guagua, otro)
// predates the body types and is read everywhere — check templates, icons,
// the service catalogue's applies_to. The form picks a body type and derives
// `type` from it, so nothing downstream changes (03-screens.md Phase 3 §3).

type LegacyType = 'carro' | 'jeepeta' | 'camioneta' | 'motor' | 'camion' | 'guagua' | 'otro';

const LEGACY: Record<string, LegacyType> = {
  sedan: 'carro',
  hatchback: 'carro',
  coupe: 'carro',
  convertible: 'carro',
  wagon: 'carro',
  suv: 'jeepeta',
  pickup: 'camioneta',
  minivan: 'guagua',
  van: 'guagua',
  truck: 'camion',
  motorcycle: 'motor',
  utv: 'otro',
  other: 'otro',
};

/** The legacy `type` a body type implies; unknown or null → 'carro'. */
export function legacyTypeFor(bodyType: string | null | undefined): LegacyType {
  return (bodyType && LEGACY[bodyType]) || 'carro';
}

/**
 * The body type to preselect for a car saved before v6, from its legacy type.
 * 'carro' says nothing about the body (sedán? hatchback?), so it stays null.
 */
export function bodyTypeFromLegacy(type: string | null | undefined): string | null {
  switch (type) {
    case 'jeepeta':
      return 'suv';
    case 'camioneta':
      return 'pickup';
    case 'motor':
      return 'motorcycle';
    case 'camion':
      return 'truck';
    case 'guagua':
      return 'minivan';
    case 'otro':
      return 'other';
    default:
      return null;
  }
}
