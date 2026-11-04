/**
 * Where a car's calibration lives and how the screens read it (SPEC-I §I2). Local settings, one JSON per car (`speed_calibration:<id>`):
 * the saved trips never change, only the DISPLAY. A tiny emitter lets the cluster follow a change made on the calibration screen at once.
 *
 * Deviation from SPEC-I, logged in PROGRESS: the spec asks for synced `vehicle.speed_factor` / `odo_factor` columns (a v14 migration and an
 * additive cloud SQL). That is not built yet; this is per device. The pure rules (lib/trips/calibration.ts) do not depend on where it is stored.
 */
import { useEffect, useState } from 'react';

import { settings } from '../db/repos';
import { DEFAULT_CALIBRATION, displayFactor, parseCalibration, type CarCalibration } from './calibration';

const key = (vehicleId: string) => `speed_calibration:${vehicleId}`;
const listeners = new Set<() => void>();

export async function loadCalibration(vehicleId: string): Promise<CarCalibration> {
  return parseCalibration(await settings.get<unknown>(key(vehicleId), null).catch(() => null));
}

export async function saveCalibration(vehicleId: string, next: CarCalibration): Promise<void> {
  await settings.set(key(vehicleId), parseCalibration(next));
  for (const l of listeners) l();
}

/** The car's calibration, re-read when it changes. */
export function useCalibration(vehicleId: string | null | undefined): CarCalibration {
  const [cal, setCal] = useState<CarCalibration>(DEFAULT_CALIBRATION);
  useEffect(() => {
    if (!vehicleId) return;
    let live = true;
    const read = () => void loadCalibration(vehicleId).then((c) => live && setCal(c));
    read();
    listeners.add(read);
    return () => {
      live = false;
      listeners.delete(read);
    };
  }, [vehicleId]);
  return vehicleId ? cal : DEFAULT_CALIBRATION;
}

/** The multiplier the cluster applies to the GPS speed: 1 unless the person chose "como mi tablero". */
export function useSpeedFactor(vehicleId: string | null | undefined): number {
  return displayFactor(useCalibration(vehicleId));
}
