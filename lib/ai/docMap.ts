/**
 * What the AI read from a vehicle document or an identity plate, turned into the values of the EXISTING forms
 * (IMP 03112026 SPEC-C §C1/§C2, ADR-67). Pure: no React, no database, no network. Same contract as `fuelMap` and
 * `formMap`: it only proposes values for fields that were actually read, with their confidence; the screens keep their own
 * validation and their normal Save, and nothing here saves anything.
 *
 *   · `documentPrefillFrom`   document → DocumentKind, title detail, dates, notes
 *   · `guardDocument`         the wrong-car guard (plate / VIN of the paper vs the active car)
 *   · `vehiclePrefillFrom`    matrícula / VIN plate → the new-vehicle form
 *   · `mergeVpic`             deterministic enrichment after reading: VPIC wins specs, the document wins plate and colour
 *   · `labelFactsFrom`        a door-jamb / cap / tyre label → Ficha facts
 */
import type { DocumentKind } from '../db/types';
import { checkVin, type VinDecoded } from '../domain/vpic';
import type { FuelType } from '../types';
import { conf, num, str, type ReadResult } from './read';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// ───────────────────────── identifiers ─────────────────────────

export const normPlate = (s: string | null | undefined): string => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const normVin = (s: string | null | undefined): string => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export type DocVehicleRef = { plate: string | null; vin: string | null; make: string | null; model: string | null; year: number | null };

export function vehicleRefFrom(r: ReadResult): DocVehicleRef {
  return { plate: str(r, 'plate'), vin: str(r, 'vin'), make: str(r, 'make'), model: str(r, 'model'), year: num(r, 'year') };
}

// ───────────────────────── document → form ─────────────────────────

/** What the server calls a document → what the app stores. A revisión técnica has no kind of its own: it is "otro". */
const KIND_BY_SERVER: Record<string, DocumentKind | null> = {
  matricula: 'matricula',
  seguro: 'seguro',
  marbete: 'marbete',
  licencia: 'licencia',
  garantia: 'garantia',
  revision: 'otro',
  other: null,
};

export type NoteLabels = {
  insurer: string;
  policy: string;
  coverage: string;
  premium: string;
  docNumber: string;
  center: string;
  result: string;
  item: string;
  issuer: string;
  untilKm: string;
  category: string;
};

export const NOTE_LABELS_ES: NoteLabels = {
  insurer: 'Aseguradora', policy: 'Póliza', coverage: 'Cobertura', premium: 'Prima', docNumber: 'Documento No.',
  center: 'Centro', result: 'Resultado', item: 'Garantía de', issuer: 'Emitida por', untilKm: 'Hasta (km)', category: 'Categoría',
};

export type DocumentPrefill = {
  kind: DocumentKind | null;
  /** The server's own classification (`revision` stays distinguishable from `otro`). */
  serverKind: string | null;
  isRevision: boolean;
  /** What goes after the kind's name in the title ("Seguro · Seguros Universal"); null when there is nothing to add. */
  titleDetail: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string;
  vehicle: DocVehicleRef;
};
export type DocumentMarks = Partial<Record<'kind' | 'title' | 'issued' | 'expires' | 'notes', number>>;

const serverKindOf = (r: ReadResult): string | null => {
  if (r.kind.startsWith('doc_')) return r.kind.slice(4);
  return str(r, 'doc_kind');
};

