import type { Reminder } from '@/lib/db/types';
import {
  atHour,
  firstAttentionDay,
  hasDuplicateIds,
  MAX_SCHEDULED,
  nextWeekday,
  planNotifications,
  type PlanInput,
} from '@/lib/notifications/plan';

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const TODAY = iso(2026, 9, 18);

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  today: TODAY,
  hour: 9,
  minute: 0,
  weeklyWeekday: 1, // Sunday
  reminders: [],
  templates: [],
  marbeteNudges: [],
  ...over,
});

describe('planNotifications — repeating checks', () => {
  const templates = [
    { id: 'carro_diario', name: 'Chequeo diario', cadence: 'diaria' as const, enabled: true },
    { id: 'carro_semanal', name: 'Chequeo semanal', cadence: 'semanal' as const, enabled: true },
    { id: 'carro_mensual', name: 'Chequeo mensual', cadence: 'mensual' as const, enabled: true },
  ];

  it('maps each cadence to its own trigger kind', () => {
    const plan = planNotifications(base({ templates }));
    expect(plan.map((p) => p.kind)).toEqual(['daily', 'weekly', 'monthly']);
  });

  it('puts the weekly one on the chosen weekday and the monthly on the 1st', () => {
    const plan = planNotifications(base({ templates, weeklyWeekday: 4 }));
    const weekly = plan.find((p) => p.kind === 'weekly')!;
    const monthly = plan.find((p) => p.kind === 'monthly')!;
    expect('weekday' in weekly && weekly.weekday).toBe(4);
    expect('day' in monthly && monthly.day).toBe(1);
  });

  it('honours the chosen hour', () => {
    const plan = planNotifications(base({ templates, hour: 7, minute: 30 }));
    expect(plan.every((p) => 'hour' in p && p.hour === 7 && p.minute === 30)).toBe(true);
  });

  it('skips disabled templates', () => {
    const plan = planNotifications(base({ templates: templates.map((t) => ({ ...t, enabled: false })) }));
    expect(plan).toHaveLength(0);
  });

  it('never schedules the manual cadences', () => {
    const plan = planNotifications(
      base({
        templates: [
          { id: 'moto', name: 'T-CLOCS', cadence: 'antes_de_viaje', enabled: true },
          { id: 'x', name: 'Cuando quieras', cadence: 'manual', enabled: true },
        ],
      }),
    );
    expect(plan).toHaveLength(0);
  });

  it('deep-links to the runner', () => {
    const plan = planNotifications(base({ templates: [templates[1]] }));
    expect(plan[0].route).toBe('/chequeo/carro_semanal/run');
  });
});

