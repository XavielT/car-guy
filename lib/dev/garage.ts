import { enqueue } from '@/lib/db/client';
import {
  contacts as contactRepo,
  expenses as expenseRepo,
  fuel as fuelRepo,
  milestones as milestoneRepo,
  mods as modRepo,
  odometer as odometerRepo,
  serviceRecords as serviceRepo,
  specsheets as specsheetRepo,
  tasks as taskRepo,
  tires as tireRepo,
  vehicleOwnership as ownershipRepo,
  vehicles as vehicleRepo,
  wheelSets as wheelSetRepo,
  wishlist as wishlistRepo,
} from '@/lib/db/repos';
import { seedVehicleDefaults } from '@/lib/db/seed';
import type { ExpenseCategory, Mod, Task, Vehicle } from '@/lib/db/types';
import { id as newId } from '@/lib/format';

/**
 * Xaviel's real garage, for the dev seed (app/dev/seed.tsx) and the backup
 * fixture PROMPT-01's migration test imports.
 *
 * Real names, engines, mods and stories; **never** real identifiers — no
 * plate, no VIN, no phone. Dates that are only known to the year are written as 1 January and say
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
    initialOdometerKm: 49_040,
    notes: '',
    sortOrder: 0,
    nickname: 'hachi-gō', // ハチゴー
    status: 'activo',
    chassisCode: 'AE85',
    // The engine it has now; the factory 3A-U lives in the ficha's `stock`.
    engineCode: '4A-GE 20V',
    transmission: 'manual',
    drivetrain: 'rwd',
    origin: 'jdm',
    story:
      'Preparado para drift y ceritos. Aros, radiador y abanicos racing, ECU tuneada con pops and bangs. ' +
      'No sé cuántos caballos, pero el motor es alegre, gira rápido y alto.',
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
    nickname: 'el daily',
    status: 'activo',
    engineCode: '1.6 NA',
    transmission: 'automatica',
    drivetrain: 'fwd',
    origin: 'eudm',
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
    status: 'proyecto',
    engineCode: '1.6 NA',
    transmission: 'manual',
    drivetrain: 'fwd',
    story: 'Chocado hace unos meses; en restauración. Cuando esté funcional, se modifica.',
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
    status: 'vendido',
    engineCode: '1.8T',
    transmission: 'automatica',
    drivetrain: 'fwd',
    story: 'Mi primer carro. No encontré fotos de él cuando cambié de teléfono — por eso existe el álbum.',
  },
];

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
  // Ownership periods, as migration v2 derives them for existing garages.
  for (const vehicle of VEHICLES) {
    await ownershipRepo.upsert({
      id: `own_${vehicle.id}`,
      vehicleId: vehicle.id,
      acquiredAt: vehicle.id === GARAGE_IDS.ds3 ? at(730) : (vehicle.purchaseDate ?? null),
      acquiredPrice: vehicle.purchasePrice ?? null,
      soldAt: vehicle.soldDate ?? null,
      soldPrice: null,
      isCurrent: true,
    });
  }
  lines.push('4 vehículos: Trueno AE85, DS3, C3 (proyecto), Jetta (vendido 2018 → 2021)');

  // AE85: premium, ~420 km a tank (≈37 km/gal — a 4A-GE that revs), ending at 52,400.
  let odometer = 49_040;
  for (let i = 7; i >= 0; i--) {
    odometer += 420;
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
      odometerKm: 49_500,
      title: 'Radiador y abanicos racing',
      description: '',
      costPartsDop: 14_500,
      costLaborDop: 2500,
      shop: '',
    },
  ];
  let radiatorRecordId = '';
  for (const s of services) {
    const recordId = newId();
    if (s.kind === 'mejora') radiatorRecordId = recordId;
    await serviceRepo.upsert({
      id: recordId,
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

  lines.push(...(await seedBuildAndMemory(at, radiatorRecordId)));
  return lines;
}

/**
 * The schema v2 part: the AE85's build, a wishlist item, its wheels and tires,
 * the fichas, milestones and a contact. Values Xaviel gave; the rest (prices,
 * dates) are placeholders marked as such, and "~160 hp" is an estimate — he
 * does not know the real number.
 */
