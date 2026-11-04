/**
 * Reads one car's local data and hands it to the pure engine (IMP 03112026 SPEC-E §E1/§E2). Offline-first: everything comes from
 * this device's SQLite and the store, never from the cloud, so the facts are right with no connection. The maths is in
 * lib/domain/predict.ts (pure) and lib/domain/predictInput.ts (the adapter); this file is only the reads.
 */
import type { FillUp, Vehicle as StoreVehicle } from '../types';
import { todayIsoDate } from '../format';
import { fuelCfgFor } from '../domain/partialEconomy';
import { buildFacts, factsHash, usageRate, type Fact, type LastService, type PredictInput, type SpendRow, type TireInput, type UsageRate } from '../domain/predict';
import { economyPointsOf, vehicleClassOf } from '../domain/predictInput';
import { GAL_L } from '../domain/units';
import { referencePricesNow } from './priceOps';
import { expenses as expenseRepo, odometer as odometerRepo, reminders as reminderRepo, serviceRecordItems, serviceRecords, tires as tireRepo } from './repos';

const LEGAL_EXPENSES = new Set(['marbete', 'seguro', 'impuesto', 'multa', 'licencia']);

/** Which catalogue items count for each wear item. */
const WEAR_ITEMS: Record<keyof LastService, string[]> = {
  rotacion: ['rotacion_gomas'],
  alineacion: ['alineacion'],
  frenos: ['pastillas_frenos', 'discos_frenos'],
  bateria: ['bateria'],
  correa: ['correa_tiempo', 'correa_accesorios'],
  refrigerante: ['refrigerante'],
};

const day = (iso: string) => iso.slice(0, 10);

export async function loadPredictInput(vehicle: StoreVehicle, fillups: FillUp[], today: string = todayIsoDate()): Promise<PredictInput> {
  const id = vehicle.id;
  const [readings, reminders, expenses, records, tires, refs] = await Promise.all([
    odometerRepo.list(id),
    reminderRepo.listWhere({ vehicleId: id }),
    expenseRepo.listWhere({ vehicleId: id }),
    serviceRecords.listWhere({ vehicleId: id }, { orderBy: 'occurred_at', direction: 'DESC' }),
    tireRepo.listWhere({ vehicleId: id }),
    referencePricesNow().catch(() => null),
  ]);

  // Items of the most recent records, to know when each wear item was last done.
  const recent = records.filter((r) => !r.deletedAt).slice(0, 80);
  const items = await Promise.all(recent.map((r) => serviceRecordItems.listWhere({ serviceRecordId: r.id }).then((rows) => rows.map((i) => ({ at: r.occurredAt, type: i.serviceTypeId })))));
  const lastService = {} as LastService;
  for (const key of Object.keys(WEAR_ITEMS) as (keyof LastService)[]) {
    const dates = items.flat().filter((i) => WEAR_ITEMS[key].includes(String(i.type))).map((i) => day(i.at)).sort();
    lastService[key] = dates.length ? dates[dates.length - 1] : null;
  }

  const spend: SpendRow[] = [
    ...fillups.filter((f) => f.vehicleId === id).map((f) => ({ at: day(f.occurredAt), amountDop: f.totalDop, category: 'combustible' as const })),
    ...expenses.filter((e) => !e.deletedAt).map((e) => ({ at: day(e.occurredAt), amountDop: e.amountDop, category: LEGAL_EXPENSES.has(String(e.category)) ? ('legal' as const) : ('otros' as const) })),
    ...records.filter((r) => !r.deletedAt).map((r) => ({ at: day(r.occurredAt), amountDop: r.totalDop, category: r.kind === 'reparacion' ? ('reparacion' as const) : ('mantenimiento' as const) })),
  ];

  const unitL = vehicle.detail?.volumeUnit === 'l' ? 1 : GAL_L;
  const mine = fillups.filter((f) => f.vehicleId === id);
  const prices = mine.map((f) => ({ at: day(f.occurredAt), pricePerGal: f.pricePerUnit > 0 ? (f.pricePerUnit * GAL_L) / unitL : null, fuelGroup: f.fuelType }));

  const tireInputs: TireInput[] = tires
    .filter((t) => !t.deletedAt && t.dotWeek != null && t.dotYear != null)
    .map((t) => ({ id: t.id, label: [t.brand, t.model].filter(Boolean).join(' ') || t.size || '—', dot: `${String(t.dotWeek).padStart(2, '0')}${String((t.dotYear as number) % 100).padStart(2, '0')}`, installedAt: null }));

  return {
    today,
    vehicle: { id, class: vehicleClassOf(vehicle.detail?.type) },
    readings: readings.map((r) => ({ at: day(r.occurredAt), km: r.valueKm })),
    reminders: reminders.filter((r) => !r.deletedAt).map((r) => ({ id: r.id, title: r.title, metric: r.metric as 'km' | 'date' | 'both', dueKm: r.dueKm, dueDate: r.dueDate ? day(r.dueDate) : null, isEnabled: Boolean(r.isEnabled) })),
    economy: economyPointsOf(mine, fuelCfgFor(vehicle.detail)),
    spend,
    prices,
    referencePrices: (refs?.referencePrices ?? {}) as Record<string, number>,
    tires: tireInputs,
    lastService,
  };
}

export type CarFacts = { facts: Fact[]; hash: string; rate: UsageRate };

/** The facts of one car right now, with the key that says whether anything changed since the last time. */
export async function loadFacts(vehicle: StoreVehicle, fillups: FillUp[], today?: string): Promise<CarFacts> {
  const input = await loadPredictInput(vehicle, fillups, today);
  const facts = buildFacts(input);
  return { facts, hash: factsHash(facts), rate: usageRate(input.readings, input.today) };
}
