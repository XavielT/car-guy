import { shareStructure } from '@/lib/structuralShare';

type Row = { id: string; n: number; tags?: string[] };
const data = () => ({
  rows: [
    { id: 'a', n: 1, tags: ['x'] },
    { id: 'b', n: 2, tags: [] },
  ] as Row[],
  settings: { active: 'a', flags: { eco: true } },
  empty: [] as Row[],
});

describe('shareStructure', () => {
  it('an equal copy returns the very same object (so setState bails out)', () => {
    const prev = data();
    expect(shareStructure(prev, data())).toBe(prev);
  });

  it('a changed row changes only that row and the arrays above it', () => {
    const prev = data();
    const next = data();
    next.rows[1] = { id: 'b', n: 99, tags: [] };
    const out = shareStructure(prev, next);
    expect(out).not.toBe(prev);
    expect(out.rows).not.toBe(prev.rows);
    expect(out.rows[0]).toBe(prev.rows[0]); // untouched row keeps its identity
    expect(out.rows[1]).not.toBe(prev.rows[1]);
    expect(out.rows[1].n).toBe(99);
    expect(out.settings).toBe(prev.settings);
    expect(out.empty).toBe(prev.empty);
  });

  it('matches rows by id: an insert at the front keeps the others', () => {
    const prev = data();
    const next = data();
    next.rows = [{ id: 'z', n: 0 }, ...next.rows];
    const out = shareStructure(prev, next);
    expect(out.rows).toHaveLength(3);
    expect(out.rows[1]).toBe(prev.rows[0]);
    expect(out.rows[2]).toBe(prev.rows[1]);
  });

  it('a reorder with the same rows keeps every row but returns a new array', () => {
    const prev = data();
    const next = data();
    next.rows.reverse();
    const out = shareStructure(prev, next);
    expect(out.rows).not.toBe(prev.rows);
    expect(out.rows[0]).toBe(prev.rows[1]);
    expect(out.rows[1]).toBe(prev.rows[0]);
  });

  it('a removed row shrinks the array; nested objects share too', () => {
    const prev = data();
    const next = data();
    next.rows = [next.rows[0]];
    next.settings.flags.eco = false;
    const out = shareStructure(prev, next);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toBe(prev.rows[0]);
    expect(out.settings.flags).not.toBe(prev.settings.flags);
    expect(out.settings.flags.eco).toBe(false);
  });

  it('handles primitives, null and arrays without ids', () => {
    expect(shareStructure(1, 2)).toBe(2);
    expect(shareStructure<string | null>(null, 'x')).toBe('x');
    const prev = { list: [1, 2, 3] };
    expect(shareStructure(prev, { list: [1, 2, 3] })).toBe(prev);
    const out = shareStructure(prev, { list: [1, 2, 4] });
    expect(out.list).toEqual([1, 2, 4]);
  });

  it('a key added or removed counts as a change', () => {
    const prev: Record<string, number> = { a: 1 };
    expect(shareStructure(prev, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    expect(shareStructure({ a: 1, b: 2 } as Record<string, number>, { a: 1 })).toEqual({ a: 1 });
  });
});
