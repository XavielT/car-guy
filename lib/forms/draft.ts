/**
 * Form drafts (IMP 03112026 "borradores"): what a person typed into a long form survives leaving it (a phone call, the back
 * button, the system killing the app) for a week, and is offered back, never applied silently.
 *
 * Pure rules here (what is worth keeping, how old is too old, how to word the age); the store is the local settings table.
 * Nothing leaves the phone: drafts are not synced.
 */
export const DRAFT_TTL_MS = 7 * 86_400_000;
const PREFIX = 'draft:';

export type Draft<T> = { at: number; values: T };

/** A draft is worth keeping once at least one field has real text (spaces and untouched defaults do not count). */
export function worthKeeping(values: Record<string, string | null | undefined>, defaults: Record<string, string> = {}): boolean {
  return Object.entries(values).some(([k, v]) => {
    const text = (v ?? '').trim();
    return text !== '' && text !== (defaults[k] ?? '');
  });
}

export function isFresh(draft: Draft<unknown> | null | undefined, now: number): boolean {
  return Boolean(draft && typeof draft.at === 'number' && now - draft.at >= 0 && now - draft.at <= DRAFT_TTL_MS);
}

export type DraftAge = { unit: 'minutes' | 'hours' | 'days'; n: number };

/** How old a draft is, in the coarsest honest unit (1 minute minimum). */
export function draftAge(at: number, now: number): DraftAge {
  const minutes = Math.max(1, Math.round((now - at) / 60_000));
  if (minutes < 60) return { unit: 'minutes', n: minutes };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { unit: 'hours', n: hours };
  return { unit: 'days', n: Math.round(hours / 24) };
}

async function repo() {
  return (await import('../db/repos')).settings;
}

export async function loadDraft<T>(key: string, now = Date.now()): Promise<Draft<T> | null> {
  try {
    const d = await (await repo()).get<Draft<T> | null>(PREFIX + key, null);
    return isFresh(d, now) ? d : null;
  } catch {
    return null;
  }
}

export async function saveDraft<T>(key: string, values: T, now = Date.now()): Promise<void> {
  try {
    await (await repo()).set(PREFIX + key, { at: now, values } satisfies Draft<T>);
  } catch {
    // a draft is a convenience; never break the form
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    await (await repo()).set(PREFIX + key, null);
  } catch {
    // nothing to clear
  }
}
