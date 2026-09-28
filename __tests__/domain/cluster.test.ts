import type { Reminder } from '@/lib/db/types';
import { clusterReading } from '@/lib/domain/cluster';
import type { ReminderStatus } from '@/lib/domain/reminders';

const reminder = (over: Partial<Reminder>): Reminder => ({ title: 'Aceite', intervalKm: null, intervalMonths: null, intervalDays: null, dueDate: null, ...over }) as Reminder;
const status = (over: Partial<ReminderStatus>): ReminderStatus => ({
  status: 'ok', triggeredBy: null, dueDays: null, dueKm: null, predictedDueDate: null, confidence: 'buena', snoozed: false, ...over,
});

describe('clusterReading', () => {
  it('reads the nearest km reminder as used-up fraction of its interval', () => {
    const r = clusterReading([
      { reminder: reminder({ title: 'Aceite', intervalKm: 5000 }), status: status({ dueKm: 1250, predictedDueDate: '2026-10-12' }) },
      { reminder: reminder({ title: 'Filtro de aire', intervalKm: 15000 }), status: status({ dueKm: 9000 }) },
    ]);
    expect(r).toEqual({ progress: 0.75, title: 'Aceite', remaining: { km: 1250 }, predictedDueDate: '2026-10-12' });
  });

  it('pins overdue at 1', () => {
    const r = clusterReading([{ reminder: reminder({ intervalKm: 5000 }), status: status({ status: 'vencido', dueKm: -300 }) }]);
    expect(r?.progress).toBe(1);
  });

  it('falls back to days when nothing is km-based', () => {
    const r = clusterReading([{ reminder: reminder({ title: 'Marbete', intervalMonths: 12, dueDate: '2027-01-31' }), status: status({ dueDays: 91 }) }]);
    expect(r?.remaining).toEqual({ days: 91 });
    expect(r?.progress).toBeCloseTo(1 - 91 / 365, 2);
  });

  it('ignores snoozed and data-less reminders', () => {
    expect(
      clusterReading([
        { reminder: reminder({ intervalKm: 5000 }), status: status({ dueKm: 100, snoozed: true }) },
        { reminder: reminder({ intervalKm: 5000 }), status: status({ status: 'sin_datos', dueKm: 50 }) },
      ]),
    ).toBeNull();
  });
});
