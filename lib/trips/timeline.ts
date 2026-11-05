/**
 * The "why didn't it record / why did the system kill us" timeline (SPEC-H §H1, PROMPT-09 step 2). A small local journal of what the app
 * itself did in the background: every arm outcome, every location-task invocation (fixes, best accuracy, how long the JS ran), app-state
 * changes, machine phase changes, trips created or discarded. Kept 14 days, capped, positions NEVER stored (counts, accuracies, durations).
 *
 * Why it exists: on the Redmi (docs/imp-03112026/trips-diagnosis.md) the system killed the app 6 times in a week, 3 of them for EXCESSIVE
 * CPU while cached. The journal is how the next run says WHICH work ran in the background and for how long, instead of guessing.
 *
 * Pure core (append/prune/summarise) + a tiny buffered writer: entries are kept in memory and written to settings at most every 30 s and
 * when the app goes to the background, so journaling is not itself the CPU it is trying to explain.
 */
export const TIMELINE_DAYS = 14;
export const TIMELINE_MAX = 400;
export const TIMELINE_KEY = 'trip_timeline';

export type TimelineEntry =
  | { at: number; kind: 'arm'; ok: boolean; reason: string }
  | { at: number; kind: 'task'; fixes: number; bestAccM: number | null; ms: number; background: boolean }
  | { at: number; kind: 'app'; state: string }
  | { at: number; kind: 'phase'; from: string; to: string }
  | { at: number; kind: 'trip'; what: 'created' | 'discarded'; source: string; reason?: string; distanceM?: number }
  | { at: number; kind: 'service'; running: boolean }
  /** An event of the native trigger (modules/trip-trigger): vehicle-enter/exit, recorder-start/stop, start-failed, ingested… */
  | { at: number; kind: 'native'; event: string; detail?: string };

const DAY = 86_400_000;

/** Adds an entry, drops anything older than 14 days or beyond the cap (oldest first). Pure. */
export function appendEntry(list: readonly TimelineEntry[], entry: TimelineEntry, now: number): TimelineEntry[] {
  const since = now - TIMELINE_DAYS * DAY;
  const next = [...list.filter((e) => e.at >= since), entry];
  return next.length > TIMELINE_MAX ? next.slice(next.length - TIMELINE_MAX) : next;
}

export type TimelineSummary = {
  entries: number;
  spanHours: number;
  taskRuns: number;
  taskRunsInBackground: number;
  fixes: number;
  /** Wall-clock milliseconds the task handler ran, in total and per background run: the CPU proxy. */
  taskMs: number;
  backgroundMs: number;
  slowestTaskMs: number;
  armFailures: { reason: string; count: number }[];
  /** Task runs per hour of the busiest hour, a rate the system's CPU limit reacts to. */
  busiestHour: { hourStart: string; runs: number; ms: number } | null;
  appStateChanges: number;
  tripsCreated: number;
  tripsDiscarded: { reason: string; count: number }[];
  /** What the native trigger did (vehicle-enter, recorder-start, start-failed…): the answer to "why did it not start by itself". */
  native: { event: string; count: number }[];
};

export function summarize(list: readonly TimelineEntry[]): TimelineSummary {
  const tasks = list.filter((e): e is Extract<TimelineEntry, { kind: 'task' }> => e.kind === 'task');
  const bg = tasks.filter((t) => t.background);
  const count = (rows: string[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r, (m.get(r) ?? 0) + 1);
    return [...m.entries()].map(([reason, n]) => ({ reason, count: n })).sort((a, b) => b.count - a.count);
  };
  const byHour = new Map<number, { runs: number; ms: number }>();
  for (const t of tasks) {
    const h = Math.floor(t.at / 3_600_000);
    const cur = byHour.get(h) ?? { runs: 0, ms: 0 };
    byHour.set(h, { runs: cur.runs + 1, ms: cur.ms + t.ms });
  }
  const busiest = [...byHour.entries()].sort((a, b) => b[1].ms - a[1].ms)[0];
  const first = list[0]?.at;
  const last = list[list.length - 1]?.at;
  return {
    entries: list.length,
    spanHours: first != null && last != null ? Math.round(((last - first) / 3_600_000) * 10) / 10 : 0,
    taskRuns: tasks.length,
    taskRunsInBackground: bg.length,
    fixes: tasks.reduce((s, t) => s + t.fixes, 0),
    taskMs: Math.round(tasks.reduce((s, t) => s + t.ms, 0)),
    backgroundMs: Math.round(bg.reduce((s, t) => s + t.ms, 0)),
    slowestTaskMs: Math.round(tasks.reduce((m, t) => Math.max(m, t.ms), 0)),
    armFailures: count(list.filter((e): e is Extract<TimelineEntry, { kind: 'arm' }> => e.kind === 'arm' && !e.ok).map((e) => e.reason)),
    busiestHour: busiest ? { hourStart: new Date(busiest[0] * 3_600_000).toISOString(), runs: busiest[1].runs, ms: Math.round(busiest[1].ms) } : null,
    appStateChanges: list.filter((e) => e.kind === 'app').length,
    tripsCreated: list.filter((e) => e.kind === 'trip' && e.what === 'created').length,
    native: count(list.filter((e): e is Extract<TimelineEntry, { kind: 'native' }> => e.kind === 'native').map((e) => (e.detail && /fail/.test(e.event) ? `${e.event}: ${e.detail}` : e.event))).map(({ reason, count: n }) => ({ event: reason, count: n })),
    tripsDiscarded: count(list.filter((e): e is Extract<TimelineEntry, { kind: 'trip' }> => e.kind === 'trip' && e.what === 'discarded').map((e) => e.reason ?? 'unknown')),
  };
}

// ---- the buffered writer (not pure: it keeps a list in memory and writes it out lazily)
let buffer: TimelineEntry[] | null = null;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 30_000;

async function store() {
  const { settings } = await import('../db/repos');
  return settings;
}

async function load(): Promise<TimelineEntry[]> {
  if (buffer) return buffer;
  try {
    const raw = await (await store()).get<TimelineEntry[]>(TIMELINE_KEY, []);
    buffer = Array.isArray(raw) ? raw : [];
  } catch {
    buffer = [];
  }
  return buffer;
}

/** Records one entry. Never throws and never blocks: a failing journal must not break a trip. */
/** An entry without its time (distributed over the union, so each kind keeps its own fields). */
type NewEntry = TimelineEntry extends infer T ? (T extends { at: number } ? Omit<T, 'at'> & { at?: number } : never) : never;

export function logTimeline(entry: NewEntry): void {
  const full = { ...entry, at: entry.at ?? Date.now() } as TimelineEntry;
  void load()
    .then((list) => {
      buffer = appendEntry(list, full, full.at);
      dirty = true;
      if (!timer) timer = setTimeout(() => void flushTimeline(), FLUSH_MS);
    })
    .catch(() => {});
}

export async function flushTimeline(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!dirty || !buffer) return;
  dirty = false;
  try {
    await (await store()).set(TIMELINE_KEY, buffer);
  } catch {
    dirty = true;
  }
}

export async function readTimeline(): Promise<TimelineEntry[]> {
  return [...(await load())];
}