export function documentPrefillFrom(r: ReadResult, labels: NoteLabels = NOTE_LABELS_ES): { prefill: DocumentPrefill; marks: DocumentMarks } {
  const serverKind = serverKindOf(r);
  const kind = serverKind ? (KIND_BY_SERVER[serverKind] ?? null) : null;
  const marks: DocumentMarks = {};
  if (serverKind) marks.kind = r.kind === 'document' ? conf(r, 'doc_kind') : 1;

  const line = (label: string, key: string, fmt: (v: string | number) => string = String): [string, number] | null => {
    const v = (str(r, key) ?? num(r, key)) as string | number | null;
    return v == null ? null : [`${label}: ${fmt(v)}`, conf(r, key)];
  };
  const lines: ([string, number] | null)[] = [];
  let detail: [string, number] | null = null;

  switch (serverKind) {
    case 'seguro': {
      const insurer = str(r, 'insurer');
      if (insurer) detail = [insurer, conf(r, 'insurer')];
      lines.push(line(labels.insurer, 'insurer'), line(labels.policy, 'policy_number'), line(labels.coverage, 'coverage_type'), line(labels.premium, 'premium', (v) => `RD$ ${Number(v).toLocaleString('es-DO')}`));
      break;
    }
    case 'matricula':
    case 'marbete':
      lines.push(line(labels.docNumber, 'doc_number'));
      break;
    case 'licencia':
      lines.push(line(labels.category, 'license_category'));
      break;
    case 'revision': {
      const center = str(r, 'center');
      if (center) detail = [center, conf(r, 'center')];
      lines.push(line(labels.center, 'center'), line(labels.result, 'result'));
      break;
    }
    case 'garantia': {
      const item = str(r, 'item');
      if (item) detail = [item, conf(r, 'item')];
      lines.push(line(labels.item, 'item'), line(labels.issuer, 'issuer'), line(labels.untilKm, 'expiry_km', (v) => Number(v).toLocaleString('es-DO')));
      break;
    }
  }
  const used = lines.filter((l): l is [string, number] => l != null);
  const notes = used.map(([t]) => t).join('\n');
  if (used.length) marks.notes = Math.min(...used.map(([, c]) => c));
  if (detail) marks.title = detail[1];

  const issuedAt = str(r, 'issued_date');
  const expiresAt = str(r, 'expires_date');
  if (issuedAt) marks.issued = conf(r, 'issued_date');
  if (expiresAt) marks.expires = conf(r, 'expires_date');

  return {
    prefill: { kind, serverKind, isRevision: serverKind === 'revision', titleDetail: detail?.[0] ?? null, issuedAt, expiresAt, notes, vehicle: vehicleRefFrom(r) },
    marks,
  };
}

// ───────────────────────── wrong-car guard ─────────────────────────

export type GuardVehicle = { id: string; name: string; plate: string | null; vin: string | null };
export type GuardResult = {
  /** `match`: it is this car · `mismatch`: it is clearly another car · `unknown`: nothing to compare (say nothing). */
  status: 'match' | 'mismatch' | 'unknown';
  /** What the paper says, for the sentence "Esto parece ser de A123456". */
  docPlate: string | null;
  docVin: string | null;
  /** Another of the person's cars that the paper does match (offer to switch to it). */
  belongsTo: GuardVehicle | null;
};

function compare(doc: DocVehicleRef, v: Pick<GuardVehicle, 'plate' | 'vin'>): { equal: number; differ: number } {
  let equal = 0;
  let differ = 0;
  const dp = normPlate(doc.plate);
  const vp = normPlate(v.plate);
  if (dp && vp) {
    if (dp === vp) equal++;
    else differ++;
  }
  const dv = normVin(doc.vin);
  const vv = normVin(v.vin);
  if (dv && vv) {
    if (dv === vv) equal++;
    else differ++;
  }
  return { equal, differ };
}

/**
 * A plate or VIN that matches is "this car"; a mismatch is raised only when NOTHING matches and something differs (a VIN
 * misread by one character next to a right plate must not raise a false alarm). Nothing to compare = no alarm.
 */
export function guardDocument(doc: DocVehicleRef, active: GuardVehicle, all: GuardVehicle[]): GuardResult {
  const out = { docPlate: normPlate(doc.plate) || null, docVin: normVin(doc.vin) || null };
  const here = compare(doc, active);
  if (here.equal > 0) return { status: 'match', ...out, belongsTo: null };
  if (here.differ === 0) return { status: 'unknown', ...out, belongsTo: null };
  const other = all.find((v) => v.id !== active.id && compare(doc, v).equal > 0 && compare(doc, v).differ === 0) ?? null;
  return { status: 'mismatch', ...out, belongsTo: other };
}

// ───────────────────────── matrícula / VIN plate → new vehicle ─────────────────────────

