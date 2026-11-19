/**
 * Structural sharing: `shareStructure(prev, next)` returns `next`'s content but
 * keeps every object and array reference from `prev` that did not change.
 *
 * Why it exists: the store re-reads SQLite after any write (lib/store.tsx), and
 * the database also changes for reasons the screens never show — sync flags,
 * trip points, settings. Without this each of those handed every consumer a
 * brand-new `data` and re-rendered them all, and every `useMemo([data.fillups])`
 * downstream recomputed. With it an unchanged reload is a no-op (React bails out
 * when the same state object comes back), and an edit changes only the row it
 * touched and the arrays that contain it.
 *
 * Arrays whose items carry an `id` are matched by id, so a reordered or
 * inserted row still keeps its neighbours' identity; other arrays match by
 * index. Only plain objects, arrays and primitives are expected (the store's
 * data is JSON-shaped).
 */

function isPlain(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasId(value: unknown): value is { id: unknown } {
  return isPlain(value) && 'id' in value;
}

export function shareStructure<T>(prev: T, next: T): T {
  if (Object.is(prev, next)) return prev;

  if (Array.isArray(prev) && Array.isArray(next)) {
    let byId: Map<unknown, unknown> | null = null;
    const out = next.map((item, index) => {
      if (hasId(item)) {
        if (!byId) {
          byId = new Map();
          for (const p of prev) if (hasId(p)) byId.set(p.id, p);
        }
        const match = byId.get(item.id);
        return match === undefined ? item : shareStructure(match, item);
      }
      return index < prev.length ? shareStructure(prev[index], item) : item;
    });
    const same = out.length === prev.length && out.every((item, index) => item === prev[index]);
    return (same ? prev : out) as T;
  }

  if (isPlain(prev) && isPlain(next)) {
    const nextKeys = Object.keys(next);
    let changed = nextKeys.length !== Object.keys(prev).length;
    const out: Record<string, unknown> = {};
    for (const key of nextKeys) {
      const shared = key in prev ? shareStructure(prev[key], next[key]) : next[key];
      out[key] = shared;
      if (!(key in prev) || shared !== prev[key]) changed = true;
    }
    return (changed ? out : prev) as T;
  }

  return next;
}
