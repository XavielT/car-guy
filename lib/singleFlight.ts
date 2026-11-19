/**
 * Wraps an async `fn` so overlapping calls never run in parallel.
 *
 * A call while `fn` is running does not start another run now; it asks for
 * exactly one more pass right after the current one and shares that promise.
 * So N calls during a run cost one extra run, not N, and a caller always gets
 * a result computed *after* it called (a write that awaits a reload sees its
 * own write). A rejection reaches every caller sharing that run.
 */
export function singleFlight(fn: () => Promise<void>): () => Promise<void> {
  let inflight: Promise<void> | null = null;
  let again = false;
  return () => {
    if (inflight) {
      again = true;
      return inflight;
    }
    const run = (async () => {
      try {
        do {
          again = false;
          await fn();
        } while (again);
      } finally {
        inflight = null;
      }
    })();
    inflight = run;
    return run;
  };
}
