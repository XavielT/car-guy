/**
 * The build log's rules (IMP 28092026, 01-data-model-v2.md §2.2, ADR-19).
 *
 * `SPEC_FIELDS` is the contract for `spec_effects`, `vehicle_specsheet.stock`
 * and `.overrides`: every key any of them may hold, defined once here and
 * validated on save (`cleanSpecs`). The "actual" ficha is **derived** — stock,
 * then the effects of installed mods in install order, then the user's
 * overrides — never stored.
 */
import type { Mod, WishlistItem } from '../db/types';
import { jsonObject } from './album';

export type SpecGroup = 'motor' | 'chasis' | 'ruedas' | 'dimensiones';
export type SpecField = { key: string; label: string; group: SpecGroup; kind: 'text' | 'number'; unit?: string; headline?: string };

export const SPEC_FIELDS: SpecField[] = [
  { key: 'engine_code', label: 'Motor', group: 'motor', kind: 'text', headline: 'Motor' },
  { key: 'displacement_cc', label: 'Cilindrada', group: 'motor', kind: 'number', unit: 'cc' },
  { key: 'hp', label: 'Potencia', group: 'motor', kind: 'number', unit: 'hp', headline: 'HP' },
  { key: 'torque_nm', label: 'Torque', group: 'motor', kind: 'number', unit: 'Nm' },
  { key: 'induction', label: 'Aspiración', group: 'motor', kind: 'text' },
  { key: 'ecu', label: 'ECU', group: 'motor', kind: 'text', headline: 'ECU' },
  { key: 'exhaust', label: 'Escape', group: 'motor', kind: 'text' },
  { key: 'transmission', label: 'Caja', group: 'chasis', kind: 'text' },
  { key: 'differential', label: 'Diferencial', group: 'chasis', kind: 'text' },
  { key: 'suspension', label: 'Suspensión', group: 'chasis', kind: 'text' },
  { key: 'brakes_f', label: 'Frenos delante', group: 'chasis', kind: 'text' },
  { key: 'brakes_r', label: 'Frenos detrás', group: 'chasis', kind: 'text' },
  { key: 'wheel_f', label: 'Aros delante', group: 'ruedas', kind: 'text', headline: 'Aros' },
  { key: 'wheel_r', label: 'Aros detrás', group: 'ruedas', kind: 'text' },
  { key: 'tire_f', label: 'Gomas delante', group: 'ruedas', kind: 'text' },
  { key: 'tire_r', label: 'Gomas detrás', group: 'ruedas', kind: 'text' },
  { key: 'weight_kg', label: 'Peso', group: 'dimensiones', kind: 'number', unit: 'kg' },
  { key: 'ride_height', label: 'Altura', group: 'dimensiones', kind: 'text' },
];

export const SPEC_KEYS = new Set(SPEC_FIELDS.map((f) => f.key));
export const HEADLINE_FIELDS = SPEC_FIELDS.filter((f) => f.headline);
export const SPEC_GROUPS: { key: SpecGroup; label: string }[] = [
  { key: 'motor', label: 'Motor' },
  { key: 'chasis', label: 'Chasis' },
  { key: 'ruedas', label: 'Ruedas' },
  { key: 'dimensiones', label: 'Dimensiones' },
];

export type SpecValue = string | number;
export type Specs = Record<string, SpecValue>;

/**
 * Keeps only contract keys with a real value: numbers for number fields
 * (a "160" typed as text becomes 160; "~160 est." stays text-free and is
 * dropped for a number field), trimmed strings for text. Unknown keys are the
 * bug this exists to stop — a typo'd key would silently never show.
 */
export function cleanSpecs(raw: Record<string, unknown>): { specs: Specs; dropped: string[] } {
  const specs: Specs = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(raw ?? {})) {
    const field = SPEC_FIELDS.find((f) => f.key === key);
    if (!field) {
      dropped.push(key);
      continue;
    }
    if (value == null || value === '') continue;
    if (field.kind === 'number') {
      const digits = typeof value === 'number' ? String(value) : String(value).replace(/[^\d.-]/g, '');
      const n = Number(digits);
      // "mucho" strips to "" and Number("") is 0 — a number needs a digit.
      if (/\d/.test(digits) && Number.isFinite(n)) specs[key] = n;
      else dropped.push(key);
    } else {
      const s = String(value).trim();
      if (s) specs[key] = s;
    }
  }
  return { specs, dropped };
}