describe('planNotifications — reminders', () => {
  it('uses the due date when there is one', () => {
    const plan = planNotifications(
      base({
        reminders: [
          { id: 'r1', title: 'Marbete', dueDate: iso(2027, 1, 31), predictedDueDate: null, status: 'proximo' },
        ],
      }),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe('date');
    expect(plan[0].route).toBe('/recordatorio/r1');
  });

  it('falls back to the predicted date for a km-only reminder', () => {
    const plan = planNotifications(
      base({
        reminders: [
          { id: 'r2', title: 'Aceite', dueDate: null, predictedDueDate: iso(2026, 10, 12), status: 'proximo' },
        ],
      }),
    );
    expect(plan[0].kind === 'date' && plan[0].date).toBe(at(2026, 10, 12, 9));
  });

  it('drops anything already due or overdue', () => {
    // A DATE trigger in the past fires immediately, which would mean a burst of
    // notifications for everything already overdue the moment the app opens.
    const plan = planNotifications(
      base({
        reminders: [
          { id: 'past', title: 'Vencido', dueDate: iso(2026, 9, 1), predictedDueDate: null, status: 'vencido' },
          { id: 'today', title: 'Hoy', dueDate: TODAY, predictedDueDate: null, status: 'urgente' },
        ],
      }),
    );
    expect(plan).toHaveLength(0);
  });

  it('skips reminders with nothing to go on', () => {
    const plan = planNotifications(
      base({
        reminders: [{ id: 'r3', title: 'Seguro', dueDate: null, predictedDueDate: null, status: 'sin_datos' }],
      }),
    );
    expect(plan).toHaveLength(0);
  });
});

describe('planNotifications — marbete', () => {
  it('schedules the future nudges and drops the passed ones', () => {
    const plan = planNotifications(
      base({
        marbeteNudges: [
          { date: iso(2026, 9, 1), message: 'ya pasó' },
          { date: iso(2026, 10, 15), message: 'abre pronto' },
          { date: iso(2027, 1, 31), message: 'hoy vence' },
        ],
      }),
    );
    expect(plan).toHaveLength(2);
    expect(plan.every((p) => p.title === 'Marbete')).toBe(true);
  });

  it('gives each nudge a stable id derived from its date', () => {
    const input = base({ marbeteNudges: [{ date: iso(2026, 10, 15), message: 'x' }] });
    // Planning twice must produce the same id, or re-scheduling duplicates.
    expect(planNotifications(input)[0].id).toBe(planNotifications(input)[0].id);
    expect(planNotifications(input)[0].id).toContain('marbete:2026-10');
  });
});

describe('planNotifications — ordering and the cap', () => {
  it('never exceeds the cap', () => {
    const reminders = Array.from({ length: 50 }, (_, i) => ({
      id: `r${i}`,
      title: `Recordatorio ${i}`,
      dueDate: iso(2026, 10, 1 + (i % 28)),
      predictedDueDate: null,
      status: 'proximo',
    }));
    const plan = planNotifications(base({ reminders }));
    expect(plan.length).toBe(MAX_SCHEDULED);
  });

  it('keeps the soonest dated ones when it has to cut', () => {
    const reminders = [
      { id: 'far', title: 'Lejos', dueDate: iso(2027, 6, 1), predictedDueDate: null, status: 'ok' },
      { id: 'near', title: 'Cerca', dueDate: iso(2026, 9, 20), predictedDueDate: null, status: 'urgente' },
    ];
    const plan = planNotifications(base({ reminders }));
    expect(plan[0].title).toBe('Cerca');
  });

  it('keeps the repeating checks even when reminders would fill the plan', () => {
    // The habit is the point; a hundred reminders must not push it out.
    const reminders = Array.from({ length: 50 }, (_, i) => ({
      id: `r${i}`,
      title: `R${i}`,
      dueDate: iso(2026, 10, 1),
      predictedDueDate: null,
      status: 'proximo',
    }));
    const plan = planNotifications(
      base({
        reminders,
        templates: [{ id: 'carro_semanal', name: 'Semanal', cadence: 'semanal', enabled: true }],
      }),
    );
    expect(plan.some((p) => p.kind === 'weekly')).toBe(true);
  });

  it('produces no duplicate identifiers', () => {
    const plan = planNotifications(
      base({
        templates: [{ id: 't', name: 'T', cadence: 'diaria', enabled: true }],
        reminders: [{ id: 'r', title: 'R', dueDate: iso(2026, 10, 1), predictedDueDate: null, status: 'ok' }],
        marbeteNudges: [{ date: iso(2026, 10, 15), message: 'x' }],
      }),
    );
    expect(hasDuplicateIds(plan)).toBe(false);
  });

  it('is deterministic — the same input plans the same thing', () => {
    const input = base({
      templates: [{ id: 't', name: 'T', cadence: 'semanal', enabled: true }],
      reminders: [{ id: 'r', title: 'R', dueDate: iso(2026, 10, 1), predictedDueDate: null, status: 'ok' }],
    });
    expect(planNotifications(input)).toEqual(planNotifications(input));
  });
});

describe('nextWeekday', () => {
  it('finds the next occurrence, never today', () => {
    // 18 Sep 2026 is a Friday (day 5, so weekday 6 in expo terms).
    const sunday = nextWeekday(TODAY, 1);
    expect(new Date(sunday).getDay()).toBe(0);
    expect(new Date(sunday) > new Date(TODAY)).toBe(true);
  });

  it('jumps a full week when the weekday is today', () => {
    const sameDay = nextWeekday(TODAY, new Date(TODAY).getDay() + 1);
    expect(new Date(sameDay).getDate()).toBe(25);
  });
});

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
  } as Reminder;
}

describe('planNotifications — the user\'s hour', () => {
  it('fires dated reminders at the chosen hour on the due day, not at the stored noon', () => {
    const plan = planNotifications(
      base({
        hour: 7,
        minute: 30,
        reminders: [{ id: 'r', title: 'R', dueDate: iso(2026, 10, 1), predictedDueDate: null, status: 'ok' }],
      }),
    );
    expect(plan[0].kind === 'date' && plan[0].date).toBe(at(2026, 10, 1, 7, 30));
  });

  it('moves the marbete nudges to the hour too', () => {
    const plan = planNotifications(base({ marbeteNudges: [{ date: iso(2026, 10, 15), message: 'x' }] }));
    expect(plan[0].kind === 'date' && plan[0].date).toBe(at(2026, 10, 15, 9));
  });

  it('keeps something due today when the hour is still ahead, drops it once passed', () => {
    const input = base({
      reminders: [{ id: 'r', title: 'Hoy', dueDate: TODAY, predictedDueDate: null, status: 'urgente' }],
    });
    expect(planNotifications(input, at(2026, 9, 18, 8))).toHaveLength(1);
    expect(planNotifications(input, at(2026, 9, 18, 9, 1))).toHaveLength(0);
  });

  it('atHour keeps the local day', () => {
    expect(new Date(atHour(iso(2027, 1, 31), 9, 0)).getDate()).toBe(31);
    expect(new Date(atHour(iso(2027, 1, 31), 9, 0)).getHours()).toBe(9);
  });
});

