/**
 * ADR-63 spirit for the documents of PROMPT-03 (IMP 03112026 SPEC-C §C2/§C4): every value a matrícula, a VIN plate or a
 * document photo can put in the vehicle form / the document form must survive the app's OWN save and come back from SQLite
 * unchanged. "It does not save" bugs are caught here, not on a phone. Also the C4 acceptance: a seguro photo creates a
 * correct document AND moves the reminder to the right day.
 */
// Santo Domingo is UTC-4: the zone where a date-only value read as an instant lands on the day before.
process.env.TZ = 'America/Santo_Domingo';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import type { TestDb } from '../helpers/sqlite';
import type { VehicleDraft } from '@/components/VehicleForm';
import { documentPrefillFrom, mergeVpic, vehiclePrefillFrom } from '@/lib/ai/docMap';
import type { ReadResult } from '@/lib/ai/read';
import { matchColor, matchMakeModel } from '@/lib/ai/vehicleMatch';
import { createDocumentReminder, saveDocument } from '@/lib/db/documentOps';
import { documents as documentRepo, reminders as reminderRepo, vehicles as vehicleRepo, currentOdometer } from '@/lib/db/repos';
import { seedCatalog } from '@/lib/db/seed';
import { vehicleGallery } from '@/lib/db/tripOps';
import { draftFromVehicle } from '@/lib/db/vehicleDraft';
import { saveVehicleDraft } from '@/lib/db/vehicleOps';
import type { VinDecoded } from '@/lib/domain/vpic';
import { isoFromDateInput } from '@/lib/format';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
void (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb;

const f = (value: string | number | null, confidence = 0.9) => ({ value, confidence });
const read = (kind: string, fields: Record<string, ReturnType<typeof f>>): ReadResult => ({ ok: true, kind: kind as ReadResult['kind'], model: 'm', fields });

/** What the vehicle form's save builds from the values the scan put in its inputs (components/VehicleForm.tsx `save`). */
function draftFromScan(id: string, result: ReadResult, vpic: VinDecoded | null): VehicleDraft {
  const { prefill } = vehiclePrefillFrom(result);
  const merged = mergeVpic(prefill, vpic).merged;
  const mm = matchMakeModel(merged.make, merged.model);
  const color = matchColor(merged.color);
  return {
    id,
    name: 'Desde matrícula',
    type: 'carro',
    make: mm.make || null,
    makeId: mm.makeId,
    model: mm.model || null,
    modelId: mm.modelId,
    year: merged.year ?? null,
    color: color ? color.es : (merged.color ?? null),
    colorId: color?.id ?? null,
    plate: merged.plate?.trim().toUpperCase() || null,
    vin: merged.vin?.trim().toUpperCase() || null,
    defaultFuelType: merged.fuel ?? 'regular',
    tankVolume: null,
    odometerKm: null,
    synthetic: false,
    purchaseDate: null,
    purchasePrice: null,
    photoMediaId: null,
    notes: '',
    nickname: null,
    status: 'activo',
    chassisCode: null,
    chassisNumber: merged.chassisNumber?.trim().toUpperCase() || null,
    engineCode: merged.engineModel ?? null,
    transmission: merged.transmission ?? null,
    drivetrain: merged.drivetrain ?? null,
    origin: null,
    importedYear: null,
    story: '',
  } as VehicleDraft;
}

async function reopen(id: string) {
  const v = (await vehicleRepo.getById(id))!;
  return draftFromVehicle(v, await currentOdometer(id), (await vehicleGallery(id)).map((g) => g.mediaId));
}

beforeAll(async () => {
  await seedCatalog();
});

describe('matrícula + VIN → vehicle: every scanned value survives the save', () => {
  const matricula = read('doc_matricula', { make: f('TOYOTA'), model: f('HILUX'), year: f(2012), color: f('Blanco'), plate: f('a123456'), fuel: f('diesel'), vin: f('mr0fx22g001234567'), engine_cc: f(2494), seats: f(5) });
  const vpic: VinDecoded = { make: 'TOYOTA', model: 'Hilux', year: 2012, cylinders: 4, displacementCc: 2494, fuel: 'Diesel', transmission: 'manual', drivetrain: 'rwd', engineModel: '2KD-FTV' };

  it('form → SQLite → editor: plate, VIN, make/model ids, year, colour id, fuel, and the vPIC specs', async () => {
    await saveVehicleDraft(draftFromScan('veh_scan', matricula, vpic));
    expect(await reopen('veh_scan')).toMatchObject({
      make: 'Toyota',
      makeId: 'toyota',
      model: 'Hilux',
      modelId: 'toyota-hilux',
      year: 2012,
      plate: 'A123456',
      vin: 'MR0FX22G001234567',
      defaultFuelType: 'gasoil_regular',
      transmission: 'manual',
      drivetrain: 'rwd',
      engineCode: '2KD-FTV',
    });
    const color = matchColor('Blanco');
    if (color) expect(await reopen('veh_scan')).toMatchObject({ colorId: color.id, color: color.es });
  });

  it('a JDM frame number is stored as the CHASSIS number and never as a VIN', async () => {
    const jdm = read('vin_plate', { vin: f('AE85-5012345'), make: f('Toyota'), year: f(1986) });
    await saveVehicleDraft(draftFromScan('veh_jdm', jdm, null));
    const back = await reopen('veh_jdm');
    expect(back.chassisNumber).toBe('AE85-5012345');
    expect(back.vin).toBeNull();
    expect(back).toMatchObject({ make: 'Toyota', makeId: 'toyota', year: 1986 });
  });

  it('a make or model the catalog does not know is stored as the scanned text, with no id', async () => {
    await saveVehicleDraft(draftFromScan('veh_odd', read('doc_matricula', { make: f('Marca Rara'), model: f('Modelo X'), plate: f('B765432') }), null));
    expect(await reopen('veh_odd')).toMatchObject({ make: 'Marca Rara', makeId: null, model: 'Modelo X', modelId: null, plate: 'B765432' });
  });

  it('a second save with no change loses nothing (a row read back from SQLite)', async () => {
    const once = await reopen('veh_scan');
    await saveVehicleDraft({ ...draftFromScan('veh_scan', matricula, vpic), ...once } as VehicleDraft);
    expect(await reopen('veh_scan')).toMatchObject({ plate: 'A123456', vin: 'MR0FX22G001234567', modelId: 'toyota-hilux', engineCode: '2KD-FTV' });
  });

  it('vPIC wins the year on a conflict, the paper keeps the plate: both reach the editor', async () => {
    const oldYear = read('doc_matricula', { make: f('Toyota'), model: f('Hilux'), year: f(2011), plate: f('A123456'), vin: f('mr0fx22g001234567') });
    await saveVehicleDraft(draftFromScan('veh_conflict', oldYear, vpic));
    expect(await reopen('veh_conflict')).toMatchObject({ year: 2012, plate: 'A123456' });
  });
});

describe('document photo → document + reminder (C4)', () => {
  it('a seguro photo creates the document with every read value, and moves the seguro reminder to the expiry day', async () => {
    await saveVehicleDraft(draftFromScan('veh_doc', read('doc_matricula', { make: f('Toyota'), plate: f('A123456') }), null));
    const { prefill: p } = documentPrefillFrom(
      read('doc_seguro', { insurer: f('Seguros Universal'), policy_number: f('POL2024000123'), coverage_type: f('Ley + daños'), premium: f(18400), plate: f('A123456'), issued_date: f('2026-01-10'), expires_date: f('2027-01-10') }),
    );
    expect(p.kind).toBe('seguro');
    const result = await saveDocument({
      id: 'doc_scan',
      vehicleId: 'veh_doc',
      kind: p.kind!,
      title: `Seguro · ${p.titleDetail}`,
      issuedAt: p.issuedAt ? isoFromDateInput(p.issuedAt) : null,
      expiresAt: p.expiresAt ? isoFromDateInput(p.expiresAt) : null,
      mediaId: null,
      notes: p.notes,
    });
    expect(result.linked).toBe(true);

    const saved = (await documentRepo.getById('doc_scan'))!;
    expect(saved).toMatchObject({ kind: 'seguro', title: 'Seguro · Seguros Universal', vehicleId: 'veh_doc' });
    expect(saved.notes.split('\n')).toEqual(['Aseguradora: Seguros Universal', 'Póliza: POL2024000123', 'Cobertura: Ley + daños', 'Prima: RD$ 18,400']);
    // The date the person sees is the date on the paper, not the day before (UTC-4).
    expect(new Date(saved.expiresAt!).toLocaleDateString('en-CA')).toBe('2027-01-10');
    expect(new Date(saved.issuedAt!).toLocaleDateString('en-CA')).toBe('2026-01-10');

    const reminder = (await reminderRepo.listWhere({ vehicleId: 'veh_doc', legalKind: 'seguro' }))[0];
    expect(reminder.id).toBe(saved.reminderId);
    expect(reminder.isEnabled).toBe(true);
    expect(new Date(reminder.dueDate!).toLocaleDateString('en-CA')).toBe('2027-01-10');
  });

  it('a revisión técnica is stored as "otro" with its own title and still keeps its expiry', async () => {
    const { prefill: p } = documentPrefillFrom(read('document', { doc_kind: f('revision'), center: f('Inspección Autopista'), result: f('Aprobado'), expires_date: f('2027-05-01') }));
    expect(p.kind).toBe('otro');
    const r = await saveDocument({ id: 'doc_rev', vehicleId: 'veh_doc', kind: p.kind!, title: 'Revisión técnica · Inspección Autopista', issuedAt: null, expiresAt: isoFromDateInput(p.expiresAt!), mediaId: null, notes: p.notes });
    expect(r.linked).toBe(false); // no legal reminder for it: the C3 suggestion is what offers one
    const saved = (await documentRepo.getById('doc_rev'))!;
    expect(saved.notes).toBe('Centro: Inspección Autopista\nResultado: Aprobado');
    expect(new Date(saved.expiresAt!).toLocaleDateString('en-CA')).toBe('2027-05-01');
  });
});

describe('C3 — "Crear recordatorio" for a document with an expiry and no reminder', () => {
  it('an "otro" document gets its own one-off date reminder on the expiry day, and the document links to it', async () => {
    const doc = (await documentRepo.getById('doc_rev'))!;
    expect(doc.reminderId).toBeNull();
    const id = await createDocumentReminder(doc);
    expect(id).toBeTruthy();
    const r = (await reminderRepo.getById(id!))!;
    expect(r).toMatchObject({ vehicleId: 'veh_doc', title: 'Revisión técnica · Inspección Autopista', metric: 'date', isEnabled: true, isRecurring: false });
    expect(new Date(r.dueDate!).toLocaleDateString('en-CA')).toBe('2027-05-01');
    expect((await documentRepo.getById('doc_rev'))!.reminderId).toBe(id);
  });

  it('a legal kind re-arms the reminder the app already tracks: no duplicate', async () => {
    const before = (await reminderRepo.listWhere({ vehicleId: 'veh_doc', legalKind: 'marbete' })).length;
    expect(before).toBe(1);
    await documentRepo.upsert({ id: 'doc_marbete', vehicleId: 'veh_doc', kind: 'marbete', title: 'Marbete', issuedAt: null, expiresAt: isoFromDateInput('2027-03-31'), reminderId: null, mediaId: null, notes: '' });
    const id = await createDocumentReminder((await documentRepo.getById('doc_marbete'))!);
    const after = await reminderRepo.listWhere({ vehicleId: 'veh_doc', legalKind: 'marbete' });
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(id);
    expect(new Date(after[0].dueDate!).toLocaleDateString('en-CA')).toBe('2027-03-31');
  });

  it('a document with no expiry has nothing to remind', async () => {
    expect(await createDocumentReminder({ id: 'x', vehicleId: 'veh_doc', kind: 'otro', title: 'x', expiresAt: null })).toBeNull();
  });
});