export type SpecSource = { kind: 'stock' } | { kind: 'mod'; modId: string; modName: string } | { kind: 'override' };
export type CurrentSpec = { value: SpecValue | null; stock: SpecValue | null; source: SpecSource | null };

type ModForSpecs = Pick<Mod, 'id' | 'name' | 'status' | 'installedAt' | 'specEffects' | 'affectsSpecs'>;

/** A mod counts toward the car's actual ficha while it is on the car. */
export function isOnCar(status: string): boolean {
  return status === 'instalado';
}

/**
 * The ficha as the car is today: per field, the value and where it came from.
 * Installed mods apply in `installed_at` order (a later swap beats an earlier
 * one); an override beats everything. A mod without a date applies first.
 */
export function currentSpecs(stockRaw: Record<string, unknown>, mods: ModForSpecs[], overridesRaw: Record<string, unknown> = {}): Record<string, CurrentSpec> {
  const stock = cleanSpecs(stockRaw).specs;
  const overrides = cleanSpecs(overridesRaw).specs;
  const out: Record<string, CurrentSpec> = {};
  for (const [k, v] of Object.entries(stock)) out[k] = { value: v, stock: v, source: { kind: 'stock' } };

  const onCar = mods
    .filter((m) => isOnCar(m.status) && m.affectsSpecs !== false)
    .sort((a, b) => (a.installedAt ?? '').localeCompare(b.installedAt ?? ''));
  for (const m of onCar) {
    const effects = cleanSpecs(jsonObject(m.specEffects)).specs;
    for (const [k, v] of Object.entries(effects)) {
      out[k] = { value: v, stock: out[k]?.stock ?? null, source: { kind: 'mod', modId: m.id, modName: m.name } };
    }
  }
  for (const [k, v] of Object.entries(overrides)) {
    out[k] = { value: v, stock: out[k]?.stock ?? null, source: { kind: 'override' } };
  }
  return out;
}

/** Specs as plain values (for a snapshot). */
export function specValues(current: Record<string, CurrentSpec>): Specs {
  const out: Specs = {};
  for (const [k, c] of Object.entries(current)) if (c.value != null) out[k] = c.value;
  return out;
}

/** "160 hp", "4A-GE 20V", "—". */
export function formatSpec(key: string, value: SpecValue | null | undefined): string {
  if (value == null || value === '') return '—';
  const field = SPEC_FIELDS.find((f) => f.key === key);
  if (field?.kind === 'number' && typeof value === 'number') {
    return `${Math.round(value).toLocaleString('en-US')}${field.unit ? ` ${field.unit}` : ''}`;
  }
  return String(value);
}

// ---------------------------------------------------------------- money ---

type ModCosts = Pick<Mod, 'costPartDop' | 'costLaborDop' | 'costShippingDop' | 'costCustomsDop'>;

/** What the mod cost, in RD$: parts + labour + shipping + customs. The foreign price is only an entry helper. */
export function modTotalDop(m: ModCosts): number {
  return (m.costPartDop || 0) + (m.costLaborDop || 0) + (m.costShippingDop || 0) + (m.costCustomsDop || 0);
}

/** Counted as money put into the car: installed or removed — not planned, not ordered. */
export function countsAsInvested(status: string): boolean {
  return status === 'instalado' || status === 'quitado' || status === 'vendido' || status === 'danado';
}

type ModMoney = ModCosts & Pick<Mod, 'status' | 'categoryId' | 'soldPriceDop' | 'serviceRecordId'>;

/**
 * Invested per category and in total. A mod migrated from a v2.0 "mejora"
 * record is counted here like any other; the stats layer is the one that
 * must not count it twice (its record already carries the cost).
 */
export function investedByCategory(mods: ModMoney[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of mods) {
    if (!countsAsInvested(m.status)) continue;
    out[m.categoryId] = (out[m.categoryId] ?? 0) + modTotalDop(m);
  }
  return out;
}

