import type { GarageLayout } from '@/lib/db/tripOps';
import { canMove, garageLayoutReducer, orderByLayout, orderVehicleIds } from '@/lib/domain/garageLayout';

const base: GarageLayout = { mode: 'grid', order: [], pinned: null };

describe('orderVehicleIds', () => {
  it('keeps the given order when the layout is empty', () => {
    expect(orderVehicleIds(['a', 'b', 'c'], base)).toEqual(['a', 'b', 'c']);
  });

  it('puts the pinned car first, then the stored order, then unseen ids last', () => {
    const layout = { ...base, order: ['c', 'a'], pinned: 'b' };
    expect(orderVehicleIds(['a', 'b', 'c', 'd'], layout)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('ignores stored ids that are gone, and the pin when asked (Ex section)', () => {
    const layout = { ...base, order: ['x', 'c', 'a'], pinned: 'a' };
    expect(orderVehicleIds(['a', 'c'], layout, { pin: false })).toEqual(['c', 'a']);
    expect(orderVehicleIds(['c'], layout)).toEqual(['c']);
  });

  it('orderByLayout orders items by their id', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(orderByLayout(items, (i) => i.id, { ...base, order: ['b'] }).map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('garageLayoutReducer', () => {
  it('switches mode', () => {
    expect(garageLayoutReducer(base, { type: 'mode', mode: 'list' }).mode).toBe('list');
    expect(garageLayoutReducer(base, { type: 'mode', mode: 'grid' })).toBe(base);
  });

  it('pins and unpins', () => {
    const pinned = garageLayoutReducer(base, { type: 'pin', id: 'b' });
    expect(pinned.pinned).toBe('b');
    expect(garageLayoutReducer(pinned, { type: 'pin', id: 'b' }).pinned).toBeNull();
    expect(garageLayoutReducer(pinned, { type: 'pin', id: 'c' }).pinned).toBe('c');
  });

  it('moves a car up and down within its section', () => {
    const all = ['a', 'b', 'c'];
    const down = garageLayoutReducer(base, { type: 'move', id: 'a', delta: 1, section: all, all });
    expect(orderVehicleIds(all, down)).toEqual(['b', 'a', 'c']);
    const up = garageLayoutReducer(down, { type: 'move', id: 'c', delta: -1, section: all, all });
    expect(orderVehicleIds(all, up)).toEqual(['b', 'c', 'a']);
  });

  it('does nothing at the ends or for the pinned car', () => {
    const all = ['a', 'b', 'c'];
    expect(garageLayoutReducer(base, { type: 'move', id: 'a', delta: -1, section: all, all })).toBe(base);
    expect(garageLayoutReducer(base, { type: 'move', id: 'c', delta: 1, section: all, all })).toBe(base);
    const pinned = { ...base, pinned: 'b' };
    expect(canMove(pinned, 'b', 1, all)).toBe(false);
    // The pinned car is not a neighbour: 'a' is first among the unpinned.
    expect(canMove(pinned, 'a', -1, all)).toBe(false);
    const moved = garageLayoutReducer(pinned, { type: 'move', id: 'a', delta: 1, section: all, all });
    expect(orderVehicleIds(all, moved)).toEqual(['b', 'c', 'a']);
  });

  it('keeps cars hidden by a filter or in the Ex section in place', () => {
    const all = ['a', 'x', 'b', 'c', 'e1', 'e2'];
    // The filter shows a, b, c; x sits between a and b.
    const moved = garageLayoutReducer(base, { type: 'move', id: 'a', delta: 1, section: ['a', 'b', 'c'], all });
    expect(orderVehicleIds(all, moved)).toEqual(['b', 'x', 'a', 'c', 'e1', 'e2']);
    // Reordering the Ex section leaves the garage alone.
    const ex = garageLayoutReducer(moved, { type: 'move', id: 'e2', delta: -1, section: ['e1', 'e2'], all });
    expect(orderVehicleIds(all, ex)).toEqual(['b', 'x', 'a', 'c', 'e2', 'e1']);
  });
});
