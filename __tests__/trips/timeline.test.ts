import { appendEntry, summarize, TIMELINE_MAX, type TimelineEntry } from '@/lib/trips/timeline';

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 5, 12);
const task = (at: number, ms: number, background = true, fixes = 3): TimelineEntry => ({ at, kind: 'task', fixes, bestAccM: 12, ms, background });

describe('trip timeline (PROMPT-09 step 2)', () => {
  it('keeps 14 days and drops what is older', () => {
    let list: TimelineEntry[] = [];
    list = appendEntry(list, task(NOW - 15 * 24 * H, 10), NOW - 15 * 24 * H);
    list = appendEntry(list, task(NOW - H, 20), NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ ms: 20 });
  });

  it('is capped, oldest first', () => {
    let list: TimelineEntry[] = [];
    for (let i = 0; i < TIMELINE_MAX + 25; i++) list = appendEntry(list, task(NOW - 10_000 + i, i), NOW);
    expect(list).toHaveLength(TIMELINE_MAX);
    expect((list[0] as { ms: number }).ms).toBe(25);
  });

  it('summarises the work done in the background, the number the system punishes', () => {
    const list: TimelineEntry[] = [
      { at: NOW - 5 * H, kind: 'app', state: 'background' },
      task(NOW - 4 * H, 120),
      task(NOW - 4 * H + 60_000, 3000),
      task(NOW - 2 * H, 80, false),
      { at: NOW - 2 * H, kind: 'arm', ok: false, reason: 'Automático not armed: no_background' },
      { at: NOW - 2 * H + 1, kind: 'arm', ok: false, reason: 'Automático not armed: no_background' },
      { at: NOW - H, kind: 'trip', what: 'discarded', source: 'auto', reason: 'duration' },
      { at: NOW - H + 5, kind: 'trip', what: 'created', source: 'auto' },
    ];
    const s = summarize(list);
    expect(s.taskRuns).toBe(3);
    expect(s.taskRunsInBackground).toBe(2);
    expect(s.taskMs).toBe(3200);
    expect(s.backgroundMs).toBe(3120);
    expect(s.slowestTaskMs).toBe(3000);
    expect(s.fixes).toBe(9);
    expect(s.armFailures).toEqual([{ reason: 'Automático not armed: no_background', count: 2 }]);
    expect(s.busiestHour).toMatchObject({ runs: 2, ms: 3120 });
    expect(s.tripsCreated).toBe(1);
    expect(s.tripsDiscarded).toEqual([{ reason: 'duration', count: 1 }]);
    expect(s.appStateChanges).toBe(1);
  });

  it('an empty journal summarises to zeros, not NaN', () => {
    const s = summarize([]);
    expect(s).toMatchObject({ entries: 0, spanHours: 0, taskRuns: 0, taskMs: 0, busiestHour: null });
  });

  it('never stores a position: entries only have counts, accuracies and durations', () => {
    const json = JSON.stringify([task(NOW, 5), { at: NOW, kind: 'arm', ok: true, reason: 'ok' }]);
    expect(json).not.toMatch(/lat|lng|latitude|longitude/i);
  });
});
