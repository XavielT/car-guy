import type { FillUp } from '../types';
import type { RecapInput, RecapVehicle } from '../domain/recap';
import { attentionReminders } from './reminderQueries';
import { mods as modRepo, odometer as odometerRepo, serviceRecords, documents } from './repos';
import { spendRows } from './statsQueries';
import { trips as tripRepo } from './tripOps';
import { daysBetween, todayIso } from '../domain/dates';

/**
 * Everything `buildRecap` needs, read once (SPEC-J §J0). The fill-ups come from the store, already in the person's display units (the same
 * gallons Hoy and Cifras show); spend rows and odometer readings are the ones Cifras reads; trips are the FINAL ones (a discarded or
 * merged trip has no row to read). One round of reads per car, in parallel: a year of data is thousands of rows, not millions.
 */
export async function loadRecapInput(vehicles: RecapVehicle[], fillups: FillUp[]): Promise<RecapInput> {
  const per = await Promise.all(
    vehicles.map(async (v) => {
      const [spend, readings, trips, services, mods, docs, attention] = await Promise.all([
        spendRows(v.id),
        odometerRepo.list(v.id),
        tripRepo.listWhere({ vehicleId: v.id }).catch(() => []),
        serviceRecords.list(v.id),
        modRepo.listWhere({ vehicleId: v.id }).catch(() => []),
        documents.listWhere({ vehicleId: v.id }).catch(() => []),
        attentionReminders(v.id, 50).catch(() => []),
      ]);
      return { v, spend, readings, trips, services, mods, docs, attention };
    }),
  );
  const today = todayIso();
  return {
    vehicles,
    fillups: fillups.filter((f) => vehicles.some((v) => v.id === f.vehicleId)),
    spend: per.flatMap((p) => p.spend.map((s) => ({ ...s, vehicleId: p.v.id }))),
    readings: per.flatMap((p) => p.readings.map((r) => ({ occurredAt: r.occurredAt, valueKm: r.valueKm, vehicleId: p.v.id }))),
    trips: per.flatMap((p) =>
      p.trips
        .filter((t) => t.status === 'done')
        .map((t) => ({ vehicleId: p.v.id, startedAt: t.startedAt, distanceM: t.distanceM, durationS: t.durationS, movingS: t.movingS, maxKmh: t.maxKmh, avgMovingKmh: t.avgMovingKmh })),
    ),
    services: per.flatMap((p) => p.services.map((s) => ({ vehicleId: p.v.id, occurredAt: s.occurredAt, kind: s.kind }))),
    mods: per.flatMap((p) =>
      p.mods
        .filter((m) => m.installedAt)
        .map((m) => ({ vehicleId: p.v.id, installedAt: m.installedAt as string, costDop: m.costPartDop + m.costLaborDop + m.costShippingDop + m.costCustomsDop })),
    ),
    overdueNow: per.reduce((n, p) => n + p.attention.filter((a) => a.status.status === 'vencido').length, 0),
    docsExpiring: per.reduce((n, p) => n + p.docs.filter((d) => d.expiresAt && daysBetween(today, d.expiresAt) <= 60 && daysBetween(today, d.expiresAt) >= 0).length, 0),
  };
}
