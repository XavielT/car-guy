jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

/**
 * IMP 03112026 SPEC-C §C1–C3: document → form values, the wrong-car guard, matrícula → vehicle, the vPIC merge, label
 * facts and the expiry suggestion. All pure.
 */
import {
  documentPrefillFrom,
  fuelFromDoc,
  fuelFromVpic,
  guardDocument,
  labelFactsFrom,
  mergeVpic,
  oilViscosityOf,
  tireSizeOf,
  vehiclePrefillFrom,
  type GuardVehicle,
} from '@/lib/ai/docMap';
import type { ReadResult } from '@/lib/ai/read';
import { suggestExpiryReminders } from '@/lib/domain/documentExpiry';
import type { VinDecoded } from '@/lib/domain/vpic';

const f = (value: string | number | null, confidence = 0.9) => ({ value, confidence });
const read = (kind: string, fields: Record<string, ReturnType<typeof f>>): ReadResult => ({ ok: true, kind: kind as ReadResult['kind'], model: 'm', fields });

describe('documentPrefillFrom', () => {
  it('a seguro: kind, "Seguro · aseguradora" detail, both dates, notes with policy and coverage', () => {
    const { prefill, marks } = documentPrefillFrom(
      read('doc_seguro', { insurer: f('Seguros Universal'), policy_number: f('POL2024000123'), coverage_type: f('Ley + daños'), premium: f(18400, 0.6), plate: f('A123456'), issued_date: f('2026-01-10'), expires_date: f('2027-01-10', 0.8) }),
    );
    expect(prefill).toMatchObject({ kind: 'seguro', titleDetail: 'Seguros Universal', issuedAt: '2026-01-10', expiresAt: '2027-01-10', isRevision: false });
    expect(prefill.notes.split('\n')).toEqual(['Aseguradora: Seguros Universal', 'Póliza: POL2024000123', 'Cobertura: Ley + daños', 'Prima: RD$ 18,400']);
    expect(prefill.vehicle.plate).toBe('A123456');
    expect(marks).toMatchObject({ kind: 1, expires: 0.8, issued: 0.9, notes: 0.6 });
  });

  it('the classified `document` kind maps the server kind; revision has no kind of its own (otro) and is flagged', () => {
    const { prefill, marks } = documentPrefillFrom(read('document', { doc_kind: f('revision', 0.7), center: f('Inspección Autopista'), result: f('Aprobado'), expires_date: f('2027-05-01') }));
    expect(prefill).toMatchObject({ kind: 'otro', isRevision: true, serverKind: 'revision', titleDetail: 'Inspección Autopista' });
    expect(marks.kind).toBe(0.7);
  });

  it.each([
    ['matricula', 'matricula'],
    ['marbete', 'marbete'],
    ['licencia', 'licencia'],
    ['garantia', 'garantia'],
  ])('doc kind %s → DocumentKind %s', (server, want) => {
    expect(documentPrefillFrom(read('document', { doc_kind: f(server) })).prefill.kind).toBe(want);
  });

  it('"other" or no classification leaves the kind for the person to pick', () => {
    expect(documentPrefillFrom(read('document', { doc_kind: f('other'), plate: f('A123456') })).prefill.kind).toBeNull();
    expect(documentPrefillFrom(read('document', { plate: f('A123456') })).prefill.kind).toBeNull();
  });

  it('a garantía keeps what is covered and the km limit', () => {
    const { prefill } = documentPrefillFrom(read('doc_garantia', { item: f('Batería 24 meses'), issuer: f('AutoParts RD'), expiry_km: f(40000), expires_date: f('2028-02-01') }));
    expect(prefill.titleDetail).toBe('Batería 24 meses');
    expect(prefill.notes).toContain('Hasta (km): 40,000');
  });

  it('nothing read → empty prefill (the form stays as it was)', () => {
    const { prefill, marks } = documentPrefillFrom(read('doc_marbete', {}));
    expect(prefill).toMatchObject({ kind: 'marbete', issuedAt: null, expiresAt: null, notes: '', titleDetail: null });
    expect(marks).toEqual({ kind: 1 });
  });
});

