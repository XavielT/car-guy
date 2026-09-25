import {
  bySeverity,
  displayDueDate,
  evaluate,
  mergeAttention,
  needsAttention,
  retargetInterval,
} from '@/lib/domain/reminders';
import type { Reminder } from '@/lib/db/types';

/**
 * The urgency engine (01-data-model.md §3.2). Every branch matters: a state that
 * reads "ok" when something is actually due is the exact failure this app was
 * built to prevent.
 */

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const TODAY = iso(2026, 9, 18);

function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    vehicleId: 'v1',
    title: 'Aceite de motor',
    serviceTypeId: 'aceite_motor',
    legalKind: null,
    metric: 'date',
    dueDate: null,
    dueKm: null,
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
    createdAt: TODAY,
    updatedAt: TODAY,
    deletedAt: null,
    syncedAt: null,
    ...over,
  };
}

const ctx = (over: Partial<Parameters<typeof evaluate>[1]> = {}) => ({
  today: TODAY,
  currentKm: 50_000,
  kmPerDay: 40,
  confidence: 'buena' as const,
  ...over,
});

describe('evaluate — date only', () => {
  const dateReminder = (dueDate: string) => reminder({ metric: 'date', dueDate });

  it('is ok well before the due date', () => {
    const s = evaluate(dateReminder(iso(2026, 12, 1)), ctx());
    expect(s.status).toBe('ok');
    expect(s.dueDays).toBe(74);
  });

  it('turns próximo at 30 days and stays ok at 31', () => {
    expect(evaluate(dateReminder(iso(2026, 10, 18)), ctx()).status).toBe('proximo');
    expect(evaluate(dateReminder(iso(2026, 10, 19)), ctx()).status).toBe('ok');
  });

  it('turns urgente at 7 days and is still próximo at 8', () => {
    expect(evaluate(dateReminder(iso(2026, 9, 25)), ctx()).status).toBe('urgente');
    expect(evaluate(dateReminder(iso(2026, 9, 26)), ctx()).status).toBe('proximo');
  });

  it('is urgente on the day itself and vencido the day after', () => {
    expect(evaluate(dateReminder(TODAY), ctx()).status).toBe('urgente');
    expect(evaluate(dateReminder(iso(2026, 9, 17)), ctx()).status).toBe('vencido');
  });

  it('reports what triggered it', () => {
    expect(evaluate(dateReminder(iso(2026, 9, 17)), ctx()).triggeredBy).toBe('fecha');
  });
});

describe('evaluate — legal items warn earlier', () => {
  it('uses 45 and 14 days instead of 30 and 7', () => {
    const marbete = reminder({ legalKind: 'marbete', metric: 'date', dueDate: iso(2026, 11, 1) });
    // 44 days out: próximo for a legal item, ok for anything else.
    expect(evaluate(marbete, ctx()).status).toBe('proximo');
    expect(evaluate({ ...marbete, legalKind: null }, ctx()).status).toBe('ok');

    const soon = reminder({ legalKind: 'marbete', metric: 'date', dueDate: iso(2026, 9, 30) });
    expect(evaluate(soon, ctx()).status).toBe('urgente');
  });
});

describe('evaluate — km only, with prediction', () => {
  const kmReminder = (dueKm: number) => reminder({ metric: 'km', dueKm, intervalKm: 5_000 });

  it('scales próximo to a tenth of the interval', () => {
    // 10% of 5,000 = 500 km.
    expect(evaluate(kmReminder(50_400), ctx()).status).toBe('proximo');
    expect(evaluate(kmReminder(50_600), ctx()).status).toBe('ok');
  });

  it('clamps the próximo window for very long intervals', () => {
    // 10% of 40,000 would be 4,000 km; the clamp keeps it at 1,000.
    const long = reminder({ metric: 'km', dueKm: 51_500, intervalKm: 40_000 });
    expect(evaluate(long, ctx()).status).toBe('ok');
    expect(evaluate({ ...long, dueKm: 50_900 }, ctx()).status).toBe('proximo');
  });

  it('turns urgente inside 100 km and vencido past zero', () => {
    expect(evaluate(kmReminder(50_050), ctx()).status).toBe('urgente');
    expect(evaluate(kmReminder(49_900), ctx()).status).toBe('vencido');
    expect(evaluate(kmReminder(49_900), ctx()).dueKm).toBe(-100);
  });

  it('predicts the date from the vehicle own pace', () => {
    // 400 km to go at 40 km/day = 10 days.
    const s = evaluate(kmReminder(50_400), ctx());
    expect(s.predictedDueDate).toBe(iso(2026, 9, 28));
  });

  it('falls back to 35 km/day when the pace is unknown', () => {
    const s = evaluate(kmReminder(50_350), ctx({ kmPerDay: undefined, confidence: 'baja' }));
    expect(s.predictedDueDate).toBe(iso(2026, 9, 28));
    expect(s.confidence).toBe('baja');
  });

  it('does not predict a date for something already overdue', () => {
    expect(evaluate(kmReminder(49_000), ctx()).predictedDueDate).toBeNull();
  });

  it('carries the confidence through so the UI can hedge', () => {
    expect(evaluate(kmReminder(50_400), ctx({ confidence: 'estimada' })).confidence).toBe('estimada');
  });
});

