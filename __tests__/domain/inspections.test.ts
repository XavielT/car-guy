import { isDue, latestRun, taskPriorityFor, weeklyStreak } from '@/lib/domain/inspections';

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const TODAY = iso(2026, 9, 18);
const run = (y: number, m: number, d: number) => ({ occurredAt: iso(y, m, d) });

describe('isDue', () => {
  it('is due when it has never been done', () => {
    expect(isDue('diaria', [], TODAY)).toBe(true);
    expect(isDue('semanal', [], TODAY)).toBe(true);
    expect(isDue('mensual', [], TODAY)).toBe(true);
  });

  it('daily: not due again the same day, due the next', () => {
    expect(isDue('diaria', [run(2026, 9, 18)], TODAY)).toBe(false);
    expect(isDue('diaria', [run(2026, 9, 17)], TODAY)).toBe(true);
  });

  it('weekly: due on day seven, not on day six', () => {
    expect(isDue('semanal', [run(2026, 9, 12)], TODAY)).toBe(false);
    expect(isDue('semanal', [run(2026, 9, 11)], TODAY)).toBe(true);
  });

  it('monthly: thirty days, not calendar months', () => {
    expect(isDue('mensual', [run(2026, 8, 25)], TODAY)).toBe(false);
    expect(isDue('mensual', [run(2026, 8, 19)], TODAY)).toBe(true);
  });

  it('uses the most recent run, whatever order they arrive in', () => {
    const runs = [run(2026, 1, 1), run(2026, 9, 18), run(2026, 5, 5)];
    expect(isDue('diaria', runs, TODAY)).toBe(false);
  });

  it('never nags for the manual cadences', () => {
    // T-CLOCS is done before you ride, not because an app asked.
    expect(isDue('antes_de_viaje', [], TODAY)).toBe(false);
    expect(isDue('manual', [], TODAY)).toBe(false);
  });
});

describe('latestRun', () => {
  it('is null with no runs', () => {
    expect(latestRun([])).toBeNull();
  });

  it('finds the newest regardless of order', () => {
    expect(latestRun([run(2026, 1, 1), run(2026, 9, 1), run(2026, 5, 1)])!.occurredAt).toBe(
      iso(2026, 9, 1),
    );
  });
});

describe('weeklyStreak', () => {
  it('is zero with no runs', () => {
    expect(weeklyStreak([], TODAY)).toBe(0);
  });

  it('counts consecutive weekly runs', () => {
    const runs = [run(2026, 9, 18), run(2026, 9, 11), run(2026, 9, 4)];
    expect(weeklyStreak(runs, TODAY)).toBe(3);
  });

  it('forgives a day of slippage rather than refereeing the habit', () => {
    // Sunday, then the following Monday: eight days, one day late.
    const runs = [run(2026, 9, 18), run(2026, 9, 10), run(2026, 9, 2)];
    expect(weeklyStreak(runs, TODAY)).toBe(3);
  });

  it('breaks when a week is genuinely skipped', () => {
    const runs = [run(2026, 9, 18), run(2026, 9, 11), run(2026, 8, 20)];
    expect(weeklyStreak(runs, TODAY)).toBe(2);
  });

  it('is zero once the current week has lapsed', () => {
    // Nine days since the last run: the streak is over, not merely paused.
    expect(weeklyStreak([run(2026, 9, 9), run(2026, 9, 2)], TODAY)).toBe(0);
  });

  it('counts a single recent run as one', () => {
    expect(weeklyStreak([run(2026, 9, 15)], TODAY)).toBe(1);
  });
});

describe('taskPriorityFor', () => {
  it('treats the engine-killers as critical', () => {
    // Coolant is on this list because it is why the app exists.
    expect(taskPriorityFor('refrigerante')).toBe('critica');
    expect(taskPriorityFor('aceite_motor')).toBe('critica');
    expect(taskPriorityFor('liquido_frenos')).toBe('critica');
    expect(taskPriorityFor('pastillas_frenos')).toBe('critica');
  });

  it('leaves everything else at normal', () => {
    expect(taskPriorityFor('limpiavidrios')).toBe('normal');
    expect(taskPriorityFor(null)).toBe('normal');
  });
});
