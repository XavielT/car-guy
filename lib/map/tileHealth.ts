/**
 * Are the tiles still arriving? (IMP 16102026 M-8.) The style check only covers the start: a phone that drives into
 * a dead zone keeps a map whose tiles quietly stop loading. MapLibre reports every failed tile as an `error` and
 * fires `idle` once everything visible has loaded, so: `limit` errors inside `windowMs` = degraded; the next `idle`
 * = back. Pure state machine, one per map.
 */
export function createTileHealth({ limit = 5, windowMs = 10_000 }: { limit?: number; windowMs?: number } = {}) {
  let errors: number[] = [];
  let degraded = false;
  return {
    /** A tile failed. Returns true exactly when the map becomes degraded. */
    error(now: number): boolean {
      errors = [...errors.filter((t) => now - t <= windowMs), now];
      if (!degraded && errors.length >= limit) {
        degraded = true;
        return true;
      }
      return false;
    },
    /** Everything visible loaded. Returns true exactly when the map recovers. */
    idle(): boolean {
      errors = [];
      if (!degraded) return false;
      degraded = false;
      return true;
    },
    get degraded() {
      return degraded;
    },
  };
}
