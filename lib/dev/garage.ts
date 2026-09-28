import { enqueue } from '@/lib/db/client';
import {
  expenses as expenseRepo,
  fuel as fuelRepo,
  odometer as odometerRepo,
  serviceRecords as serviceRepo,
  tasks as taskRepo,
  vehicles as vehicleRepo,
} from '@/lib/db/repos';
import { seedVehicleDefaults } from '@/lib/db/seed';
import type { ExpenseCategory, Task, Vehicle } from '@/lib/db/types';
import { id as newId } from '@/lib/format';

/**
 * Xaviel's real garage, for the dev seed (app/dev/seed.tsx) and the backup
 * fixture PROMPT-01's migration test imports.
 *
 * Real names, engines and stories; **never** real identifiers — no plate, no
 * VIN. Dates that are only known to the year are written as 1 January and say
 * so. Nothing here is a product path: it is reachable from `__DEV__` only.
 */
export const GARAGE_IDS = {
  ae85: 'dev_ae85',
  ds3: 'dev_ds3',
  c3: 'dev_c3',
  jetta: 'dev_jetta',
} as const;

type SeedVehicle = Partial<Vehicle> & { id: string; name: string };

/** Schema v1 columns only. */
const VEHICLES: SeedVehicle[] = [
  {
    id: GARAGE_IDS.ae85,
    name: 'Trueno AE85',
    type: 'carro',
    make: 'Toyota',
    model: 'Sprinter Trueno',
    year: 1985,
    defaultFuelType: 'premium',
    initialOdometerKm: 47_000,
    notes: '',
    sortOrder: 0,
  },
  {
    id: GARAGE_IDS.ds3,
    name: 'DS3',
    type: 'carro',
    make: 'Citroën',
    model: 'DS3',
    year: 2015,
    trim: '1.6 automático',
    defaultFuelType: 'regular',
    initialOdometerKm: 96_000,
    purchasePrice: 875_000,
    notes: '',
    sortOrder: 1,
  },
  {
    id: GARAGE_IDS.c3,
    name: 'C3',
    type: 'carro',
    make: 'Citroën',
    model: 'C3',
    year: 2003,
    trim: '1.6 hatchback manual',
    defaultFuelType: 'regular',
    initialOdometerKm: null,
    notes: 'Interior de tela beige.',
    sortOrder: 2,
  },
  {
    id: GARAGE_IDS.jetta,
    name: 'Jetta',
    type: 'carro',
    make: 'Volkswagen',
    model: 'Jetta',
    year: 2003,
    trim: '1.8T automático',
    defaultFuelType: 'premium',
    initialOdometerKm: null,
    // Year precision only: bought in 2018, sold in 2021.
    purchaseDate: '2018-01-01',
    soldDate: '2021-01-01',
    isArchived: true,
    notes: '',
    sortOrder: 3,
  },
];

// TODO(v2): nickname/status/story/ownership — PROMPT-01 writes these once
// migration v2 adds the columns (01-data-model-v2.md). Until then they live
// here and nowhere else.
export const GARAGE_V2 = {
  [GARAGE_IDS.ae85]: {
    nickname: 'hachi-gō', // ハチゴー
    status: 'activo',
    chassisCode: 'AE85',
    engineCode: '4A-GE 20V (swap)',
    transmission: 'manual',
    drivetrain: 'rwd',
    origin: 'jdm',
    story:
      'Preparado para drift y ceritos. Aros, radiador y abanicos racing, ECU tuneada con pops and bangs. ' +
      'No sé cuántos caballos, pero el motor es alegre, gira rápido y alto.',
  },
  [GARAGE_IDS.ds3]: {
    nickname: 'el daily',
    status: 'activo',
    engineCode: '1.6 NA',
    transmission: 'automatica',
    drivetrain: 'fwd',
    origin: 'eudm',
    story: '',
  },
  [GARAGE_IDS.c3]: {
    status: 'proyecto',
    engineCode: '1.6 NA',
    transmission: 'manual',
    drivetrain: 'fwd',
    story: 'Chocado hace unos meses; en restauración. Cuando esté funcional, se modifica.',
    milestones: [{ kind: 'accidente', title: 'Choque', daysAgo: 120 }],
  },
  [GARAGE_IDS.jetta]: {
    status: 'vendido',
    engineCode: '1.8T',
    transmission: 'automatica',
    drivetrain: 'fwd',
    ownership: { from: '2018', to: '2021' },
    story: 'Mi primer carro. No encontré fotos de él cuando cambié de teléfono — por eso existe el álbum.',
  },
} as const;

