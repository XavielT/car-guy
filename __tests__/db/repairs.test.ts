/**
 * Repairs through the service ops against a real SQLite (IMP 16102026 Phase 5, N7/X7): who did it, the system, the
 * photos with their role, and closing a Pendiente — an event or a task — with an undo that puts it back.
 */
import { milestones, serviceMedia, serviceRecords, tasks, vehicles } from '@/lib/db/repos';
import { seedCatalog } from '@/lib/db/seed';
import { listOpenPendings, saveServiceRecord, undoResolvedPending, type ServiceDraft } from '@/lib/db/serviceOps';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});

const repair = (over: Partial<ServiceDraft> = {}): ServiceDraft => ({
  vehicleId: 'v1',
  kind: 'reparacion',
  occurredAt: '2026-09-01T12:00:00.000Z',
  odometerKm: 51000,
  title: 'Cambié el alternador',
  description: 'No cargaba la batería',
  costPartsDop: 4500,
  costLaborDop: 0,
  totalDop: 4500,
  shop: '',
  warrantyUntilDate: null,
  warrantyUntilKm: null,
  serviceTypeIds: [],
  parts: [],
  doneBy: 'self',
  system: 'electrico',
  ...over,
});

beforeAll(async () => {
  await seedCatalog();
  await vehicles.upsertRaw({ id: 'v1', name: 'AE85', type: 'carro', defaultFuelType: 'regular', notes: '', sortOrder: 0 } as never);
});

describe('who did it and which system', () => {
  it('saves and reads back doneBy and system; an edit that omits them keeps them', async () => {
    await saveServiceRecord(repair({ id: 'r_self' }));
    expect(await serviceRecords.getById('r_self')).toMatchObject({ doneBy: 'self', system: 'electrico' });
    await saveServiceRecord({ ...repair({ id: 'r_self', title: 'Cambié el alternador (editado)' }), doneBy: undefined, system: undefined });
    expect(await serviceRecords.getById('r_self')).toMatchObject({ doneBy: 'self', system: 'electrico', title: 'Cambié el alternador (editado)' });
  });

  it('a shop repair keeps its labour and the shop name', async () => {
    await saveServiceRecord(repair({ id: 'r_shop', doneBy: 'shop', shop: 'Taller de ejemplo', costLaborDop: 1500, totalDop: 6000 }));
    expect(await serviceRecords.getById('r_shop')).toMatchObject({ doneBy: 'shop', shop: 'Taller de ejemplo', costLaborDop: 1500, totalDop: 6000 });
  });

  it('a repair never re-arms a reminder (no catalog items)', async () => {
    const result = await saveServiceRecord(repair({ id: 'r_noreset' }));
    expect(result.resets).toEqual([]);
  });
});

describe('photos with a role', () => {
  const links = async (id: string) => (await serviceMedia.listWhere({ serviceRecordId: id })).map((l) => [l.mediaId, l.role]).sort();

  it('saves each photo with its role and replaces the set on edit', async () => {
    await saveServiceRecord(repair({ id: 'r_photos', media: [{ mediaId: 'm1', role: 'before' }, { mediaId: 'm2', role: 'after' }, { mediaId: 'm3', role: 'invoice' }] }));
    expect(await links('r_photos')).toEqual([['m1', 'before'], ['m2', 'after'], ['m3', 'invoice']]);
    await saveServiceRecord(repair({ id: 'r_photos', media: [{ mediaId: 'm1', role: 'before' }, { mediaId: 'm3', role: 'other' }] }));
    expect(await links('r_photos')).toEqual([['m1', 'before'], ['m3', 'other']]);
  });

  it('omitting media leaves the links alone', async () => {
    await saveServiceRecord(repair({ id: 'r_photos', title: 'otra vez' }));
    expect(await links('r_photos')).toEqual([['m1', 'before'], ['m3', 'other']]);
  });
});

describe('closing a Pendiente (X7)', () => {
  const event = (id: string, pending: string) =>
    milestones.upsert({
      id,
      vehicleId: 'v1',
      kind: 'otro',
      eventType: 'accidente',
      occurredAt: '2026-08-01T12:00:00.000Z',
      title: 'Choque',
      pending,
      resolvedAt: null,
      linkedServiceId: null,
    } as never);

  it('lists open events and open tasks, not resolved ones', async () => {
    await event('ev_open', 'Desabollar y pintar');
    await event('ev_done', '');
    await tasks.upsert({ id: 'tk_open', vehicleId: 'v1', title: 'Cambiar el agua por coolant', kind: 'reparacion', priority: 'normal', status: 'pendiente', notes: '' } as never);
    await tasks.upsert({ id: 'tk_done', vehicleId: 'v1', title: 'Ya hecha', kind: 'reparacion', priority: 'normal', status: 'hecha', notes: '' } as never);
    const keys = (await listOpenPendings('v1')).map((p) => p.key).sort();
    expect(keys).toEqual(['event:ev_open', 'task:tk_open']);
  });

  it('resolving an event stamps resolvedAt and links the repair; undo puts it back', async () => {
    const result = await saveServiceRecord(repair({ id: 'r_close_ev', resolve: { kind: 'event', id: 'ev_open' } }));
    const closed = await milestones.getById('ev_open');
    expect(closed?.resolvedAt).toBeTruthy();
    expect(closed?.linkedServiceId).toBe('r_close_ev');
    expect(result.resolved).toMatchObject({ kind: 'event', id: 'ev_open', title: 'Desabollar y pintar' });
    expect((await listOpenPendings('v1')).some((p) => p.id === 'ev_open')).toBe(false);

    await undoResolvedPending(result.resolved!);
    const reopened = await milestones.getById('ev_open');
    expect(reopened?.resolvedAt).toBeNull();
    expect(reopened?.linkedServiceId).toBeNull();
    expect((await listOpenPendings('v1')).some((p) => p.id === 'ev_open')).toBe(true);
    // the repair itself stays
    expect(await serviceRecords.getById('r_close_ev')).toBeTruthy();
  });

  it('resolving a task closes it with the record; undo reopens it', async () => {
    const result = await saveServiceRecord(repair({ id: 'r_close_tk', resolve: { kind: 'task', id: 'tk_open' } }));
    expect(await tasks.getById('tk_open')).toMatchObject({ status: 'hecha', doneRecordId: 'r_close_tk' });
    await undoResolvedPending(result.resolved!);
    expect(await tasks.getById('tk_open')).toMatchObject({ status: 'pendiente', doneRecordId: null });
  });

  it('a task that is also the source task closes once, with no undo needed', async () => {
    const result = await saveServiceRecord(repair({ id: 'r_src', sourceTaskId: 'tk_open', resolve: { kind: 'task', id: 'tk_open' } }));
    expect(result.resolved).toBeUndefined();
    expect(await tasks.getById('tk_open')).toMatchObject({ status: 'hecha', doneRecordId: 'r_src' });
  });

  it('no resolve, nothing touched', async () => {
    await event('ev_untouched', 'Cambiar espejo');
    const result = await saveServiceRecord(repair({ id: 'r_plain' }));
    expect(result.resolved).toBeUndefined();
    expect((await milestones.getById('ev_untouched'))?.resolvedAt).toBeNull();
  });
});
