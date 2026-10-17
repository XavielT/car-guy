import { useSyncExternalStore } from 'react';

import type { ResolvedPending } from './serviceOps';

/**
 * "Pendiente resuelto · Deshacer" (IMP 16102026 X7): the repair form saves and moves on to the repair's detail, so what
 * it closed travels in a tiny module store that the detail reads. It clears itself after 10 s (the undo window).
 */
export const UNDO_WINDOW_MS = 10_000;

type Entry = { resolved: ResolvedPending; recordId: string } | null;
let current: Entry = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function offerUndo(resolved: ResolvedPending, recordId: string): void {
  current = { resolved, recordId };
  if (timer) clearTimeout(timer);
  timer = setTimeout(clearUndo, UNDO_WINDOW_MS);
  emit();
}

export function clearUndo(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  emit();
}

export function useUndoOffer(): Entry {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}

/** For tests. */
export const __peekUndo = () => current;
