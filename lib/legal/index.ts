/**
 * Terms and privacy acceptance (IMP 30092026 note 15, data model v8 §1.5, ADR-47). Pure.
 *
 * `legal_acceptance` is synced, so a signed-in person who accepted on one phone
 * is not asked again on the next. Bumping LEGAL_VERSION (a real change to the
 * terms or the privacy notice) asks everyone once more.
 */

/** The terms/privacy version the app ships; the public pages print the same one. */
export const LEGAL_VERSION = '2026-10';

export type LegalAcceptanceRow = {
  id: string;
  version: string;
  acceptedAt: string;
  locale: string;
  platform: string;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

/** The newest live acceptance (by acceptedAt), any version; null when none. */
export function latestAcceptance<T extends LegalAcceptanceRow>(acceptances: readonly T[]): T | null {
  let best: T | null = null;
  for (const a of acceptances) {
    if (a.deletedAt) continue;
    if (!best || a.acceptedAt.localeCompare(best.acceptedAt) > 0) best = a;
  }
  return best;
}

/** True until a live acceptance of exactly `version` exists — the first-launch sheet shows while this holds. */
export function needsAcceptance(acceptances: readonly LegalAcceptanceRow[], version: string = LEGAL_VERSION): boolean {
  return !acceptances.some((a) => !a.deletedAt && a.version === version);
}
