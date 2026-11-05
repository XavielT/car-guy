import { NAV_ITEMS, PHONE_SLOTS, navItem } from '@/lib/nav/model';
import { railActive } from '@/lib/theme/layout';

describe('navigation model (SPEC-K §K2)', () => {
  it('the phone has at most five slots (four tabs + the CONDUCIR disc)', () => {
    expect(PHONE_SLOTS).toBeLessThanOrEqual(5);
    expect(NAV_ITEMS.filter((i) => i.tab)).toHaveLength(4);
  });
  it('every tab names its expo-router screen; non-tabs do not', () => {
    for (const i of NAV_ITEMS) expect(Boolean(i.tabName)).toBe(i.tab);
  });
  it('the rail shows every destination, once, with a distinct chord', () => {
    const ids = NAV_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = NAV_ITEMS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('each destination is found again from its own path (so the rail highlights it)', () => {
    for (const i of NAV_ITEMS) expect(railActive(i.href)).toBe(i.id);
  });
  it('labels are words, not module names, and exist', () => {
    for (const i of NAV_ITEMS) expect(i.label().length).toBeGreaterThan(1);
    expect(navItem('inicio').label()).toBe('Hoy');
  });
});