export function investedTotal(mods: ModMoney[]): number {
  return mods.filter((m) => countsAsInvested(m.status)).reduce((t, m) => t + modTotalDop(m), 0);
}

/** Invested minus what came back from selling parts off. */
export function netInvested(mods: ModMoney[]): number {
  return investedTotal(mods) - mods.reduce((t, m) => t + (m.status === 'vendido' ? m.soldPriceDop ?? 0 : 0), 0);
}

/** "USD 210 × 59.8 = RD$ 12 558" — the FX helper's arithmetic. */
export function foreignToDop(amount: number | null | undefined, rate: number | null | undefined): number | null {
  if (amount == null || rate == null || !Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(amount * rate * 100) / 100;
}

/** A wishlist item's estimated landed cost: foreign price at the rate + shipping + customs. */
export function wishlistTotalDop(
  w: Pick<WishlistItem, 'estPriceForeign' | 'estShippingDop' | 'estCustomsDop' | 'estTotalDop'> & { currency?: string | null },
  rate: number | null,
): number | null {
  const goods = w.currency && w.currency !== 'DOP' ? foreignToDop(w.estPriceForeign, rate) : w.estPriceForeign ?? null;
  if (goods == null && w.estShippingDop == null && w.estCustomsDop == null) return w.estTotalDop ?? null;
  return (goods ?? 0) + (w.estShippingDop ?? 0) + (w.estCustomsDop ?? 0);
}

/**
 * "Convertir a mod": what the mod form starts with. Name, brand, part number,
 * category, vendor and link come across; the status is instalado; the costs
 * start from the estimate so the user corrects rather than retypes.
 */
export function wishlistToModDraft(w: WishlistItem, rate: number | null): Partial<Mod> & { fromWishlistId: string } {
  const goods = w.currency && w.currency !== 'DOP' ? foreignToDop(w.estPriceForeign, rate) : w.estPriceForeign;
  return {
    fromWishlistId: w.id,
    vehicleId: w.vehicleId,
    categoryId: w.categoryId ?? 'otro',
    name: w.name,
    brand: w.brand,
    partNumber: w.partNumber,
    vendor: w.vendor,
    vendorUrl: w.url,
    status: 'instalado',
    priceForeign: w.currency && w.currency !== 'DOP' ? w.estPriceForeign : null,
    currency: w.currency && w.currency !== 'DOP' ? w.currency : null,
    fxRateToDop: w.currency && w.currency !== 'DOP' ? rate : null,
    costPartDop: goods ?? 0,
    costShippingDop: w.estShippingDop ?? 0,
    costCustomsDop: w.estCustomsDop ?? 0,
  };
}

// ----------------------------------------------------------------- tags ---

/** The badges a mod can wear (from its free tags), one colour family each. */
const TAG_BADGES: Record<string, { label: string; tone: 'red' | 'amber' | 'green' | 'outline' }> = {
  swap: { label: 'SWAP', tone: 'red' },
  tune: { label: 'TUNE', tone: 'amber' },
  tuneado: { label: 'TUNE', tone: 'amber' },
  drift: { label: 'DRIFT', tone: 'amber' },
  track: { label: 'TRACK', tone: 'amber' },
  turbo: { label: 'TURBO', tone: 'red' },
  oem: { label: 'OEM+', tone: 'outline' },
  'oem+': { label: 'OEM+', tone: 'outline' },
  jdm: { label: 'JDM', tone: 'outline' },
  diy: { label: 'DIY', tone: 'green' },
};

export function parseTags(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function modBadge(tags: string[]): { label: string; tone: 'red' | 'amber' | 'green' | 'outline' } | null {
  for (const t of tags) {
    const b = TAG_BADGES[t.toLowerCase()];
    if (b) return b;
  }
  return null;
}

/**
 * Which service reminder a mod in this category resets, if any: new gomas
 * reset the tire-change reminder, new pads the brake one.
 */
export const CATEGORY_SERVICE: Record<string, string> = {
  gomas: 'cambio_gomas',
  frenos: 'pastillas_frenos',
  enfriamiento: 'refrigerante',
};
