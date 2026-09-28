/**
 * The build log against a real SQLite with the real-garage seed (IMP 28092026
 * Phase 4): the AE85's derived ficha and its source chips, a mod save with its
 * odometer reading, the wishlist conversion, the lifecycle, and mounting a set.
 */
import type { TestDb } from '../helpers/sqlite';
import { buildData, mountWheelSet, modAction, saveMod, saveTire, saveWheelSet, setOverride } from '@/lib/db/buildQueries';
import { seedCatalog } from '@/lib/db/seed';
import { spendRows } from '@/lib/db/statsQueries';
import { jsonObject } from '@/lib/domain/album';
import { currentSpecs, investedTotal, wishlistToModDraft } from '@/lib/domain/build';
import { GARAGE_IDS, seedRealGarage } from '@/lib/dev/garage';

jest.mock('@/lib/db/client', () => {
  const helpers = require('../helpers/sqlite');
  const testDb = helpers.createTestDb();
  return { ...helpers.clientModule(testDb), testDb };
});
const db = (jest.requireMock('@/lib/db/client') as { testDb: TestDb }).testDb.sqlite;
const row = (sql: string, ...p: string[]) => db.prepare(sql).get(...p) as Record<string, unknown>;
const AE85 = GARAGE_IDS.ae85;

/** The chip the SPECS tab shows for a field. */
async function chips(): Promise<Record<string, string>> {
  const data = await buildData(AE85);
  const current = currentSpecs(jsonObject(data.sheet?.stock), data.mods, jsonObject(data.sheet?.overrides));
  return Object.fromEntries(
    Object.entries(current).map(([k, c]) => [k, `${c.stock ?? '—'} → ${c.value} [${c.source?.kind === 'mod' ? c.source.modName : c.source?.kind === 'override' ? 'TÚ' : 'STOCK'}]`]),
  );
}

beforeAll(async () => {
  await seedCatalog();
  await seedRealGarage(new Date(2026, 8, 28));
});

it('the seed derives the AE85 ficha with a source per field', async () => {
  expect(await chips()).toMatchObject({
    engine_code: '3A-U → 4A-GE 20V [Swap 4A-GE 20V]',
    hp: '— → 160 [Swap 4A-GE 20V]',
    ecu: '— → tuneada (pops and bangs) [ECU tuneada]',
    wheel_f: '13x5 → 15x8 ET0 [Aros 15x8 ET0]',
    tire_f: '— → 195/50R15 [Gomas 195/50R15]',
  });
});

it('an override is TÚ and clearing it returns the mod value', async () => {
  await setOverride(AE85, 'hp', '172');
  expect((await chips()).hp).toBe('— → 172 [TÚ]');
  await setOverride(AE85, 'hp', null);
  expect((await chips()).hp).toBe('— → 160 [Swap 4A-GE 20V]');
});

it('converting the wishlist coilovers installs a mod, writes the odometer and closes the item', async () => {
  const data = await buildData(AE85);
  const wish = data.wishlist.find((w) => w.id === 'dev_wish_coilovers')!;
  const draft = wishlistToModDraft(wish, 60);
  const saved = await saveMod({
    ...draft,
    vehicleId: AE85,
    categoryId: draft.categoryId!,
    name: draft.name!,
    installedAt: '2026-09-20T12:00:00.000Z',
    installedKm: 52_700,
    costCustomsDop: 9_000,
    affectsSpecs: true,
    specEffects: JSON.stringify({ suspension: 'Coilovers BC BR', ride_height: '-40 mm', nope: 1 }),
  });
  expect(row("SELECT status, converted_mod_id FROM wishlist_item WHERE id = 'dev_wish_coilovers'")).toEqual({ status: 'convertido', converted_mod_id: saved.id });
  expect(row('SELECT value_km, source, source_id FROM odometer_reading WHERE id = ?', `odo_mod_${saved.id}`)).toEqual({ value_km: 52_700, source: 'mod', source_id: saved.id });
  // Unknown spec keys never reach the row.
  expect(JSON.parse(row('SELECT spec_effects FROM mod WHERE id = ?', saved.id).spec_effects as string)).toEqual({ suspension: 'Coilovers BC BR', ride_height: '-40 mm' });
  expect((await chips()).suspension).toBe('— → Coilovers BC BR [Coilovers BC Racing BR]');
  // The rate is remembered for the next foreign price.
  expect(row("SELECT value FROM setting WHERE key = 'last_fx_rate_usd'")).toEqual({ value: '60' });
});

it('removing keeps the mod in the history and in the money; the ficha falls back', async () => {
  const before = investedTotal((await buildData(AE85)).mods);
  await modAction('dev_mod_aros', { kind: 'quitar', at: '2026-09-25T12:00:00.000Z' });
  const data = await buildData(AE85);
  expect(data.mods.find((m) => m.id === 'dev_mod_aros')).toMatchObject({ status: 'quitado', removedAt: '2026-09-25T12:00:00.000Z' });
  expect(investedTotal(data.mods)).toBe(before);
  expect((await chips()).wheel_f).toBe('13x5 → 13x5 [STOCK]');
  expect(row("SELECT COUNT(*) AS n FROM history_feed WHERE id = 'dev_mod_aros'")).toEqual({ n: 1 });
  expect(row("SELECT subtitle FROM history_feed WHERE id = 'dev_mod_aros'").subtitle).toMatch(/^quitado\|/);
  await modAction('dev_mod_aros', { kind: 'reinstalar' });
  expect((await chips()).wheel_f).toBe('13x5 → 15x8 ET0 [Aros 15x8 ET0]');
});

it('selling stores the sold price', async () => {
  await modAction('dev_mod_ecu', { kind: 'vender', at: '2026-09-26T12:00:00.000Z', priceDop: 5000, to: 'Un pana' });
  expect(row("SELECT status, sold_price_dop, sold_to FROM mod WHERE id = 'dev_mod_ecu'")).toEqual({ status: 'vendido', sold_price_dop: 5000, sold_to: 'Un pana' });
});

it('mounting a set takes the other one off and puts its tires on the corners', async () => {
  const track = await saveWheelSet({ vehicleId: AE85, name: 'Set pista', widthIn: 9, diamIn: 15, offsetMm: -5 });
  for (let i = 0; i < 4; i++) await saveTire({ vehicleId: AE85, wheelSetId: track.id, size: '205/50R15' });
  await mountWheelSet(track.id);
  const data = await buildData(AE85);
  expect(data.wheelSets.find((s) => s.id === 'dev_wheels_15x8')?.status).toBe('guardado');
  expect(data.wheelSets.find((s) => s.id === track.id)?.status).toBe('montado');
  expect(data.tires.filter((t) => t.wheelSetId === track.id).map((t) => t.position).sort()).toEqual(['fl', 'fr', 'rl', 'rr']);
  expect(data.tires.filter((t) => t.wheelSetId === 'dev_wheels_15x8').every((t) => t.position === 'unmounted')).toBe(true);
});

it('stats count new mods as mejora once, and skip the one migrated from a record', async () => {
  const rows = await spendRows(AE85);
  const mejoras = rows.filter((r) => r.category === 'mejora');
  // The radiator mod carries a service_record_id: its record counts, the mod does not.
  const radiator = row("SELECT total_dop FROM service_record WHERE id = (SELECT service_record_id FROM mod WHERE service_record_id IS NOT NULL LIMIT 1)");
  expect(mejoras.filter((r) => r.amountDop === radiator.total_dop)).toHaveLength(1);
  // The coilovers (63,000 + 0 + 9,000) are in.
  expect(mejoras.some((r) => r.amountDop === 72_000)).toBe(true);
});
