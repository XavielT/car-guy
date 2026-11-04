/**
 * Desktop keyboard shortcuts (IMP 03112026 SPEC-F §F3). Pure: `step` takes the key that was pressed and the state (is a "g" chord open)
 * and says what to do. The hook that listens to `keydown` lives in useDesktopShortcuts.ts.
 *
 *   /  or  Ctrl/Cmd+K     open the Herramientas search (natural language works there, G1)
 *   g then i/g/c/h/t/m    go to Inicio / Garaje / Conducir / Historial / Herramientas / Más
 *   n                     new fill-up
 *   ?                     the shortcut cheat-sheet
 *   Esc                   close the cheat-sheet
 * Nothing fires while the person is typing in a field, and a modifier other than Ctrl/Cmd+K is never ours (browser shortcuts stay).
 */
export type KeyInput = { key: string; ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean; typing?: boolean };

export type ShortcutAction =
  | { type: 'go'; href: string }
  | { type: 'search' }
  | { type: 'new_fillup' }
  | { type: 'cheatsheet' }
  | { type: 'close' };

export const GO_KEYS: Record<string, string> = { i: '/', g: '/garaje', c: '/conducir', h: '/historial', t: '/herramientas', m: '/mas' };
/** How long after "g" the second key still counts. */
export const CHORD_MS = 1200;

export type ChordState = { pending: boolean; at: number };
export const IDLE: ChordState = { pending: false, at: 0 };

export function step(input: KeyInput, state: ChordState, now: number): { action: ShortcutAction | null; state: ChordState } {
  const k = input.key;
  // Ctrl/Cmd+K works even from a text field: it is the "search" gesture of every web app.
  if ((input.ctrl || input.meta) && !input.alt && k.toLowerCase() === 'k') return { action: { type: 'search' }, state: IDLE };
  if (k === 'Escape') return { action: { type: 'close' }, state: IDLE };
  if (input.typing || input.ctrl || input.meta || input.alt) return { action: null, state: IDLE };

  if (state.pending && now - state.at <= CHORD_MS) {
    const href = GO_KEYS[k.toLowerCase()];
    return { action: href ? { type: 'go', href } : null, state: IDLE };
  }
  if (k === 'g' && !input.shift) return { action: null, state: { pending: true, at: now } };
  if (k === '/') return { action: { type: 'search' }, state: IDLE };
  if (k === '?') return { action: { type: 'cheatsheet' }, state: IDLE };
  if (k === 'n' && !input.shift) return { action: { type: 'new_fillup' }, state: IDLE };
  return { action: null, state: IDLE };
}

/** What the cheat-sheet lists, in order. `keys` are shown as separate key caps. */
export const CHEATSHEET: { keys: string[]; id: 'search' | 'go_inicio' | 'go_garaje' | 'go_conducir' | 'go_historial' | 'go_herramientas' | 'go_mas' | 'new_fillup' | 'cheatsheet' | 'close' }[] = [
  { keys: ['/'], id: 'search' },
  { keys: ['Ctrl', 'K'], id: 'search' },
  { keys: ['g', 'i'], id: 'go_inicio' },
  { keys: ['g', 'g'], id: 'go_garaje' },
  { keys: ['g', 'c'], id: 'go_conducir' },
  { keys: ['g', 'h'], id: 'go_historial' },
  { keys: ['g', 't'], id: 'go_herramientas' },
  { keys: ['g', 'm'], id: 'go_mas' },
  { keys: ['n'], id: 'new_fillup' },
  { keys: ['?'], id: 'cheatsheet' },
  { keys: ['Esc'], id: 'close' },
];
