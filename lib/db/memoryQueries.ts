import { specsheets, vehicleFacts } from './repos';
import type { VehicleFact, VehicleFactGroup, VehicleSpecsheet } from './types';
import { carMemory, type MemoryBuyFields, type MemorySection, type VehicleFactRow } from '../domain/carMemory';

/**
 * "Lo que uso" (IMP 30092026 note 6): the reads and writes behind the Ficha's
 * memory tab. The specsheet's "what I buy" columns are edited here; the rest of
 * the specsheet stays the Ficha técnica's.
 */

/** The editable "what I buy" columns, in the sheet's order. */
export const BUY_FIELDS: (keyof MemoryBuyFields)[] = [
  'oilBrand',
  'oilProduct',
  'oilFilterBrand',
  'airFilterPn',
  'cabinFilterPn',
  'fuelFilterPn',
  'tireCurrentF',
  'tireCurrentR',
  'batteryBrand',
  'bulbLow',
  'bulbHigh',
  'wiperSizes',
  'whereBought',
];

export type MemoryData = { sheet: VehicleSpecsheet | null; facts: VehicleFact[]; sections: MemorySection[] };

export function factRows(facts: readonly VehicleFact[]): VehicleFactRow[] {
  return facts.map((f) => ({ id: f.id, vehicleId: f.vehicleId, label: f.label, value: f.value, groupName: f.groupName, sortOrder: f.sortOrder, deletedAt: f.deletedAt ?? null }));
}

export async function loadMemory(vehicleId: string): Promise<MemoryData> {
  const [sheet, facts] = await Promise.all([specsheets.getForVehicle(vehicleId), vehicleFacts.list(vehicleId)]);
  return { sheet, facts, sections: carMemory(sheet, factRows(facts)) };
}

/** Writes the "what I buy" columns; blanks become null (`where_bought` is NOT NULL, so ''). */
export async function saveBuyFields(vehicleId: string, values: Partial<Record<keyof MemoryBuyFields, string>>): Promise<void> {
  const patch: Partial<VehicleSpecsheet> = {};
  for (const k of BUY_FIELDS) {
    if (!(k in values)) continue;
    const v = values[k]?.trim() ?? '';
    (patch as Record<string, string | null>)[k] = k === 'whereBought' ? v : v || null;
  }
  await specsheets.upsertForVehicle(vehicleId, patch);
}

export async function saveFact(input: { id?: string; vehicleId: string; label: string; value: string; groupName: VehicleFactGroup; sortOrder?: number }): Promise<VehicleFact> {
  let sortOrder = input.sortOrder;
  if (sortOrder == null && !input.id) {
    const existing = await vehicleFacts.list(input.vehicleId);
    sortOrder = existing.reduce((m, f) => Math.max(m, f.sortOrder + 1), 0);
  }
  return vehicleFacts.upsert({
    ...(input.id ? { id: input.id } : {}),
    vehicleId: input.vehicleId,
    label: input.label.trim(),
    value: input.value.trim(),
    groupName: input.groupName,
    ...(sortOrder != null ? { sortOrder } : {}),
  });
}

export const deleteFact = (id: string) => vehicleFacts.softDelete(id);