describe('guardDocument — the wrong-car guard', () => {
  const ae85: GuardVehicle = { id: 'v1', name: 'Trueno AE85', plate: 'A123456', vin: null };
  const ds3: GuardVehicle = { id: 'v2', name: 'DS3', plate: 'G654321', vin: 'VF7SA5FS0CW123456' };
  const all = [ae85, ds3];

  it('same plate (any formatting) → match', () => {
    expect(guardDocument({ plate: 'a-123 456', vin: null, make: null, model: null, year: null }, ae85, all).status).toBe('match');
  });
  it("another car's plate → mismatch, and it says which of the person's cars it belongs to", () => {
    const g = guardDocument({ plate: 'G654321', vin: null, make: null, model: null, year: null }, ae85, all);
    expect(g.status).toBe('mismatch');
    expect(g.belongsTo?.id).toBe('v2');
    expect(g.docPlate).toBe('G654321');
  });
  it('a plate that is nobody’s → mismatch with nowhere to switch to (still raised, the person can save anyway)', () => {
    const g = guardDocument({ plate: 'Z999999', vin: null, make: null, model: null, year: null }, ae85, all);
    expect(g.status).toBe('mismatch');
    expect(g.belongsTo).toBeNull();
  });
  it('matches on the VIN when the plate is not recorded', () => {
    expect(guardDocument({ plate: null, vin: 'vf7sa5fs0cw123456', make: null, model: null, year: null }, ds3, all).status).toBe('match');
  });
  it('a right plate with a VIN misread by a character is NOT a false alarm', () => {
    const car: GuardVehicle = { id: 'v3', name: 'X', plate: 'A111111', vin: 'JT2AE85S5012345AB' };
    expect(guardDocument({ plate: 'A111111', vin: 'JT2AE85S5012345AC', make: null, model: null, year: null }, car, [car]).status).toBe('match');
  });
  it('nothing to compare (the car has no plate, or the paper shows none) → unknown: no alarm', () => {
    const bare: GuardVehicle = { id: 'v4', name: 'Sin placa', plate: null, vin: null };
    expect(guardDocument({ plate: 'A123456', vin: null, make: null, model: null, year: null }, bare, [bare]).status).toBe('unknown');
    expect(guardDocument({ plate: null, vin: null, make: 'Toyota', model: null, year: null }, ae85, all).status).toBe('unknown');
  });
});