describe('evaluate — both metrics', () => {
  it('takes the worse of the two and says which', () => {
    // Date is months away; km is 50 away.
    const both = reminder({
      metric: 'both',
      dueDate: iso(2027, 3, 1),
      dueKm: 50_050,
      intervalKm: 5_000,
    });
    const s = evaluate(both, ctx());
    expect(s.status).toBe('urgente');
    expect(s.triggeredBy).toBe('km');
  });

  it('works the other way round too', () => {
    const both = reminder({
      metric: 'both',
      dueDate: iso(2026, 9, 19),
      dueKm: 60_000,
      intervalKm: 5_000,
    });
    const s = evaluate(both, ctx());
    expect(s.status).toBe('urgente');
    expect(s.triggeredBy).toBe('fecha');
  });

  it('is sin_datos when one half is missing and the other is fine', () => {
    const half = reminder({ metric: 'both', dueDate: iso(2027, 3, 1), dueKm: null });
    expect(evaluate(half, ctx()).status).toBe('sin_datos');
  });

  it('still reports a real problem even when the other half is missing', () => {
    const half = reminder({ metric: 'both', dueDate: iso(2026, 9, 1), dueKm: null });
    expect(evaluate(half, ctx()).status).toBe('vencido');
  });
});

describe('evaluate — sin_datos', () => {
  it('says so when a km reminder has no odometer reading to compare against', () => {
    const km = reminder({ metric: 'km', dueKm: 55_000 });
    const s = evaluate(km, ctx({ currentKm: null }));
    expect(s.status).toBe('sin_datos');
    expect(s.dueKm).toBeNull();
  });

  it('says so for a legal reminder whose date the user has not entered', () => {
    // Exactly the seeded "Seguro": it cannot know when your policy expires.
    const seguro = reminder({ legalKind: 'seguro', metric: 'date', dueDate: null });
    expect(evaluate(seguro, ctx()).status).toBe('sin_datos');
  });
});

describe('evaluate — snooze', () => {
  const overdue = reminder({ metric: 'date', dueDate: iso(2026, 9, 1) });

  it('hides the state until the snooze runs out', () => {
    const s = evaluate({ ...overdue, snoozedUntil: iso(2026, 9, 25) }, ctx());
    expect(s.status).toBe('ok');
    expect(s.snoozed).toBe(true);
    // The real numbers stay visible so a report can still say "pospuesto".
    expect(s.dueDays).toBe(-17);
  });

  it('stops hiding once the snooze date passes', () => {
    const s = evaluate({ ...overdue, snoozedUntil: iso(2026, 9, 10) }, ctx());
    expect(s.status).toBe('vencido');
    expect(s.snoozed).toBe(false);
  });
});

describe('displayDueDate', () => {
  it('shows whichever limit arrives first', () => {
    const both = reminder({ metric: 'both', dueDate: iso(2027, 3, 1), dueKm: 50_400, intervalKm: 5_000 });
    const s = evaluate(both, ctx());
    // Predicted 28 Sep beats the March date.
    expect(displayDueDate(both, s)).toBe(iso(2026, 9, 28));
  });

  it('falls back to whichever one exists', () => {
    const dateOnly = reminder({ metric: 'date', dueDate: iso(2026, 12, 1) });
    expect(displayDueDate(dateOnly, evaluate(dateOnly, ctx()))).toBe(iso(2026, 12, 1));
  });
});

describe('bySeverity', () => {
  it('sorts vencido → urgente → próximo → sin datos → ok, soonest first', () => {
    const make = (dueDate: string | null, dueKm: number | null = null) => {
      const r = reminder({ metric: dueDate ? 'date' : 'km', dueDate, dueKm });
      return { r, status: evaluate(r, ctx()) };
    };
    const rows = [
      make(iso(2026, 12, 1)), // ok
      make(iso(2026, 9, 1)), // vencido
      make(iso(2026, 10, 10)), // proximo
      make(null, null), // sin_datos
      make(iso(2026, 9, 20)), // urgente
    ];
    const order = [...rows].sort(bySeverity).map((x) => x.status.status);
    expect(order).toEqual(['vencido', 'urgente', 'proximo', 'sin_datos', 'ok']);
  });
});

