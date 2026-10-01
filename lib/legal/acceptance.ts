import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { now } from '../db/client';
import { legalAcceptances } from '../db/repos';
import { getDeviceId } from '../feedback/deviceId';
import { currentLanguage } from '../i18n';
import { acceptanceRow, LEGAL_VERSION, needsAcceptance, type LegalAcceptanceRow } from './index';

/**
 * The device side of legal acceptance (ADR-47): the rows live in `legal_acceptance` (local SQLite,
 * synced when signed in), so accepting on one phone counts on the next after a sync. Nothing here
 * blocks local use; only account creation requires an acceptance (app/cuenta.tsx).
 */

let rows: LegalAcceptanceRow[] | null = null;
/** "Ahora no" hides the sheet until the next launch, never longer. */
let dismissedThisSession = false;
const listeners = new Set<() => void>();
let snapshot: { rows: LegalAcceptanceRow[] | null; dismissed: boolean } = { rows, dismissed: dismissedThisSession };

function emit(): void {
  snapshot = { rows, dismissed: dismissedThisSession };
  for (const l of listeners) l();
}

export async function loadAcceptances(): Promise<LegalAcceptanceRow[]> {
  try {
    rows = (await legalAcceptances.list()) as LegalAcceptanceRow[];
  } catch {
    rows = rows ?? [];
  }
  emit();
  return rows;
}

/** Records an acceptance of the current version, once (a second call is a no-op). */
export async function recordAcceptance(): Promise<void> {
  const current = rows ?? (await loadAcceptances());
  if (!needsAcceptance(current)) return;
  await legalAcceptances.upsert(
    acceptanceRow({ locale: currentLanguage(), platform: Platform.OS, deviceId: await getDeviceId(), now: now() }),
  );
  await loadAcceptances();
}

export function dismissForSession(): void {
  dismissedThisSession = true;
  emit();
}

export type LegalState = {
  /** null until the table was read once. */
  rows: LegalAcceptanceRow[] | null;
  needs: boolean;
  dismissed: boolean;
};

/** The acceptances on this device; re-read on mount (a sync may have brought another phone's). */
export function useLegalAcceptance(): LegalState {
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
  useEffect(() => {
    void loadAcceptances();
  }, []);
  return {
    rows: state.rows,
    needs: state.rows != null && needsAcceptance(state.rows, LEGAL_VERSION),
    dismissed: state.dismissed,
  };
}