const C3_TASKS: Pick<Task, 'title' | 'kind' | 'priority'>[] = [
  { title: 'Chapa', kind: 'reparacion', priority: 'critica' },
  { title: 'Pintura', kind: 'reparacion', priority: 'normal' },
  { title: 'Alineación', kind: 'mantenimiento', priority: 'normal' },
  { title: 'Revisión de suspensión', kind: 'reparacion', priority: 'critica' },
];

/**
 * Writes the four vehicles and their history through the real repositories.
 *
 * Idempotent by the fixed vehicle ids: a second run finds the AE85 and stops,
 * rather than doubling every fill-up. Returns the log lines the screen shows.
 */
export async function seedRealGarage(today = new Date()): Promise<string[]> {
  const lines: string[] = [];
  if (await vehicleRepo.getById(GARAGE_IDS.ae85)) {
    return ['El garaje ya está sembrado (AE85 existe). No se tocó nada.'];
  }

  const at = (daysAgo: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, 12, 0, 0).toISOString();

  // Same order as saveVehicleDraft: the vehicle without seeding, then its
  // first reading, then the defaults — which read the odometer for due_km.
  for (const vehicle of VEHICLES) {
    await enqueue(async (db) => {
      await vehicleRepo.upsertRaw(
        vehicle.id === GARAGE_IDS.ds3 ? { ...vehicle, purchaseDate: at(730) } : vehicle,
        db,
      );
      if (vehicle.initialOdometerKm != null) {
        await odometerRepo.upsert(
          {
            id: `odo_init_${vehicle.id}`,
            vehicleId: vehicle.id,
            occurredAt: at(400),
            valueKm: vehicle.initialOdometerKm,
            source: 'manual',
            sourceId: vehicle.id,
            deletedAt: null,
          },
          db,
        );
      }
    });
    // A sold car gets no reminders: nothing about the Jetta is due any more.
    if (!vehicle.soldDate) await seedVehicleDefaults(vehicle.id);
  }
  lines.push('4 vehículos: Trueno AE85, DS3, C3 (proyecto), Jetta (vendido, archivado)');

  // AE85: fewer, pricier fill-ups — premium, ~675 km apart, ending near 52,400.
  let odometer = 47_000;
  for (let i = 7; i >= 0; i--) {
    odometer += 675;
    await fuelRepo.upsert({
      id: newId(),
      vehicleId: GARAGE_IDS.ae85,
      occurredAt: at(i * 45 + 4),
      odometerKm: odometer,
      volume: 11.2,
      pricePerUnit: 322 + (i % 3) * 3,
      totalDop: 11.2 * (322 + (i % 3) * 3),
      fuelType: 'premium',
      isFullTank: true,
      missedPrevious: false,
      station: ['Texaco', 'Shell'][i % 2],
      notes: '',
    });
  }
  lines.push(`AE85: 8 cargas premium, odómetro ${odometer.toLocaleString('en-US')} km`);

  // DS3: the daily — the previous seed's year of history, rebased to its odometer.
  odometer = 96_000;
  for (let i = 11; i >= 0; i--) {
    odometer += 430 + ((i * 37) % 90);
    const partial = i === 6;
    const missed = i === 3;
    await fuelRepo.upsert({
      id: newId(),
      vehicleId: GARAGE_IDS.ds3,
      occurredAt: at(i * 30 + 4),
      odometerKm: odometer,
      volume: partial ? 4.2 : 10.4,
      pricePerUnit: 305 + (i % 4) * 3.5,
      totalDop: (partial ? 4.2 : 10.4) * (305 + (i % 4) * 3.5),
      fuelType: 'regular',
      isFullTank: !partial,
      missedPrevious: missed,
      station: ['Texaco', 'Shell', 'Isla', 'Next'][i % 4],
      notes: '',
    });
  }
  lines.push('DS3: 12 cargas regular (una parcial, una tras carga olvidada)');

  const services = [
    {
      vehicleId: GARAGE_IDS.ds3,
      kind: 'mantenimiento' as const,
      occurredAt: at(200),
      odometerKm: 98_500,
      title: 'Aceite de motor y filtro',
      description: '',
      costPartsDop: 2600,
      costLaborDop: 1400,
      shop: 'Taller de Ramón',
    },
    {
      vehicleId: GARAGE_IDS.ds3,
      kind: 'mantenimiento' as const,
      occurredAt: at(45),
      odometerKm: 101_100,
      title: 'Aceite de motor y filtro + Filtro de aire',
      description: '',
      costPartsDop: 3200,
      costLaborDop: 1500,
      shop: 'Taller de Ramón',
    },
    {
      vehicleId: GARAGE_IDS.ds3,
      kind: 'reparacion' as const,
      occurredAt: at(120),
      odometerKm: 99_800,
      title: 'Bomba de agua',
      description: 'Goteo en la bomba, se cambió con la correa.',
      costPartsDop: 8500,
      costLaborDop: 4000,
      shop: 'Auto Servicio El Che',
    },
    {
      vehicleId: GARAGE_IDS.ae85,
      kind: 'mejora' as const,
      occurredAt: at(300),
      odometerKm: 47_700,
      title: 'Radiador y abanicos racing',
      description: '',
      costPartsDop: 14_500,
      costLaborDop: 2500,
      shop: '',
    },
  ];
  for (const s of services) {
    await serviceRepo.upsert({
      id: newId(),
      ...s,
      totalDop: s.costPartsDop + s.costLaborDop,
      warrantyUntilDate: null,
      warrantyUntilKm: null,
      sourceInspectionId: null,
      sourceTaskId: null,
    });
  }
  lines.push('4 servicios (DS3: 2 mantenimientos y 1 reparación · AE85: 1 mejora)');

  const spends: [string, ExpenseCategory, number, number, string][] = [
    [GARAGE_IDS.ds3, 'marbete', 3000, 250, 'Marbete 2026'],
    [GARAGE_IDS.ds3, 'seguro', 18500, 150, 'Póliza anual'],
    [GARAGE_IDS.ds3, 'lavado', 500, 20, 'Lavado y aspirado'],
    [GARAGE_IDS.ds3, 'peaje', 320, 60, 'Autopista Duarte'],
    [GARAGE_IDS.ae85, 'multa', 1500, 95, 'Exceso de velocidad'],
    [GARAGE_IDS.ae85, 'parqueo', 200, 10, 'Ágora'],
  ];
  for (const [vehicleId, category, amount, daysAgo, description] of spends) {
    await expenseRepo.upsert({
      id: newId(),
      vehicleId,
      occurredAt: at(daysAgo),
      odometerKm: null,
      category,
      amountDop: amount,
      description,
      vendor: '',
    });
  }
  lines.push(`${spends.length} gastos (DS3: marbete, seguro, lavado, peaje · AE85: multa, parqueo)`);

  await taskRepo.upsert({
    id: newId(),
    vehicleId: GARAGE_IDS.ds3,
    title: 'Cambiar las cuatro gomas',
    kind: 'mantenimiento',
    priority: 'normal',
    status: 'pendiente',
    estimatedCostDop: 24000,
    notes: 'Ya están en el indicador de desgaste.',
    sourceInspectionResultId: null,
    doneRecordId: null,
  });
  for (const task of C3_TASKS) {
    await taskRepo.upsert({
      id: newId(),
      vehicleId: GARAGE_IDS.c3,
      ...task,
      status: 'pendiente',
      estimatedCostDop: null,
      notes: '',
      sourceInspectionResultId: null,
      doneRecordId: null,
    });
  }
  lines.push('5 tareas (DS3: gomas · C3: chapa, pintura, alineación, suspensión)');

  return lines;
}