describe('planNotifications — próximo and "both"', () => {
  it('adds a próximo notification with its own deterministic id', () => {
    const plan = planNotifications(
      base({
        reminders: [
          {
            id: 'r',
            title: 'Aceite',
            dueDate: iso(2026, 12, 1),
            predictedDueDate: null,
            proximoDate: iso(2026, 11, 1),
            status: 'ok',
          },
        ],
      }),
    );
    expect(plan.map((p) => p.id)).toEqual(['reminder:r:proximo', 'reminder:r:due']);
  });

  it('drops a próximo day already in the past', () => {
    const plan = planNotifications(
      base({
        reminders: [
          { id: 'r', title: 'A', dueDate: iso(2026, 10, 1), predictedDueDate: null, proximoDate: iso(2026, 9, 1), status: 'proximo' },
        ],
      }),
    );
    expect(plan.map((p) => p.id)).toEqual(['reminder:r:due']);
  });

  it('a "both" reminder is due at whichever limit comes first', () => {
    const plan = planNotifications(
      base({
        reminders: [
          { id: 'r', title: 'A', dueDate: iso(2027, 3, 1), predictedDueDate: iso(2026, 11, 5), status: 'ok' },
        ],
      }),
    );
    expect(plan[0].kind === 'date' && plan[0].date).toBe(at(2026, 11, 5, 9));
  });

  it('names the vehicle when there is more than one', () => {
    const plan = planNotifications(
      base({
        reminders: [
          { id: 'r', title: 'A', dueDate: iso(2026, 10, 1), predictedDueDate: null, status: 'ok', vehicleName: 'Corolla' },
        ],
      }),
    );
    expect(plan[0].body).toContain('Corolla');
  });
});

describe('planNotifications — templates across vehicles', () => {
  it('schedules a checklist two vehicles share only once', () => {
    const plan = planNotifications(
      base({
        templates: [
          { id: 'carro_semanal', baseId: 'carro_semanal', name: 'Semanal', cadence: 'semanal', enabled: true },
          { id: 'carro_semanal@v2', baseId: 'carro_semanal', name: 'Semanal', cadence: 'semanal', enabled: true },
          { id: 'carro_diario', baseId: 'carro_diario', name: 'Diario', cadence: 'diaria', enabled: true },
        ],
      }),
    );
    expect(plan.map((p) => p.id)).toEqual(['template:carro_semanal', 'template:carro_diario']);
  });

  it('a disabled copy does not block the other vehicle\'s enabled one', () => {
    const plan = planNotifications(
      base({
        templates: [
          { id: 'carro_semanal@v1', baseId: 'carro_semanal', name: 'S', cadence: 'semanal', enabled: false },
          { id: 'carro_semanal', baseId: 'carro_semanal', name: 'S', cadence: 'semanal', enabled: true },
        ],
      }),
    );
    expect(plan.map((p) => p.id)).toEqual(['template:carro_semanal']);
  });

  it('uses expo\'s weekday numbering, 1 = Sunday … 7 = Saturday', () => {
    const plan = planNotifications(
      base({ weeklyWeekday: 7, templates: [{ id: 's', name: 'S', cadence: 'semanal', enabled: true }] }),
    );
    expect(plan[0].kind === 'weekly' && plan[0].weekday).toBe(7);
    // The settings list starts on Domingo, so index 0 + 1 is Sunday.
    expect(new Date(nextWeekday(TODAY, 1)).getDay()).toBe(0);
    expect(new Date(nextWeekday(TODAY, 7)).getDay()).toBe(6);
  });
});

describe('firstAttentionDay', () => {
  const ctx = { today: TODAY, currentKm: 50_000, kmPerDay: 50, confidence: 'buena' as const };

  it('is the day a date reminder enters its 30-day window', () => {
    const day = firstAttentionDay(reminder({ dueDate: iso(2026, 12, 17) }), ctx);
    // 17 Dec − 30 days = 17 Nov.
    expect(day).toBe(iso(2026, 11, 17));
  });

  it('uses the 45-day legal window', () => {
    const day = firstAttentionDay(reminder({ legalKind: 'marbete', dueDate: iso(2027, 1, 31) }), ctx);
    expect(day).toBe(iso(2026, 12, 17));
  });

  it('projects the odometer at the vehicle\'s pace for a km reminder', () => {
    // 5,000 km interval → próximo at 500 km left. 3,000 km away at 50 km/day:
    // 2,500 km to the window → day 50.
    const day = firstAttentionDay(reminder({ metric: 'km', dueKm: 53_000 }), ctx);
    expect(day).toBe(iso(2026, 11, 7));
  });

  it('is null when it already needs attention or nothing is known', () => {
    expect(firstAttentionDay(reminder({ dueDate: iso(2026, 10, 1) }), ctx)).toBeNull();
    expect(firstAttentionDay(reminder({ dueDate: null }), ctx)).toBeNull();
  });
});
