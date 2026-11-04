jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

/**
 * IMP 03112026 SPEC-D §D1: the app side of "explain this code for my car": the minimal request built from local data, the
 * cache key, the closed list of actions, and a cache that never breaks the feature.
 */
const mockFrom = jest.fn();
jest.mock('@/lib/cloud/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }));

import { buildObdInput, historyHash, obdActions, readCachedObd, saveCachedObd, systemsFor, type ObdAnswer, type ObdSource } from '@/lib/ai/obd';
import type { ServiceRecord, VehicleDtcEvent } from '@/lib/db/types';

const ev = (over: Partial<VehicleDtcEvent>): VehicleDtcEvent => ({ id: 'e', vehicleId: 'v1', code: 'P0420', seenAt: '2026-10-01T12:00:00.000Z', odometerKm: 84000, clearedAt: null, repairRecordId: null, notes: '', deletedAt: null, ...over }) as VehicleDtcEvent;
const rep = (over: Partial<ServiceRecord>): ServiceRecord => ({ id: 'r', vehicleId: 'v1', kind: 'reparacion', occurredAt: '2026-07-01T12:00:00.000Z', title: 'Sensor de oxígeno trasero', system: 'motor', totalDop: 4500, deletedAt: null, ...over }) as ServiceRecord;

const base: ObdSource = {
  vehicle: { make: 'Toyota', model: 'Corolla', year: 2003, engineCode: '1ZZ-FE', defaultFuelType: 'regular', transmission: 'automatica', origin: 'usdm' },
  odometerKm: 140000, codes: ['p0420'], events: [], repairs: [], today: '2026-11-04',
};

describe('systemsFor', () => {
  it('maps a code to the repair systems whose recent work can explain it', () => {
    expect(systemsFor('P0420')).toEqual(expect.arrayContaining(['motor', 'electrico']));
    expect(systemsFor('C0035')).toEqual(expect.arrayContaining(['frenos', 'suspension']));
    expect(systemsFor('B0010')).toContain('carroceria');
    expect(systemsFor('U0100')).toEqual(['electrico']);
    expect(systemsFor('nonsense')).toEqual([]);
  });
});

describe('buildObdInput — minimal, from local data', () => {
  it('car facts, the same code seen before, relevant repairs, other pending codes', () => {
    const r = buildObdInput({
      ...base,
      events: [ev({ id: 'a', seenAt: '2026-06-02T12:00:00.000Z', odometerKm: 130000 }), ev({ id: 'b', code: 'P0301', seenAt: '2026-10-20T12:00:00.000Z' }), ev({ id: 'c', code: 'P0171', clearedAt: '2026-09-01T00:00:00Z' })],
      repairs: [rep({ id: 'o2' }), rep({ id: 'brakes', system: 'frenos', title: 'Pastillas' }), rep({ id: 'old', occurredAt: '2023-01-01T12:00:00.000Z' }), rep({ id: 'nosys', system: null, title: 'Algo' }), rep({ id: 'mant', kind: 'mantenimiento' }), rep({ id: 'del', deletedAt: '2026-08-01T00:00:00Z' })],
      partsByRepair: { o2: ['sensor de oxígeno trasero', 'junta'] },
    });
    expect(r.codes).toEqual(['P0420']);
    expect(r.vehicle).toEqual({ make: 'Toyota', model: 'Corolla', year: 2003, engine: '1ZZ-FE', fuel: 'regular', odometerKm: 140000, transmission: 'automatica', origin: 'usdm' });
    expect(r.history.sameCode).toEqual([{ date: '2026-06-02', odometerKm: 130000 }]);
    expect(r.history.pending).toEqual([{ code: 'P0301', date: '2026-10-20' }]);
    // only motor-block repairs from the last 24 months (a brake job, an old one, maintenance, deleted ones are out; "no system" is in)
    expect(r.history.repairs.map((x) => x.title)).toEqual(['Sensor de oxígeno trasero', 'Algo']);
    expect(r.history.repairs[0].parts).toEqual(['sensor de oxígeno trasero', 'junta']);
  });

  it('carries NOTHING that identifies the person: no plate, VIN, owner, photo, location', () => {
    const wire = JSON.stringify(buildObdInput({ ...base, vehicle: { ...base.vehicle, ...({ plate: 'A123456', vin: 'JT2AE91A5M0000001', ownerName: 'Juan' } as object) } }));
    for (const leak of ['A123456', 'JT2AE91A5M0000001', 'Juan', 'plate', 'vin', 'photo', 'lat', 'lng']) expect(wire).not.toContain(leak);
  });

  it('invalid codes are dropped and duplicates merged; history is capped at 12 repairs', () => {
    expect(buildObdInput({ ...base, codes: ['p0420', 'P0420', 'xx', 'c0035'] }).codes).toEqual(['P0420', 'C0035']);
    const many = Array.from({ length: 30 }, (_, i) => rep({ id: `r${i}`, title: `Reparación ${i}`, occurredAt: `2026-0${(i % 9) + 1}-15T12:00:00.000Z` }));
    expect(buildObdInput({ ...base, repairs: many }).history.repairs).toHaveLength(12);
  });

  it('freeze-frame values ride along when the person scanned them', () => {
    expect(buildObdInput({ ...base, freezeFrame: { rpm: 2400, coolantC: 92, loadPct: 30, speedKmh: 60 } }).freezeFrame).toEqual({ rpm: 2400, coolantC: 92, loadPct: 30, speedKmh: 60 });
    expect(buildObdInput(base).freezeFrame).toBeNull();
  });
});

describe('historyHash — the cache key', () => {
  const key = (over: Partial<ObdSource> = {}) => historyHash(buildObdInput({ ...base, ...over }));

  it('is stable: same question, same key; 16 hex digits', () => {
    expect(key()).toBe(key());
    expect(key()).toMatch(/^[0-9a-f]{16}$/);
  });
  it('the odometer and today do not change it (or the cache would never hit)', () => {
    expect(key({ odometerKm: 150000, today: '2026-11-20' })).toBe(key());
  });
  it('the order of the codes does not matter', () => {
    expect(key({ codes: ['P0420', 'P0171'] })).toBe(key({ codes: ['P0171', 'P0420'] }));
  });
  it('a different code, car, new sighting or new relevant repair DOES change it', () => {
    const k = key();
    expect(key({ codes: ['P0421'] })).not.toBe(k);
    expect(key({ vehicle: { ...base.vehicle, year: 2004 } })).not.toBe(k);
    expect(key({ events: [ev({})] })).not.toBe(k);
    expect(key({ repairs: [rep({})] })).not.toBe(k);
    expect(key({ repairs: [rep({ system: 'frenos' })] })).toBe(k); // a brake job is not relevant to P0420
  });
});

describe('obdActions — the closed list', () => {
  const answer = (over: Partial<ObdAnswer> = {}): ObdAnswer => ({
    codes: ['P0420'], can_drive: 'careful', can_drive_reason: 'x', safety_override: null, history_note: null,
    causes: [
      { title: 'Catalizador gastado', likelihood: 'probable', why: 'x', parts: ['catalizador'], diy_or_shop: 'shop', cost_rd: null, recently_repaired: false },
      { title: 'Sensor de oxígeno', likelihood: 'possible', why: 'x', parts: ['sensor de oxígeno', 'catalizador'], diy_or_shop: 'either', cost_rd: null, recently_repaired: false },
    ],
    first_checks: [], diy_or_shop: 'shop', cost_range_rd: null, stop_and_tow_when: '', related_codes: [], sanitized: 0, ...over,
  });

  it('a repair draft from the top suspect (with the suspected parts in the description), a task, and a re-scan', () => {
    const a = obdActions(answer(), ['P0420']);
    expect(a.map((x) => x.kind)).toEqual(['repair', 'task', 'rescan']);
    expect(a[0]).toMatchObject({ kind: 'repair', title: 'Catalizador gastado', parts: ['catalizador', 'sensor de oxígeno'] });
    expect((a[0] as { description: string }).description).toBe('P0420 · Piezas sospechosas: catalizador, sensor de oxígeno.');
    expect(a[1]).toEqual({ kind: 'task', title: 'Revisar: Catalizador gastado' });
  });
  it('the re-scan comes sooner the more cautious the answer is', () => {
    const days = (d: ObdAnswer['can_drive']) => (obdActions(answer({ can_drive: d }), ['P0420']).find((x) => x.kind === 'rescan') as { days: number }).days;
    expect([days('yes'), days('careful'), days('no')]).toEqual([7, 3, 1]);
  });
  it('no causes → only the re-scan', () => {
    expect(obdActions(answer({ causes: [] }), ['P0420']).map((x) => x.kind)).toEqual(['rescan']);
  });
});

describe('the cache never breaks the feature', () => {
  beforeEach(() => mockFrom.mockReset());
  const answer = { codes: ['P0420'], can_drive: 'yes', causes: [{ title: 'x' }] } as unknown as ObdAnswer;

  const query = (result: unknown) => {
    const q: Record<string, unknown> = {};
    q.eq = jest.fn(() => q);
    q.maybeSingle = jest.fn(async () => result);
    return q;
  };

  it('a hit returns the stored answer with its status', async () => {
    const q = query({ data: { payload: answer, status: 'seen', created_at: '2026-11-01T00:00:00Z' }, error: null });
    mockFrom.mockReturnValue({ select: jest.fn(() => q) });
    expect(await readCachedObd('v1', 'abcd1234abcd1234')).toEqual({ answer, status: 'seen', createdAt: '2026-11-01T00:00:00Z' });
    expect(mockFrom).toHaveBeenCalledWith('ai_insights');
    expect(q.eq).toHaveBeenCalledWith('kind', 'obd');
    expect(q.eq).toHaveBeenCalledWith('input_hash', 'abcd1234abcd1234');
  });
  it.each([
    ['no row', { data: null, error: null }],
    ['an error (table not applied yet, offline)', { data: null, error: { message: 'relation does not exist' } }],
    ['a payload that is not an explanation', { data: { payload: { nope: 1 } }, error: null }],
  ])('%s → null, never a throw', async (_n, result) => {
    mockFrom.mockReturnValue({ select: jest.fn(() => query(result)) });
    expect(await readCachedObd('v1', 'h')).toBeNull();
  });
  it('a throwing client → null; a failed save → false', async () => {
    mockFrom.mockImplementation(() => { throw new Error('network'); });
    expect(await readCachedObd('v1', 'h')).toBeNull();
    expect(await saveCachedObd('v1', 'h', answer)).toBe(false);
  });
  it('save upserts on the unique key, so a Refresh replaces instead of duplicating', async () => {
    const upsert = jest.fn(async () => ({ error: null }));
    mockFrom.mockReturnValue({ upsert });
    expect(await saveCachedObd('v1', 'abcd1234abcd1234', answer)).toBe(true);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ vehicle_id: 'v1', kind: 'obd', input_hash: 'abcd1234abcd1234', payload: answer }), { onConflict: 'user_id,vehicle_id,kind,input_hash' });
    mockFrom.mockReturnValue({ upsert: jest.fn(async () => ({ error: { message: 'rls' } })) });
    expect(await saveCachedObd('v1', 'h', answer)).toBe(false);
  });
});
