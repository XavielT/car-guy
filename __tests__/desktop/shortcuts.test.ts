import { CHEATSHEET, CHORD_MS, GO_KEYS, IDLE, step } from '@/lib/desktop/shortcuts';

describe('shortcuts (SPEC-F §F3)', () => {
  it('/ and Ctrl/Cmd+K open the search; Ctrl+K works even while typing', () => {
    expect(step({ key: '/' }, IDLE, 0).action).toEqual({ type: 'search' });
    expect(step({ key: 'k', ctrl: true }, IDLE, 0).action).toEqual({ type: 'search' });
    expect(step({ key: 'K', meta: true, typing: true }, IDLE, 0).action).toEqual({ type: 'search' });
  });
  it('nothing fires while typing in a field, and other modifiers are the browser’s', () => {
    expect(step({ key: '/', typing: true }, IDLE, 0).action).toBeNull();
    expect(step({ key: 'n', typing: true }, IDLE, 0).action).toBeNull();
    expect(step({ key: 'n', ctrl: true }, IDLE, 0).action).toBeNull();
    expect(step({ key: 'g', alt: true }, IDLE, 0).state.pending).toBe(false);
  });
  it('g then a letter goes there; the chord times out; a wrong second key cancels it', () => {
    const a = step({ key: 'g' }, IDLE, 1000);
    expect(a.action).toBeNull();
    expect(a.state.pending).toBe(true);
    expect(step({ key: 'h' }, a.state, 1500).action).toEqual({ type: 'go', href: '/historial' });
    expect(step({ key: 'h' }, a.state, 1000 + CHORD_MS + 1).action).toBeNull();
    const bad = step({ key: 'z' }, a.state, 1100);
    expect(bad.action).toBeNull();
    expect(bad.state.pending).toBe(false);
  });
  it('every go-key is a route and appears in the cheat-sheet', () => {
    for (const [k, href] of Object.entries(GO_KEYS)) {
      expect(href.startsWith('/')).toBe(true);
      expect(step({ key: k }, { pending: true, at: 0 }, 10).action).toEqual({ type: 'go', href });
    }
    expect(CHEATSHEET.filter((c) => c.id.startsWith('go_'))).toHaveLength(Object.keys(GO_KEYS).length);
  });
  it('n, ? and Esc', () => {
    expect(step({ key: 'n' }, IDLE, 0).action).toEqual({ type: 'new_fillup' });
    expect(step({ key: '?', shift: true }, IDLE, 0).action).toEqual({ type: 'cheatsheet' });
    expect(step({ key: 'Escape', typing: true }, IDLE, 0).action).toEqual({ type: 'close' });
  });
});
