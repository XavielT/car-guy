import { getDb } from './client';
import {
  contacts as contactRepo,
  dtcEvents,
  fluidGuide,
  serviceRecords,
  specsheets,
  torqueSpecs,
  vehicles as vehicleRepo,
} from './repos';
import type { Contact, FluidGuideItem, ServiceRecord, TorqueSpec, Vehicle, VehicleDtcEvent, VehicleSpecsheet } from './types';
import { jsonObject } from '../domain/album';
import { applyPreset, FICHA_FIELDS, SPEC_PRESETS, type FichaValues } from '../domain/specPresets';
import type { VinDecoded } from '../domain/vpic';
import { normalizeCode } from '../domain/dtc';
import { id as newId } from '../format';

/**
 * The DIY block's reads and writes (IMP 28092026 Phase 5). The ficha's service
 * data lives in vehicle_specsheet's columns; `field_sources` says where each
 * value came from (preset / vpic / user) and `verified_fields` which ones the
 * owner has checked against the manual.
 */

/** "oil_capacity_l" → "oilCapacityL" (the repo's camelCase). */
const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export type Ficha = {
  sheet: VehicleSpecsheet | null;
  values: FichaValues;
  sources: Record<string, string>;
  verified: string[];
};

export async function readFicha(vehicleId: string): Promise<Ficha> {
  const sheet = await specsheets.getForVehicle(vehicleId);
  const values: FichaValues = {};
  for (const f of FICHA_FIELDS) {
    const v = sheet ? (sheet as unknown as Record<string, unknown>)[camel(f.key)] : null;
    values[f.key] = v == null || v === '' ? null : (v as string | number);
  }
  const sources = jsonObject(sheet?.fieldSources) as Record<string, string>;
  let verified: string[] = [];
  try {
    const v = JSON.parse(sheet?.verifiedFields || '[]') as unknown;
    if (Array.isArray(v)) verified = v.filter((x): x is string => typeof x === 'string');
  } catch {
    verified = [];
  }
  return { sheet, values, sources, verified };
}

function columnsPatch(values: FichaValues): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) if (FICHA_FIELDS.some((f) => f.key === k)) patch[camel(k)] = v ?? null;
  return patch;
}

/** The user typed a value (source TÚ); a changed value is no longer "verified". */
export async function setFichaValue(vehicleId: string, key: string, value: string | number | null): Promise<void> {
  const f = await readFicha(vehicleId);
  const sources = { ...f.sources };
  if (value == null || value === '') delete sources[key];
  else sources[key] = 'user';
  await specsheets.upsertForVehicle(vehicleId, {
    ...columnsPatch({ [key]: value }),
    fieldSources: JSON.stringify(sources),
    verifiedFields: JSON.stringify(f.verified.filter((k) => k !== key)),
  });
}

export async function setVerified(vehicleId: string, key: string, on: boolean): Promise<void> {
  const f = await readFicha(vehicleId);
  const next = on ? [...new Set([...f.verified, key])] : f.verified.filter((k) => k !== key);
  await specsheets.upsertForVehicle(vehicleId, { verifiedFields: JSON.stringify(next) });
}

/**
 * "Cargar preset": empty fields take the preset (source PRESET, unverified);
 * the build's stock ficha gets the engine code and displacement when it has
 * none. Returns how many fields were filled.
 */
export async function loadPreset(vehicleId: string, presetId: string): Promise<number> {
  const preset = SPEC_PRESETS.find((p) => p.id === presetId);
  if (!preset) return 0;
  const f = await readFicha(vehicleId);
  const out = applyPreset(preset, f.values, f.sources);
  const stock = jsonObject(f.sheet?.stock);
  for (const [k, v] of Object.entries(preset.stock ?? {})) if (stock[k] == null || stock[k] === '') stock[k] = v;
  await specsheets.upsertForVehicle(vehicleId, {
    ...columnsPatch(out.values),
    presetId: preset.id,
    fieldSources: JSON.stringify(out.sources),
    stock: JSON.stringify(stock),
  });
  return out.filled.length;
}

/**
 * vPIC's answer, applied to what is empty only: the vehicle's make, model,
 * year, gearbox and drive, and the stock displacement. Returns the Spanish
 * names of what was filled, for the confirmation line.
 */
export async function applyVin(vehicleId: string, d: VinDecoded): Promise<string[]> {
  const v = await vehicleRepo.getById(vehicleId);
  if (!v) return [];
  const filled: string[] = [];
  const patch: Partial<Vehicle> & { id: string } = { id: vehicleId };
  if (!v.make && d.make) (patch.make = d.make), filled.push('marca');
  if (!v.model && d.model) (patch.model = d.model), filled.push('modelo');
  if (!v.year && d.year) (patch.year = d.year), filled.push('año');
  if (!v.transmission && d.transmission) (patch.transmission = d.transmission), filled.push('caja');
  if (!v.drivetrain && d.drivetrain) (patch.drivetrain = d.drivetrain), filled.push('tracción');
  if (Object.keys(patch).length > 1) await vehicleRepo.upsertRaw(patch);

  const f = await readFicha(vehicleId);
  const stock = jsonObject(f.sheet?.stock);
  if (d.displacementCc && stock.displacement_cc == null) {
    stock.displacement_cc = d.displacementCc;
    filled.push('cilindrada');
    const sources = { ...f.sources, displacement_cc: 'vpic' };
    await specsheets.upsertForVehicle(vehicleId, { stock: JSON.stringify(stock), fieldSources: JSON.stringify(sources) });
  }
  return filled;
}

