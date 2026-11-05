import { planNotifications, planRecapNotifications, type PlanInput } from '@/lib/notifications/plan';

const base: PlanInput = { today: '2026-11-05T12:00:00.000Z', hour: 9, minute: 0, weeklyWeekday: 1, reminders: [], templates: [], marbeteNudges: [] };
const local = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0, 0).toISOString();

describe('recap notifications (SPEC-J §J1)', () => {
  it('schedules the next three 1sts at 09:00 local, the month that just closed in the title', () => {
    const items = planRecapNotifications(new Date(2026, 10, 5, 10).toISOString());
    expect(items.map((i) => i.id)).toEqual(['recap:2026-11', 'recap:2026', 'recap:2027-01']);
    expect(items[0].date).toBe(local(2026, 12, 1));
    expect(items[0].route).toBe('/resumen/2026-11');
  });

  it('on 1 January it is the YEAR that is announced, not December', () => {
    const items = planRecapNotifications(new Date(2026, 11, 20, 10).toISOString());
    expect(items[0]).toMatchObject({ id: 'recap:2026', route: '/resumen/2026' });
    expect(items[0].date).toBe(local(2027, 1, 1));
  });

  it('are in the plan only when asked for, and never when off', () => {
    const now = new Date(2026, 10, 5, 10).toISOString();
    expect(planNotifications({ ...base, recaps: true }, now).some((p) => p.id.startsWith('recap:'))).toBe(true);
    expect(planNotifications({ ...base, recaps: false }, now).some((p) => p.id.startsWith('recap:'))).toBe(false);
    expect(planNotifications(base, now).some((p) => p.id.startsWith('recap:'))).toBe(false);
  });

  it('a notification already in the past is not scheduled', () => {
    const plan = planNotifications({ ...base, recaps: true }, new Date(2026, 11, 1, 10).toISOString());
    expect(plan.find((p) => p.id === 'recap:2026-11')).toBeUndefined();
  });
});
