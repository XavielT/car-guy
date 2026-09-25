import {
  completeLegal,
  completeReminder,
  describeReset,
  remindersForServiceItems,
  resetForServiceItems,
} from '@/lib/domain/reminders';
import type { Reminder } from '@/lib/db/types';

/**
 * The reset rules from 01-data-model.md §3.2. These decide when the app next
 * nags, so getting them wrong is either a missed oil change or a reminder that
 * cries wolf.
 */

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();

function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    vehicleId: 'v1',
    title: 'Aceite de motor',
    serviceTypeId: 'aceite_motor',
    legalKind: null,
    metric: 'both',
    dueDate: iso(2026, 10, 1),
    dueKm: 55_000,
    isRecurring: true,
    intervalMonths: 6,
    intervalDays: null,
    intervalKm: 5_000,
    fixedInterval: false,
    thresholdDays: null,
    thresholdKm: null,
    notes: '',
    lastCompletedAt: null,
    lastCompletedKm: null,
    lastCompletedRecordId: null,
    snoozedUntil: null,
    isEnabled: true,
    createdAt: iso(2026, 1, 1),
    updatedAt: iso(2026, 1, 1),
    deletedAt: null,
    syncedAt: null,
    ...over,
  };
}

const DONE = { date: iso(2026, 9, 17), km: 52_000, recordId: 'rec1' };

describe('completeReminder', () => {
  it('counts the next km from the odometer at completion, not from the old due', () => {
    const patch = completeReminder(reminder(), DONE);
    // 52,000 now + 5,000 interval. Anchoring on the old 55,000 would push the
    // next change 3,000 km further out every time you serviced early.
    expect(patch.dueKm).toBe(57_000);
  });

  it('counts the next date from the completion date for a normal interval', () => {
    const patch = completeReminder(reminder(), DONE);
    expect(patch.dueDate).toBe(iso(2027, 3, 17));
  });

  it('records what completed it and clears any snooze', () => {
    const patch = completeReminder(reminder({ snoozedUntil: iso(2026, 10, 1) }), DONE);
    expect(patch.lastCompletedAt).toBe(DONE.date);
    expect(patch.lastCompletedKm).toBe(52_000);
    expect(patch.lastCompletedRecordId).toBe('rec1');
    expect(patch.snoozedUntil).toBeNull();
  });

  it('anchors a fixed interval to the old due date, not to when it was done', () => {
    // The marbete is due 31 January whether you paid in December or on the day.
    const marbete = reminder({
      title: 'Marbete',
      serviceTypeId: null,
      legalKind: 'marbete',
      metric: 'date',
      dueDate: iso(2027, 1, 31),
      dueKm: null,
      intervalKm: null,
      intervalMonths: 12,
      fixedInterval: true,
    });
    const patch = completeReminder(marbete, { date: iso(2026, 12, 3) });
    expect(patch.dueDate).toBe(iso(2028, 1, 31));
  });

  it('supports day intervals as well as months', () => {
    const weekly = reminder({ intervalMonths: null, intervalDays: 7, intervalKm: null });
    expect(completeReminder(weekly, DONE).dueDate).toBe(iso(2026, 9, 24));
  });

  it('disables a one-off reminder instead of re-arming it', () => {
    const patch = completeReminder(reminder({ isRecurring: false }), DONE);
    expect(patch.isEnabled).toBe(false);
    expect(patch.lastCompletedAt).toBe(DONE.date);
  });

  it('keeps the old due km when the odometer is unknown', () => {
    const patch = completeReminder(reminder(), { date: DONE.date });
    expect(patch.dueKm).toBe(60_000); // 55,000 old due + 5,000
    expect(patch.lastCompletedKm).toBeNull();
  });

  it('leaves a date-only reminder without a km due', () => {
    const dateOnly = reminder({ metric: 'date', dueKm: null, intervalKm: null });
    expect(completeReminder(dateOnly, DONE).dueKm).toBeNull();
  });
});