// --------------------------------------------------------------- torques ---

export async function listTorques(vehicleId: string): Promise<TorqueSpec[]> {
  return torqueSpecs.listWhere({ vehicleId }, { orderBy: 'item', direction: 'ASC' });
}

export async function saveTorque(input: Partial<TorqueSpec> & Pick<TorqueSpec, 'vehicleId' | 'item' | 'valueNm'>): Promise<TorqueSpec> {
  return torqueSpecs.upsert({ notes: '', deletedAt: null, ...input, id: input.id ?? newId() });
}

// ---------------------------------------------------------------- fluids ---

export async function listFluids(vehicleId: string): Promise<FluidGuideItem[]> {
  return fluidGuide.listWhere({ vehicleId }, { orderBy: 'sort_order', direction: 'ASC' });
}

/** One card per kind per vehicle: the id is derived, so a second save edits it. */
export async function saveFluid(vehicleId: string, kind: FluidGuideItem['kind'], patch: Partial<FluidGuideItem>): Promise<FluidGuideItem> {
  return fluidGuide.upsert({ how: '', notes: '', sortOrder: 0, deletedAt: null, ...patch, id: `fluid_${vehicleId}_${kind}`, vehicleId, kind });
}

// ------------------------------------------------------------------- OBD ---

export async function listDtcEvents(filter: { vehicleId?: string; code?: string } = {}): Promise<VehicleDtcEvent[]> {
  const where: Record<string, unknown> = {};
  if (filter.vehicleId) where.vehicleId = filter.vehicleId;
  if (filter.code) where.code = filter.code;
  return dtcEvents.listWhere(where, { orderBy: 'seen_at', direction: 'DESC' });
}

export async function logDtc(input: { vehicleId: string; code: string; seenAt: string; odometerKm: number | null; notes?: string }): Promise<VehicleDtcEvent | null> {
  const code = normalizeCode(input.code);
  if (!code) return null;
  return dtcEvents.upsert({ id: newId(), vehicleId: input.vehicleId, code, seenAt: input.seenAt, odometerKm: input.odometerKm, clearedAt: null, repairRecordId: null, notes: input.notes ?? '', deletedAt: null });
}

export async function setDtcResolved(eventId: string, resolved: boolean): Promise<void> {
  await dtcEvents.upsert({ id: eventId, clearedAt: resolved ? new Date().toISOString() : null });
}

/** Repairs of the event's vehicle, newest first — the "Vincular a reparación" picker. */
export async function repairsFor(vehicleId: string): Promise<ServiceRecord[]> {
  const all = await serviceRecords.listWhere({ vehicleId }, { orderBy: 'occurred_at', direction: 'DESC' });
  return all.filter((r) => r.kind === 'reparacion');
}

export async function linkDtcRepair(eventId: string, recordId: string | null): Promise<void> {
  await dtcEvents.upsert({ id: eventId, repairRecordId: recordId });
}

/**
 * A new reparación record for the code, linked both ways: the event points at
 * it, and its description names the code so the record reads on its own.
 * The user completes costs and shop in the service form.
 */
export async function createRepairForDtc(event: VehicleDtcEvent, description: string): Promise<ServiceRecord> {
  const record = await serviceRecords.upsert({
    id: newId(),
    vehicleId: event.vehicleId,
    kind: 'reparacion',
    occurredAt: event.seenAt,
    odometerKm: event.odometerKm,
    title: `Código ${event.code}`,
    description,
    costPartsDop: 0,
    costLaborDop: 0,
    totalDop: 0,
    shop: '',
    deletedAt: null,
  });
  await linkDtcRepair(event.id, record.id);
  return record;
}

// ------------------------------------------------------------- contacts ---

export async function listContacts(): Promise<Contact[]> {
  return contactRepo.listWhere({}, { orderBy: 'name', direction: 'ASC' });
}

export async function saveContact(input: Partial<Contact> & Pick<Contact, 'name' | 'kind'>): Promise<Contact> {
  return contactRepo.upsert({ notes: '', deletedAt: null, ...input, id: input.id ?? newId() });
}

export type ContactLink = { kind: 'servicio' | 'mod'; id: string; title: string; date: string | null; vehicleName: string };

/** Everything the contact did: services and mods pointing at it, newest first. */
export async function contactLinks(contactId: string): Promise<ContactLink[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ kind: 'servicio' | 'mod'; id: string; title: string; date: string | null; vehicle: string }>(
    `SELECT 'servicio' AS kind, s.id, s.title, s.occurred_at AS date, v.name AS vehicle
       FROM service_record s JOIN vehicle v ON v.id = s.vehicle_id
      WHERE s.contact_id = ? AND s.deleted_at IS NULL
     UNION ALL
     SELECT 'mod', m.id, m.name, m.installed_at, v.name
       FROM mod m JOIN vehicle v ON v.id = m.vehicle_id
      WHERE m.contact_id = ? AND m.deleted_at IS NULL
     ORDER BY 4 DESC`,
    [contactId, contactId],
  );
  return rows.map((r) => ({ kind: r.kind, id: r.id, title: r.title, date: r.date, vehicleName: r.vehicle }));
}
