/**
 * sql/032: "Lo que uso" on the public page. The phone words the rows and publishes them with the share
 * (vehicle_share.memory_summary) — spec-sheet rows only: never free facts, Papeles or "where I buy".
 */
import type { TestDb } from '../helpers/sqlite';
import { vehicleShares } from '@/lib/db/repos';
import { saveBuyFields, saveFact } from '@/lib/db/memoryQueries';
import { DEFAULT_FLAGS, localRawDossier, memorySummaryText, publicMemoryRows, refreshShareSummaries } from '@/lib/db/shareQueries';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const T = '2026-09-01T12:00:00.000Z';

beforeAll(async () => {
  db.prepare(`INSERT INTO vehicle (id, name, default_fuel_type, created_at, updated_at) VALUES ('v', 'DS3', 'regular', ?, ?)`).run(T, T);
  await saveBuyFields('v', { oilBrand: 'Motul', oilProduct: '8100 X-clean 5W-30', airFilterPn: 'C 2672', whereBought: 'Repuestos Don Pedro 809-555-0101' });
  await saveFact({ vehicleId: 'v', label: 'Código de radio', value: '4821', groupName: 'electrico' });
  await saveFact({ vehicleId: 'v', label: 'Póliza', value: 'POL-123456', groupName: 'papeles' });
});

const stored = () => (db.prepare(`SELECT memory_summary FROM vehicle_share WHERE id = 'share_v'`).get() as { memory_summary: string | null }).memory_summary;

describe('publicMemoryRows', () => {
  it('keeps spec-sheet rows and drops free facts, Papeles and where I buy', () => {
    const rows = [
      { key: 'oilBrand', section: 'aceite', source: 'ficha' as const },
      { key: 'fact:1', section: 'electrico', source: 'dato' as const },
      { key: 'fact:2', section: 'papeles', source: 'dato' as const },
      { key: 'whereBought', section: 'otros', source: 'ficha' as const },
    ];
    expect(publicMemoryRows(rows).map((r) => r.key)).toEqual(['oilBrand']);
  });
});

describe('memorySummaryText', () => {
  it('is null while the switch is off', async () => {
    expect(await memorySummaryText('v', false)).toBeNull();
  });

  it('with the switch on: the oil and the filter, worded, and nothing private', async () => {
    const text = (await memorySummaryText('v', true))!;
    const rows = JSON.parse(text) as { section: string; label: string; value: string; source: string }[];
    expect(rows.map((r) => r.value)).toEqual(expect.arrayContaining(['Motul', '8100 X-clean 5W-30', 'C 2672']));
    expect(rows.every((r) => r.source === 'ficha')).toBe(true);
    expect(text).not.toMatch(/4821|POL-123456|Don Pedro|809-555/);
    expect(text).not.toMatch(/"key"/);
  });
});

describe('the preview and the book', () => {
  it('the share preview shows the page subset; the book prints every row', async () => {
    const preview = await localRawDossier('v', { ...DEFAULT_FLAGS, memory: true });
    expect(JSON.stringify(preview!.memory)).not.toMatch(/4821|POL-123456|Don Pedro/);
    expect(preview!.memory!.some((r) => r.value === 'Motul')).toBe(true);
    const book = await localRawDossier('v', DEFAULT_FLAGS, { memory: true });
    expect(JSON.stringify(book!.memory)).toMatch(/4821/);
    const off = await localRawDossier('v', DEFAULT_FLAGS);
    expect(off!.memory ?? null).toBeNull();
  });
});

describe('refreshShareSummaries', () => {
  it('publishes the rows for a live share with the switch on, follows a change, clears when off', async () => {
    await vehicleShares.upsert({ id: 'share_v', vehicleId: 'v', visibility: 'link', slug: 'ab3cdefg', publishedAt: T, showMemory: true, deletedAt: null });
    expect(await refreshShareSummaries()).toBe(1);
    expect(stored()).toMatch(/Motul/);
    expect(await refreshShareSummaries()).toBe(0);
    await saveBuyFields('v', { oilBrand: 'Mobil 1' });
    expect(await refreshShareSummaries()).toBe(1);
    expect(stored()).toMatch(/Mobil 1/);
    await vehicleShares.upsert({ id: 'share_v', showMemory: false });
    await refreshShareSummaries();
    expect(stored()).toBeNull();
  });
});
