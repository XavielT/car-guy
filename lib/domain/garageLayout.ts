import type { GarageLayout } from '../db/tripOps';

/**
 * Garaje v2's layout (IMP 29092026, 03-screens.md "Phase 6"): the view mode,
 * the user's order and the one pinned car, as a pure reducer so the ordering
 * rules are tested rather than eyeballed. Persisted as `setting.garage_layout`
 * (synced — the phone and the web show the same garage).
 *
 * Ordering: the pinned car first (garage section only), then the ids in
 * `layout.order`, then anything the layout has never seen, in the order the
 * caller gave (a car added on another device lands last, not nowhere).
 */

export type GarageMode = GarageLayout['mode'];

export type GarageLayoutAction =
  | { type: 'mode'; mode: GarageMode }
  /** Pin `id`, or unpin it when it already is. */
  | { type: 'pin'; id: string }
  /**
   * Move `id` one place up (-1) or down (+1) among `section` — the ids on
   * screen together (the garage or the Ex list, after filters) — against the
   * whole garage `all`, so the rest of the stored order is kept.
   */
  | { type: 'move'; id: string; delta: -1 | 1; section: string[]; all: string[] };

/** `ids` in layout order. `pin: false` for the Ex section, where the pin does not apply. */
export function orderVehicleIds(ids: string[], layout: GarageLayout, opts: { pin?: boolean } = {}): string[] {
  const present = new Set(ids);
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (id: string) => {
    if (present.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };
  if (opts.pin !== false && layout.pinned) push(layout.pinned);
  for (const id of layout.order) push(id);
  for (const id of ids) push(id);
  return out;
}

/** The same order for any item that carries a vehicle id. */
export function orderByLayout<T>(items: T[], idOf: (item: T) => string, layout: GarageLayout, opts: { pin?: boolean } = {}): T[] {
  const byId = new Map(items.map((item) => [idOf(item), item]));
  return orderVehicleIds([...byId.keys()], layout, opts).map((id) => byId.get(id) as T);
}

/** The pinned car never moves (it is on top by definition); others move within their section. */
export function canMove(layout: GarageLayout, id: string, delta: -1 | 1, section: string[]): boolean {
  if (id === layout.pinned) return false;
  const seq = orderVehicleIds(section, layout).filter((x) => x !== layout.pinned);
  const i = seq.indexOf(id);
  return i >= 0 && i + delta >= 0 && i + delta < seq.length;
}

export function garageLayoutReducer(layout: GarageLayout, action: GarageLayoutAction): GarageLayout {
  switch (action.type) {
    case 'mode':
      return layout.mode === action.mode ? layout : { ...layout, mode: action.mode };
    case 'pin':
      return { ...layout, pinned: layout.pinned === action.id ? null : action.id };
    case 'move': {
      if (!canMove(layout, action.id, action.delta, action.section)) return layout;
      const seq = orderVehicleIds(action.section, layout).filter((x) => x !== layout.pinned);
      const neighbour = seq[seq.indexOf(action.id) + action.delta];
      // Swap the two in the full order, so cars hidden by a filter (or in the
      // other section) keep their places.
      const full = orderVehicleIds([...action.all, ...action.section], { ...layout, pinned: null });
      const a = full.indexOf(action.id);
      const b = full.indexOf(neighbour);
      [full[a], full[b]] = [full[b], full[a]];
      return { ...layout, order: full };
    }
  }
}