export type VehiclePrefill = {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  plate?: string;
  /** A real 17-character VIN. */
  vin?: string;
  /** A short frame number ("AE85-5012345"): goes to the chassis number, not the VIN. */
  chassisNumber?: string;
  fuel?: FuelType;
  engineCc?: number;
  seats?: number;
};
export type VehicleMarks = Partial<Record<keyof VehiclePrefill, number>>;

export function fuelFromDoc(value: string | null | undefined): FuelType | null {
  switch ((value ?? '').toLowerCase()) {
    case 'gasolina': return 'regular';
    case 'diesel': return 'gasoil_regular';
    case 'glp': return 'glp';
    case 'gnv': return 'gnv';
    default: return null; // eléctrico / híbrido: no fuel to pick
  }
}

/** vPIC says "Gasoline", "Diesel", "Compressed Natural Gas (CNG)"… */
export function fuelFromVpic(value: string | null | undefined): FuelType | null {
  const s = (value ?? '').toLowerCase();
  if (!s) return null;
  if (s.includes('diesel')) return 'gasoil_regular';
  if (s.includes('liquefied petroleum') || s.includes('propane') || s.includes('lpg')) return 'glp';
  if (s.includes('natural gas') || s.includes('cng')) return 'gnv';
  if (s.includes('gasoline') || s.includes('flex')) return 'regular';
  return null;
}

export function vehiclePrefillFrom(r: ReadResult): { prefill: VehiclePrefill; marks: VehicleMarks } {
  const prefill: VehiclePrefill = {};
  const marks: VehicleMarks = {};
  const put = <K extends keyof VehiclePrefill>(k: K, v: VehiclePrefill[K] | null, c: number) => {
    if (v == null || v === '') return;
    prefill[k] = v;
    marks[k] = c;
  };
  put('make', str(r, 'make'), conf(r, 'make'));
  put('model', str(r, 'model'), conf(r, 'model'));
  put('year', num(r, 'year'), conf(r, 'year'));
  put('color', str(r, 'color'), conf(r, 'color'));
  put('plate', str(r, 'plate'), conf(r, 'plate'));
  put('engineCc', num(r, 'engine_cc'), conf(r, 'engine_cc'));
  put('seats', num(r, 'seats'), conf(r, 'seats'));
  const fuel = fuelFromDoc(str(r, 'fuel'));
  put('fuel', fuel, conf(r, 'fuel'));

  const raw = str(r, 'vin');
  if (raw) {
    const c = conf(r, 'vin');
    const check = checkVin(raw);
    if (check.ok) put('vin', check.vin, c);
    else if (check.reason === 'chars') put('vin', normVin(raw), Math.min(c, 0.3)); // 17 long but an impossible letter: show it unsure
    else put('chassisNumber', raw.toUpperCase(), c);
  }
  return { prefill, marks };
}

// ───────────────────────── VPIC enrichment ─────────────────────────

export type MergeConflict = { field: 'make' | 'model' | 'year'; document: string | number; vpic: string | number; chosen: 'vpic' };
export type MergeResult = {
  merged: VehiclePrefill & { cylinders?: number; transmission?: VinDecoded['transmission']; drivetrain?: VinDecoded['drivetrain']; engineModel?: string };
  /** Fields vPIC filled because the document did not say. */
  filled: string[];
  /** Fields where the document and vPIC disagree. vPIC wins (specs), and the person is told. */
  conflicts: MergeConflict[];
};

const titleCase = (s: string): string => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s-])([a-zà-ÿ])/g, (_m, a: string, b: string) => a + b.toUpperCase()) : s);

/**
 * Deterministic enrichment AFTER the read (SPEC-C §C2). vPIC wins the SPECS (make, model, year); the DOCUMENT wins what
 * is the paper's own (plate, colour, chassis number): vPIC never touches those. Only what vPIC actually answered is used.
 */
