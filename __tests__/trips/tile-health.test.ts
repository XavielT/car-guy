/** Tiles that stop arriving mid-drive used to go unnoticed (IMP 16102026 M-8). */
import { createTileHealth } from '../../lib/map/tileHealth';

it('a few failed tiles are normal; five in ten seconds are a dead zone', () => {
  const h = createTileHealth();
  expect([1, 2, 3, 4].map((i) => h.error(i * 1000))).toEqual([false, false, false, false]);
  expect(h.error(5000)).toBe(true);
  expect(h.degraded).toBe(true);
});

it('says it once, not on every later error', () => {
  const h = createTileHealth({ limit: 2 });
  h.error(0);
  expect(h.error(1)).toBe(true);
  expect(h.error(2)).toBe(false);
});

it('errors spread over a minute never add up', () => {
  const h = createTileHealth();
  for (let i = 0; i < 20; i++) expect(h.error(i * 20_000)).toBe(false);
});

it('idle after a dead zone is "back", once; idle on a healthy map says nothing', () => {
  const h = createTileHealth({ limit: 2 });
  expect(h.idle()).toBe(false);
  h.error(0);
  h.error(1);
  expect(h.idle()).toBe(true);
  expect(h.idle()).toBe(false);
  expect(h.degraded).toBe(false);
});

it('idle forgets the errors before it', () => {
  const h = createTileHealth({ limit: 3 });
  h.error(0);
  h.error(1);
  h.idle();
  expect(h.error(2)).toBe(false);
});
