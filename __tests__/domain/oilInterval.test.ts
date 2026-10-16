/**
 * The oil reminder follows the vehicle's "¿Aceite sintético?" switch in both directions (IMP 16102026 N5):
 * the next due moves, the last change (date / km) never does.
 */
import { addMonths } from '@/lib/domain/dates';
import { CATALOG_OIL, oilReminderPatch, SYNTHETIC_KM, SYNTHETIC_MONTHS } from '@/lib/domain/oilInterval';

const seeded = {
  dueKm: 155_000 as number | null,
  dueDate: '2027-04-15T12:00:00.000Z' as string | null,
  intervalKm: 5000,
  intervalMonths: 6,
  lastCompletedKm: null as number | null,
  lastCompletedAt: null as string | null,
  notes: 'Sintético: 10,000 km / 12 meses',
};

describe('oilReminderPatch', () => {
  it('uses 10,000 km / 12 months for synthetic and counts from where the interval started', () => {
    const p = oilReminderPatch(seeded, true);
    expect(p).toMatchObject({ intervalKm: SYNTHETIC_KM, intervalMonths: SYNTHETIC_MONTHS, dueKm: 160_000 });
    expect(p.dueDate).toBe(addMonths('2026-10-15T12:00:00.000Z', 12));
  });

  it('counts from the last change when there is one', () => {
    const p = oilReminderPatch({ ...seeded, lastCompletedKm: 148_000, lastCompletedAt: '2026-09-01T12:00:00.000Z' }, true);
    expect(p.dueKm).toBe(158_000);
    expect(p.dueDate).toBe(addMonths('2026-09-01T12:00:00.000Z', 12));
  });

  it('turning it off goes back to the catalog interval, keeping the last change', () => {
    const syn = { ...seeded, intervalKm: SYNTHETIC_KM, intervalMonths: SYNTHETIC_MONTHS, dueKm: 158_000, lastCompletedKm: 148_000, lastCompletedAt: '2026-09-01T12:00:00.000Z' };
    const p = oilReminderPatch(syn, false);
    expect(p).toMatchObject({ intervalKm: CATALOG_OIL.km, intervalMonths: CATALOG_OIL.months, dueKm: 153_000 });
    expect(p.dueDate).toBe(addMonths('2026-09-01T12:00:00.000Z', CATALOG_OIL.months));
    expect(p.notes).toBe(CATALOG_OIL.notes);
  });

  it('leaves a missing side missing (a date-only reminder stays date-only)', () => {
    const p = oilReminderPatch({ ...seeded, dueKm: null }, true);
    expect(p.dueKm).toBeNull();
    expect(p.dueDate).toBeTruthy();
  });

  it('is idempotent', () => {
    const once = oilReminderPatch(seeded, true);
    const twice = oilReminderPatch({ ...seeded, ...once } as typeof seeded, true);
    expect(twice).toEqual(once);
  });
});
