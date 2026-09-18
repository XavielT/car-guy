import {
  hasDuplicateIds,
  MAX_SCHEDULED,
  nextWeekday,
  planNotifications,
  type PlanInput,
} from '@/lib/notifications/plan';

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
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
    expect(plan[0].kind === 'date' && plan[0].date).toBe(iso(2026, 10, 12));
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