describe('vehiclePrefillFrom — matrícula / VIN plate', () => {
  it('a matrícula fills make, model, year, colour, plate, fuel, cc and seats, each with its confidence', () => {
    const { prefill, marks } = vehiclePrefillFrom(read('doc_matricula', { make: f('Toyota'), model: f('Corolla'), year: f(1986, 0.5), color: f('Blanco'), plate: f('A123456'), fuel: f('gasolina'), engine_cc: f(1587), seats: f(5), vin: f('JT2AE86L4G0123456') }));
    expect(prefill).toMatchObject({ make: 'Toyota', model: 'Corolla', year: 1986, color: 'Blanco', plate: 'A123456', fuel: 'regular', engineCc: 1587, seats: 5, vin: 'JT2AE86L4G0123456' });
    expect(marks.year).toBe(0.5);
  });
  it('a 17-character VIN goes to the VIN; a short JDM frame number goes to the chassis number, never the VIN', () => {
    expect(vehiclePrefillFrom(read('vin_plate', { vin: f('1HGCM82633A004352') })).prefill).toMatchObject({ vin: '1HGCM82633A004352' });
    const jdm = vehiclePrefillFrom(read('vin_plate', { vin: f('AE85-5012345') })).prefill;
    expect(jdm.chassisNumber).toBe('AE85-5012345');
    expect(jdm.vin).toBeUndefined();
  });
  it('a 17-long "VIN" with an impossible letter is shown, but unsure (≤ 0.3), so the form asks to check it', () => {
    const { prefill, marks } = vehiclePrefillFrom(read('vin_plate', { vin: f('1HGCM82633A00435O', 0.9) }));
    expect(prefill.vin).toBe('1HGCM82633A00435O');
    expect(marks.vin).toBeLessThanOrEqual(0.3);
  });
  it('electric / hybrid have no fuel to pick; nothing read changes nothing', () => {
    expect(fuelFromDoc('electrico')).toBeNull();
    expect(fuelFromDoc('hibrido')).toBeNull();
    expect(fuelFromDoc('diesel')).toBe('gasoil_regular');
    expect(vehiclePrefillFrom(read('doc_matricula', {})).prefill).toEqual({});
  });
  it('vPIC fuel text maps to the app fuels', () => {
    expect(fuelFromVpic('Gasoline')).toBe('regular');
    expect(fuelFromVpic('Diesel')).toBe('gasoil_regular');
    expect(fuelFromVpic('Compressed Natural Gas (CNG)')).toBe('gnv');
    expect(fuelFromVpic('Liquefied Petroleum Gas (LPG)')).toBe('glp');
    expect(fuelFromVpic('Electric')).toBeNull();
  });
});

describe('mergeVpic — vPIC wins specs, the document wins plate and colour', () => {
  const vpic = (over: Partial<VinDecoded> = {}): VinDecoded => ({ make: 'TOYOTA', model: 'Corolla', year: 2003, cylinders: 4, displacementCc: 1800, fuel: 'Gasoline', transmission: 'automatica', drivetrain: 'fwd', engineModel: '1ZZ-FE', ...over });

  it('same make in a different case is NOT a conflict', () => {
    const r = mergeVpic({ make: 'Toyota', model: 'Corolla', year: 2003 }, vpic());
    expect(r.conflicts).toEqual([]);
    expect(r.merged.make).toBe('Toyota');
  });
  it('a different year is a conflict; vPIC wins and the document value is kept in the conflict so it can be restored', () => {
    const r = mergeVpic({ make: 'Toyota', model: 'Corolla', year: 2002 }, vpic());
    expect(r.conflicts).toEqual([{ field: 'year', document: 2002, vpic: 2003, chosen: 'vpic' }]);
    expect(r.merged.year).toBe(2003);
  });
  it('vPIC fills what the document left empty, and says so', () => {
    const r = mergeVpic({ plate: 'A123456' }, vpic());
    expect(r.filled.sort()).toEqual(['engineCc', 'fuel', 'make', 'model', 'year']);
    expect(r.merged).toMatchObject({ make: 'Toyota', model: 'Corolla', year: 2003, engineCc: 1800, fuel: 'regular', cylinders: 4, transmission: 'automatica', drivetrain: 'fwd', engineModel: '1ZZ-FE' });
  });
  it('the document keeps plate, colour and chassis number: vPIC never touches them', () => {
    const r = mergeVpic({ plate: 'A123456', color: 'Gris', chassisNumber: 'AE85-5012345' }, vpic({ make: 'HONDA' }));
    expect(r.merged).toMatchObject({ plate: 'A123456', color: 'Gris', chassisNumber: 'AE85-5012345' });
  });
  it('a document cc and fuel stay when the document gave them', () => {
    const r = mergeVpic({ engineCc: 1587, fuel: 'premium' }, vpic());
    expect(r.merged.engineCc).toBe(1587);
    expect(r.merged.fuel).toBe('premium');
  });
  it('vPIC answered nothing (a JDM VIN) → the document values are untouched', () => {
    const doc = { make: 'Toyota', model: 'Trueno', year: 1986 };
    expect(mergeVpic(doc, null)).toEqual({ merged: doc, filled: [], conflicts: [] });
    expect(mergeVpic(doc, vpic({ make: null, model: null, year: null, displacementCc: null, fuel: null })).conflicts).toEqual([]);
  });
  it('ALL-CAPS vPIC text is title-cased; mixed case is left alone', () => {
    expect(mergeVpic({}, vpic({ make: 'MERCEDES-BENZ', model: 'C-Class' })).merged).toMatchObject({ make: 'Mercedes-Benz', model: 'C-Class' });
  });
});