describe('legal thresholds per kind', () => {
  it('licencia warns at 60 and turns urgent at 30 days', () => {
    const lic = (dueDate: string) => reminder({ legalKind: 'licencia', metric: 'date', dueDate });
    expect(evaluate(lic(iso(2026, 11, 20)), ctx()).status).toBe('ok'); // 63 days
    expect(evaluate(lic(iso(2026, 11, 15)), ctx()).status).toBe('proximo'); // 58 days
    expect(evaluate(lic(iso(2026, 10, 16)), ctx()).status).toBe('urgente'); // 28 days
  });

  it('seguro keeps 45/14', () => {
    const seg = (dueDate: string) => reminder({ legalKind: 'seguro', metric: 'date', dueDate });
    expect(evaluate(seg(iso(2026, 11, 20)), ctx()).status).toBe('ok');
    expect(evaluate(seg(iso(2026, 10, 20)), ctx()).status).toBe('proximo'); // 32 days
    expect(evaluate(seg(iso(2026, 9, 30)), ctx()).status).toBe('urgente'); // 12 days
  });
});

describe('bySeverity — within a group', () => {
  it('orders a km-only reminder by its predicted date, not last', () => {
    // 40 km/day: 1,000 km left is ~25 days; the date one is 28 days out.
    const km = reminder({ id: 'km', metric: 'km', dueKm: 51_000, intervalKm: 10_000 });
    const date = reminder({ id: 'date', metric: 'date', dueDate: iso(2026, 10, 16) });
    const rows = [date, km].map((r) => ({ reminder: r, status: evaluate(r, ctx()) }));
    expect(rows.every((r) => r.status.status === 'proximo')).toBe(true);
    expect([...rows].sort(bySeverity).map((r) => r.reminder.id)).toEqual(['km', 'date']);
  });
});

describe('needsAttention / mergeAttention', () => {
  const ev = (over: Partial<Reminder>) => {
    const r = reminder(over);
    return { reminder: r, status: evaluate(r, ctx()) };
  };

  it('leaves sin datos off the home row', () => {
    expect(needsAttention(ev({ legalKind: 'seguro', dueDate: null }).status)).toBe(false);
    expect(needsAttention(ev({ dueDate: iso(2026, 9, 1) }).status)).toBe(true);
    expect(needsAttention(ev({ dueDate: iso(2027, 9, 1) }).status)).toBe(false);
  });

  it('puts a critical task first, a normal one after urgent reminders', () => {
    const vencido = ev({ id: 'v', dueDate: iso(2026, 9, 1) });
    const urgente = ev({ id: 'u', dueDate: iso(2026, 9, 20) });
    const proximo = ev({ id: 'p', dueDate: iso(2026, 10, 10) });
    const sinDatos = ev({ id: 's', legalKind: 'seguro', dueDate: null });
    const merged = mergeAttention(
      [vencido, urgente, proximo, sinDatos],
      [
        { id: 'tn', priority: 'normal' as const },
        { id: 'tc', priority: 'critica' as const },
      ],
      10,
    );
    expect(merged.map((m) => (m.kind === 'task' ? m.item.id : m.item.reminder.id))).toEqual([
      'tc',
      'v',
      'u',
      'tn',
      'p',
    ]);
  });

  it('caps at the limit', () => {
    const many = Array.from({ length: 6 }, (_, i) => ev({ id: `r${i}`, dueDate: iso(2026, 9, 1) }));
    expect(mergeAttention(many, [], 4)).toHaveLength(4);
  });
});

describe('retargetInterval', () => {
  it('moves a reminder still on the old default, keeping its anchor', () => {
    const r = reminder({
      metric: 'both',
      intervalKm: 5_000,
      intervalMonths: 6,
      lastCompletedKm: 45_000,
      lastCompletedAt: iso(2026, 6, 1),
      dueKm: 50_000,
      dueDate: iso(2026, 12, 1),
    });
    const patch = retargetInterval(r, { km: 5_000, months: 6 }, { km: 8_000, months: 4 });
    expect(patch).toEqual({ intervalKm: 8_000, dueKm: 53_000, intervalMonths: 4, dueDate: iso(2026, 10, 1) });
  });

  it('falls back to due minus old interval when never completed', () => {
    const r = reminder({ metric: 'km', intervalKm: 5_000, dueKm: 55_000, intervalMonths: null });
    expect(retargetInterval(r, { km: 5_000, months: null }, { km: 7_000, months: null })).toEqual({
      intervalKm: 7_000,
      dueKm: 57_000,
    });
  });

  it('leaves a customised interval alone', () => {
    const r = reminder({ intervalKm: 7_500, intervalMonths: 6, dueKm: 55_000 });
    expect(retargetInterval(r, { km: 5_000, months: 6 }, { km: 8_000, months: 6 })).toBeNull();
  });
});
