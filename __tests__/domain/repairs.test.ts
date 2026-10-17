import type { ServiceRecord } from '@/lib/db/types';
import {
  applyRepairFilters,
  askForLabor,
  askForShop,
  isWarrantySoon,
  NO_REPAIR_FILTERS,
  repairShops,
  repairsOf,
  repairYears,
  summarizeByShop,
  totalSpent,
  warrantyChoiceOf,
  warrantyEnd,
  warrantyState,
} from '@/lib/domain/repairs';

const T = '2026-03-15T12:00:00.000Z';
const rec = (id: string, over: Partial<ServiceRecord>): ServiceRecord =>
  ({ id, vehicleId: 'v', kind: 'reparacion', occurredAt: T, title: id, description: '', odometerKm: null, costPartsDop: 0, costLaborDop: 0, totalDop: 0, shop: '', doneBy: 'shop', system: null, deletedAt: null, ...over }) as ServiceRecord;

describe('warranty', () => {
  it('counts the quick choices from the repair date', () => {
    expect(warrantyEnd('d30', T).slice(0, 10)).toBe('2026-04-14');
    expect(warrantyEnd('d90', T).slice(0, 10)).toBe('2026-06-13');
    expect(warrantyEnd('m6', T).slice(0, 10)).toBe('2026-09-15');
    expect(warrantyEnd('y1', T).slice(0, 10)).toBe('2027-03-15');
  });
  it('knows which quick choice a stored warranty is, so an edit shows it back', () => {
    expect(warrantyChoiceOf(T, null, null)).toBe('none');
    expect(warrantyChoiceOf(T, warrantyEnd('d90', T), null)).toBe('d90');
    expect(warrantyChoiceOf(T, '2026-12-25T12:00:00.000Z', null)).toBe('other');
    expect(warrantyChoiceOf(T, null, 5000)).toBe('other');
  });
  it('reports days left, today and days since', () => {
    const today = '2026-06-01T12:00:00.000Z';
    expect(warrantyState('2026-06-11T12:00:00.000Z', today)).toEqual({ state: 'active', days: 10 });
    expect(warrantyState('2026-06-01T12:00:00.000Z', today)).toEqual({ state: 'today', days: 0 });
    expect(warrantyState('2026-05-29T12:00:00.000Z', today)).toEqual({ state: 'expired', days: 3 });
    expect(warrantyState(null, today).state).toBe('none');
  });
  it('"por vencer" is the last two weeks of a running warranty', () => {
    const today = '2026-06-01T12:00:00.000Z';
    expect(isWarrantySoon('2026-06-10T12:00:00.000Z', today)).toBe(true);
    expect(isWarrantySoon('2026-06-01T12:00:00.000Z', today)).toBe(true);
    expect(isWarrantySoon('2026-08-01T12:00:00.000Z', today)).toBe(false);
    expect(isWarrantySoon('2026-05-01T12:00:00.000Z', today)).toBe(false);
    expect(isWarrantySoon(null, today)).toBe(false);
  });
});

describe('the repairs list', () => {
  const list = [
    rec('a', { occurredAt: '2026-03-15T12:00:00.000Z', shop: 'Taller de ejemplo', totalDop: 6000, system: 'frenos' }),
    rec('b', { occurredAt: '2025-11-02T12:00:00.000Z', shop: 'Taller de ejemplo', totalDop: 2000, system: 'motor' }),
    rec('c', { occurredAt: '2026-01-20T12:00:00.000Z', doneBy: 'self', shop: 'Taller de ejemplo', totalDop: 4500, system: 'electrico' }),
    rec('d', { occurredAt: '2026-02-01T12:00:00.000Z', shop: 'Otro taller', totalDop: 900 }),
    rec('maint', { kind: 'mantenimiento', totalDop: 9999 }),
    rec('gone', { deletedAt: T, totalDop: 7777 }),
  ];
  const repairs = repairsOf(list);

  it('keeps only live repairs, newest first', () => {
    expect(repairs.map((r) => r.id)).toEqual(['a', 'd', 'c', 'b']);
  });
  it('totals what was spent (maintenance and deleted ones do not count)', () => {
    expect(totalSpent(repairs)).toBe(13400);
  });
  it('summarises by shop: visits, spend, last visit — and own work is not a shop', () => {
    expect(summarizeByShop(repairs)).toEqual([
      { shop: 'Taller de ejemplo', visits: 2, spent: 8000, last: '2026-03-15T12:00:00.000Z' },
      { shop: 'Otro taller', visits: 1, spent: 900, last: '2026-02-01T12:00:00.000Z' },
    ]);
  });
  it('filters by system, shop and year, together', () => {
    expect(applyRepairFilters(repairs, { ...NO_REPAIR_FILTERS, system: 'frenos' }).map((r) => r.id)).toEqual(['a']);
    expect(applyRepairFilters(repairs, { ...NO_REPAIR_FILTERS, shop: 'Taller de ejemplo' }).map((r) => r.id)).toEqual(['a', 'b']);
    expect(applyRepairFilters(repairs, { ...NO_REPAIR_FILTERS, year: '2026' }).map((r) => r.id)).toEqual(['a', 'd', 'c']);
    expect(applyRepairFilters(repairs, { system: 'motor', shop: 'Taller de ejemplo', year: '2026' })).toEqual([]);
  });
  it('offers the years and shops that exist', () => {
    expect(repairYears(repairs)).toEqual(['2026', '2025']);
    expect(repairShops(repairs)).toEqual(['Otro taller', 'Taller de ejemplo']);
  });
});

describe('the form asks by who did it', () => {
  it('your own work has no shop and no labour', () => {
    expect(askForShop('self')).toBe(false);
    expect(askForLabor('self')).toBe(false);
    for (const who of ['shop', 'friend', 'other'] as const) {
      expect(askForShop(who)).toBe(true);
      expect(askForLabor(who)).toBe(true);
    }
  });
});