describe('label facts (door jamb / cap / tyre)', () => {
  it('an oil cap gives the viscosity and the spec', () => {
    const facts = labelFactsFrom(read('part_label', { category: f('oil'), spec: f('SAE 5W30 API SN') }));
    expect(facts.map((x) => [x.label, x.value, x.group])).toEqual([['Viscosidad del aceite', '5W-30', 'motor'], ['Especificación del aceite', 'SAE 5W30 API SN', 'motor']]);
  });
  it('a tyre sidewall gives the size and the DOT', () => {
    const facts = labelFactsFrom(read('part_label', { category: f('tire'), spec: f('205/55R16 91V'), dot: f('2321') }));
    expect(facts.map((x) => [x.label, x.value])).toEqual([['Medida de gomas', '205/55R16 91V'], ['DOT de las gomas', '2321']]);
  });
  it.each([['5W30', '5W-30'], ['sae 0w-20', '0W-20'], ['15W40', '15W-40'], ['SN', null], [null, null]])('oilViscosityOf(%j) = %j', (s, want) => {
    expect(oilViscosityOf(s as string | null)).toBe(want);
  });
  it.each([['205/55R16 91V', '205/55R16 91V'], ['205/55 R16', '205/55R16'], ['225/45ZR17 94W', '225/45R17 94W'], ['abc', null]])('tireSizeOf(%j) = %j', (s, want) => {
    expect(tireSizeOf(s)).toBe(want);
  });
});

describe('suggestExpiryReminders — C3', () => {
  const doc = (id: string, expiresAt: string | null, over = {}) => ({ id, vehicleId: 'v1', kind: 'otro' as const, title: id, expiresAt, reminderId: null, ...over });
  it('an expiry with no reminder is suggested, expired first then nearest', () => {
    const out = suggestExpiryReminders([doc('later', '2027-06-01'), doc('soon', '2026-12-01'), doc('old', '2026-10-01')], '2026-11-04');
    expect(out.map((s) => [s.documentId, s.status])).toEqual([['old', 'expired'], ['soon', 'soon'], ['later', 'later']]);
    expect(out[0].daysLeft).toBeLessThan(0);
    expect(out[1].dueDate).toBe('2026-12-01');
  });
  it('already linked, or no expiry, is left alone', () => {
    expect(suggestExpiryReminders([doc('a', '2027-01-01', { reminderId: 'r1' }), doc('b', null)], '2026-11-04')).toEqual([]);
  });
  it('a legal kind carries its legal kind (the reminder it would re-arm)', () => {
    expect(suggestExpiryReminders([doc('s', '2027-01-01', { kind: 'seguro' })], '2026-11-04')[0].legalKind).toBe('seguro');
    expect(suggestExpiryReminders([doc('o', '2027-01-01')], '2026-11-04')[0].legalKind).toBeNull();
  });
  it('60 days is "soon", 61 is "later"; a bad date is skipped, not crashed on', () => {
    expect(suggestExpiryReminders([doc('x', '2027-01-03')], '2026-11-04')[0].status).toBe('soon');
    expect(suggestExpiryReminders([doc('y', '2027-01-04')], '2026-11-04')[0].status).toBe('later');
    expect(suggestExpiryReminders([doc('z', 'garbage')], '2026-11-04')).toEqual([]);
    expect(suggestExpiryReminders([doc('w', '2027-01-01')], 'nope')).toEqual([]);
  });
});
