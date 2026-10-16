import type { VehicleDraft } from '@/components/VehicleForm';

import { fromLiters, tankForDisplay } from '../domain/units';
import { dateInputFromIso } from '../format';
import type { Vehicle } from './types';

/**
 * What the vehicle editor opens with: the stored vehicle, the current odometer and the gallery, turned back into
 * the form's draft. The inverse of `saveVehicleDraft` — one function so a test can prove that every field the form
 * writes is one the editor reads back (ADR-63, IMP 16102026 N5: the oil switch was the field this lost).
 */
export function draftFromVehicle(v: Vehicle, odometerKm: number | null, galleryIds: string[]): Partial<VehicleDraft> {
  return {
    id: v.id,
    name: v.name,
    type: v.type,
    make: v.make,
    model: v.model,
    year: v.year,
    color: v.color,
    plate: v.plate,
    vin: v.vin,
    defaultFuelType: v.defaultFuelType,
    tankVolume: tankForDisplay(v.tankVolume, v.tankVolumeEntered, v.volumeUnit, v.defaultFuelType),
    reserveVolume: v.reserveVolumeL == null ? null : Math.round(fromLiters(v.reserveVolumeL, v.volumeUnit) * 100) / 100,
    odometerKm,
    synthetic: v.oilSynthetic,
    purchaseDate: v.purchaseDate ? dateInputFromIso(v.purchaseDate) : null,
    purchasePrice: v.purchasePrice,
    photoMediaId: v.photoMediaId,
    notes: v.notes,
    nickname: v.nickname,
    status: v.status,
    chassisCode: v.chassisCode,
    chassisNumber: v.chassisNumber,
    engineCode: v.engineCode,
    transmission: v.transmission,
    drivetrain: v.drivetrain,
    origin: v.origin,
    importedYear: v.importedYear,
    story: v.story,
    // v6 (IMP 29092026 Phase 3)
    makeId: v.makeId,
    modelId: v.modelId,
    bodyType: v.bodyType,
    colorId: v.colorId,
    interiorColorId: v.interiorColorId,
    interiorMaterial: v.interiorMaterial,
    volumeUnit: v.volumeUnit,
    economyUnit: v.economyUnit,
    statusNote: v.statusNote,
    statusSince: v.statusSince ? dateInputFromIso(v.statusSince) : null,
    galleryIds,
    gaugeType: v.gaugeType,
    gaugeSegments: v.gaugeSegments,
    gaugeReserveAt: v.gaugeReserveAt,
  };
}