export function mergeVpic(doc: VehiclePrefill, vpic: VinDecoded | null): MergeResult {
  const merged: MergeResult['merged'] = { ...doc };
  const filled: string[] = [];
  const conflicts: MergeConflict[] = [];
  if (!vpic) return { merged, filled, conflicts };

  const text = (field: 'make' | 'model', v: string | null) => {
    if (!v) return;
    const next = titleCase(v);
    const cur = doc[field];
    if (!cur) {
      merged[field] = next;
      filled.push(field);
    } else if (fold(cur) !== fold(next)) {
      merged[field] = next;
      conflicts.push({ field, document: cur, vpic: next, chosen: 'vpic' });
    }
  };
  text('make', vpic.make);
  text('model', vpic.model);

  if (vpic.year != null) {
    if (doc.year == null) {
      merged.year = vpic.year;
      filled.push('year');
    } else if (doc.year !== vpic.year) {
      merged.year = vpic.year;
      conflicts.push({ field: 'year', document: doc.year, vpic: vpic.year, chosen: 'vpic' });
    }
  }
  if (vpic.displacementCc != null && doc.engineCc == null) {
    merged.engineCc = vpic.displacementCc;
    filled.push('engineCc');
  }
  if (vpic.cylinders != null) merged.cylinders = vpic.cylinders;
  if (vpic.transmission) merged.transmission = vpic.transmission;
  if (vpic.drivetrain) merged.drivetrain = vpic.drivetrain;
  if (vpic.engineModel) merged.engineModel = vpic.engineModel;
  const vf = fuelFromVpic(vpic.fuel);
  if (vf && !doc.fuel) {
    merged.fuel = vf;
    filled.push('fuel');
  }
  return { merged, filled, conflicts };
}

// ───────────────────────── door-jamb / cap / tyre label → Ficha ─────────────────────────

export type LabelFact = { label: string; value: string; group: 'motor' | 'gomas' | 'otros'; confidence: number };
export type LabelFactLabels = { oilSpec: string; oilViscosity: string; tireSize: string; tireDot: string; brand: string; partNumber: string };
export const LABEL_FACTS_ES: LabelFactLabels = { oilSpec: 'Especificación del aceite', oilViscosity: 'Viscosidad del aceite', tireSize: 'Medida de gomas', tireDot: 'DOT de las gomas', brand: 'Marca', partNumber: 'Parte No.' };

/** Viscosity as printed on an oil cap ("5W-30"); null for anything else. */
export function oilViscosityOf(spec: string | null): string | null {
  const m = spec?.toUpperCase().match(/\b(\d{1,2}W-?\d{2})\b/);
  return m ? m[1].replace(/^(\d{1,2}W)(\d{2})$/, '$1-$2') : null;
}

/** A tyre size as printed ("205/55R16 91V"); null for anything else. */
export function tireSizeOf(spec: string | null): string | null {
  const m = spec?.toUpperCase().match(/\b(\d{3}\/\d{2})\s?(?:Z?R|-)\s?(\d{2})\b(?:\s?(\d{2,3}[A-Z]))?/);
  return m ? `${m[1]}R${m[2]}${m[3] ? ` ${m[3]}` : ''}` : null;
}

export function labelFactsFrom(r: ReadResult, L: LabelFactLabels = LABEL_FACTS_ES): LabelFact[] {
  const category = str(r, 'category');
  const spec = str(r, 'spec');
  const out: LabelFact[] = [];
  if (category === 'oil' && spec) {
    const visc = oilViscosityOf(spec);
    if (visc) out.push({ label: L.oilViscosity, value: visc, group: 'motor', confidence: conf(r, 'spec') });
    out.push({ label: L.oilSpec, value: spec, group: 'motor', confidence: conf(r, 'spec') });
  } else if (category === 'tire' || tireSizeOf(spec)) {
    const size = tireSizeOf(spec);
    if (size) out.push({ label: L.tireSize, value: size, group: 'gomas', confidence: conf(r, 'spec') });
    const dot = str(r, 'dot');
    if (dot) out.push({ label: L.tireDot, value: dot, group: 'gomas', confidence: conf(r, 'dot') });
  } else {
    const pn = str(r, 'part_number');
    const brand = str(r, 'brand');
    if (brand) out.push({ label: L.brand, value: brand, group: 'otros', confidence: conf(r, 'brand') });
    if (pn) out.push({ label: L.partNumber, value: pn, group: 'otros', confidence: conf(r, 'part_number') });
  }
  return out;
}