async function seedBuildAndMemory(at: (daysAgo: number) => string, radiatorRecordId: string): Promise<string[]> {
  const ae85 = GARAGE_IDS.ae85;
  const tony = 'dev_contact_tony';
  await contactRepo.upsert({ id: tony, name: 'Taller de Tony', kind: 'mecanico', notes: '' });

  const swapAt = '2025-08-15T12:00:00.000Z';
  const mods: (Partial<Mod> & { id: string; name: string; categoryId: string })[] = [
    {
      id: 'dev_mod_swap',
      categoryId: 'motor',
      name: 'Swap 4A-GE 20V',
      variant: 'blacktop',
      installedAt: swapAt,
      installerType: 'taller',
      contactId: tony,
      affectsSpecs: true,
      // hp is an estimate; nobody has put it on a dyno.
      specEffects: JSON.stringify({ engine_code: '4A-GE 20V', hp: 160 }),
      tags: JSON.stringify(['SWAP']),
    },
    {
      id: 'dev_mod_ecu',
      categoryId: 'ecu',
      name: 'ECU tuneada',
      notes: 'Pops and bangs — tira tiro.',
      installedAt: swapAt,
      installerType: 'taller',
      contactId: tony,
      affectsSpecs: true,
      specEffects: JSON.stringify({ ecu: 'tuneada (pops and bangs)' }),
    },
    {
      id: `mod_${radiatorRecordId}`,
      categoryId: 'enfriamiento',
      name: 'Radiador y abanicos racing',
      installedAt: at(300),
      installedKm: 49_500,
      costPartDop: 14_500,
      costLaborDop: 2500,
      serviceRecordId: radiatorRecordId,
    },
    {
      id: 'dev_mod_aros',
      categoryId: 'ruedas',
      name: 'Aros 15x8 ET0',
      installedAt: at(200),
      affectsSpecs: true,
      specEffects: JSON.stringify({ wheel_f: '15x8 ET0', wheel_r: '15x8 ET0' }),
    },
    {
      id: 'dev_mod_gomas',
      categoryId: 'gomas',
      name: 'Gomas 195/50R15',
      installedAt: at(200),
      affectsSpecs: true,
      specEffects: JSON.stringify({ tire_f: '195/50R15', tire_r: '195/50R15' }),
    },
  ];
  for (const mod of mods) {
    await modRepo.upsert({ vehicleId: ae85, status: 'instalado', ...mod });
  }

  await wishlistRepo.upsert({
    id: 'dev_wish_coilovers',
    vehicleId: ae85,
    categoryId: 'suspension',
    name: 'Coilovers BC Racing BR',
    brand: 'BC Racing',
    priority: 1,
    estPriceForeign: 1050,
    currency: 'USD',
    status: 'ahorrando',
    notes: '',
  });

  await wheelSetRepo.upsert({
    id: 'dev_wheels_15x8',
    vehicleId: ae85,
    name: 'Aros 15x8 ET0',
    widthIn: 8,
    diamIn: 15,
    offsetMm: 0,
    boltPattern: '4x100',
    qty: 4,
    status: 'montado',
    notes: '',
  });
  for (const position of ['fl', 'fr', 'rl', 'rr'] as const) {
    await tireRepo.upsert({
      id: `dev_tire_${position}`,
      vehicleId: ae85,
      wheelSetId: 'dev_wheels_15x8',
      size: '195/50R15',
      widthMm: 195,
      aspect: 50,
      rimIn: 15,
      dotCode: '2323',
      dotWeek: 23,
      dotYear: 2023,
      position,
      status: 'en_uso',
    });
  }

  // The fichas. AE85: the factory car the build started from. DS3: only what
  // is well known for the platform — everything else stays null for PROMPT-05's
  // presets and "Verifica con tu manual".
  await specsheetRepo.upsertForVehicle(ae85, {
    presetId: 'ae85_3au',
    stock: JSON.stringify({ engine_code: '3A-U', wheel_f: '13x5', wheel_r: '13x5' }),
    fieldSources: JSON.stringify({ engine_code: 'user', wheel_f: 'user', wheel_r: 'user' }),
  });
  await specsheetRepo.upsertForVehicle(GARAGE_IDS.ds3, {
    presetId: 'ds3_sa_ep6',
    stock: JSON.stringify({ engine_code: 'EP6' }),
    boltPattern: '4x108',
    fuelTankL: 50,
    fieldSources: JSON.stringify({ engine_code: 'preset', bolt_pattern: 'preset', fuel_tank_l: 'preset' }),
  });
  for (const id of [GARAGE_IDS.c3, GARAGE_IDS.jetta]) await specsheetRepo.upsertForVehicle(id, {});

  await milestoneRepo.upsert({
    id: 'dev_ms_swap',
    vehicleId: ae85,
    kind: 'swap',
    occurredAt: swapAt,
    title: 'Swap 4A-GE 20V',
    story: 'Adiós 3A-U.',
  });
  await milestoneRepo.upsert({
    id: 'dev_ms_choque',
    vehicleId: GARAGE_IDS.c3,
    kind: 'accidente',
    occurredAt: at(120),
    title: 'Choque',
    story: '',
  });

  return [
    'AE85: 5 mods (swap, ECU, radiador, aros, gomas) · wishlist coilovers USD 1,050',
    'AE85: aros 15x8 + 4 gomas DOT 2323 · fichas AE85 (3A-U) y DS3',
    'Hitos: swap ago 2025 (AE85), choque (C3) · contacto: Taller de Tony',
  ];
}
