/**
 * @handle rules (IMP 01102026 Phase 5, ADR-54; the cloud's CHECK in sql/034): 3–20 of a–z, 0–9, _. Pure — the
 * profile field normalises as the person types and says why a handle cannot be used before asking the cloud.
 */
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

/** What someone typed → the handle it would be: no "@", lower case, accents folded, spaces as "_". */
export function normalizeHandle(input: string): string {
  return input
    .trim()
    .replace(/^@+/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

export type HandleProblem = 'short' | 'format' | null;

export function handleProblem(handle: string): HandleProblem {
  if (handle.length < 3) return 'short';
  return HANDLE_RE.test(handle) ? null : 'format';
}

/** Instagram user names: letters, digits, "." and "_", ≤ 30; stored without the "@". */
export function normalizeInstagram(input: string): string | null {
  const v = input.trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}