describe('remindersForServiceItems', () => {
  const rows = [
    reminder({ id: 'oil', serviceTypeId: 'aceite_motor' }),
    reminder({ id: 'air', serviceTypeId: 'filtro_aire', title: 'Filtro de aire' }),
    reminder({ id: 'tyres', serviceTypeId: 'rotacion_gomas', title: 'Rotación de gomas' }),
    reminder({ id: 'off', serviceTypeId: 'aceite_motor', isEnabled: false }),
    reminder({ id: 'legal', serviceTypeId: null, legalKind: 'marbete', title: 'Marbete' }),
  ];

  it('matches only the catalog items that were actually done', () => {
    const hit = remindersForServiceItems(rows, ['aceite_motor', 'filtro_aire']);
    expect(hit.map((r) => r.id).sort()).toEqual(['air', 'oil']);
  });

  it('never re-arms a reminder the user disabled', () => {
    // Turning a reminder off is a decision; changing the oil should not undo it.
    const hit = remindersForServiceItems(rows, ['aceite_motor']);
    expect(hit.map((r) => r.id)).toEqual(['oil']);
  });

  it('leaves unrelated reminders alone', () => {
    const hit = remindersForServiceItems(rows, ['aceite_motor']);
    expect(hit.some((r) => r.id === 'tyres' || r.id === 'legal')).toBe(false);
  });

  it('returns nothing when the visit had no catalog items', () => {
    expect(remindersForServiceItems(rows, [])).toEqual([]);
  });
});

describe('resetForServiceItems', () => {
  it('produces one patch per matched reminder', () => {
    const rows = [
      reminder({ id: 'oil', serviceTypeId: 'aceite_motor' }),
      reminder({ id: 'air', serviceTypeId: 'filtro_aire', intervalKm: 20_000, intervalMonths: 12 }),
    ];
    const resets = resetForServiceItems(rows, ['aceite_motor', 'filtro_aire'], DONE);
    expect(resets).toHaveLength(2);
    expect(resets.find((r) => r.reminder.id === 'oil')!.patch.dueKm).toBe(57_000);
    expect(resets.find((r) => r.reminder.id === 'air')!.patch.dueKm).toBe(72_000);
  });
});

describe('completeLegal', () => {
  const marbete = reminder({
    id: 'marbete',
    title: 'Marbete',
    serviceTypeId: null,
    legalKind: 'marbete',
    metric: 'date',
    dueDate: iso(2027, 1, 31),
    dueKm: null,
    intervalKm: null,
    intervalMonths: 12,
    // Deliberately wrong in the row: the rule must not trust it.
    fixedInterval: false,
  });

  it('re-arms the matching legal reminder from its deadline, not the payment date', () => {
    const resets = completeLegal([marbete], 'marbete', { date: iso(2026, 12, 3) });
    expect(resets).toHaveLength(1);
    expect(resets[0].patch.dueDate).toBe(iso(2028, 1, 31));
  });

  it('lands on the same deadline when the same payment is recorded twice', () => {
    // Found in QA: two marbete expenses on one day gave 31 ene 2029, skipping a season.
    const first = completeLegal([marbete], 'marbete', { date: iso(2026, 12, 3) })[0].patch;
    const renewed = { ...marbete, ...first } as typeof marbete;
    expect(completeLegal([renewed], 'marbete', { date: iso(2026, 12, 3) })).toEqual([]);
  });

  it.each([
    ['in the window before the deadline', iso(2026, 11, 2), iso(2028, 1, 31)],
    ['in January, before the deadline', iso(2027, 1, 20), iso(2028, 1, 31)],
    ['late, after the deadline passed', iso(2027, 3, 10), iso(2028, 1, 31)],
  ])('a payment %s covers that season', (_label, paidOn, due) => {
    expect(completeLegal([marbete], 'marbete', { date: paidOn })[0].patch.dueDate).toBe(due);
  });

  it('ignores other legal kinds and other vehicles reminders', () => {
    const seguro = reminder({ id: 'seguro', legalKind: 'seguro', serviceTypeId: null });
    expect(completeLegal([marbete, seguro], 'marbete', DONE).map((r) => r.reminder.id)).toEqual([
      'marbete',
    ]);
  });

  it('does nothing when there is no legal reminder to complete', () => {
    expect(completeLegal([], 'marbete', DONE)).toEqual([]);
  });
});

describe('describeReset', () => {
  it('reads as the sentence shown after saving', () => {
    const r = reminder();
    expect(describeReset(r, completeReminder(r, DONE))).toContain('Aceite de motor →');
    expect(describeReset(r, completeReminder(r, DONE))).toContain('57,000 km');
  });

  it('says "listo" for a one-off that is now closed', () => {
    const once = reminder({ isRecurring: false, title: 'Cambiar bujías' });
    expect(describeReset(once, completeReminder(once, DONE))).toBe('Cambiar bujías → listo');
  });
});
