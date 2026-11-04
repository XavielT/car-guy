/**
 * Expiry intelligence for documents (IMP 03112026 SPEC-C §C3, PROMPT-03 step 4). Deterministic, pure.
 *
 * A document saved with an expiry date and NO linked reminder (an `otro`/`garantia`/`matricula` paper, or a legal one whose
 * seeded reminder is missing) gets a "Crear recordatorio" suggestion. An expired document is still suggested, flagged as
 * expired (the Marbete y seguro telltale already turns red for the legal ones: nothing new there).
 * SPEC-C names `lib/domain/predict.ts`; that file belongs to SPEC-E and does not exist yet, so this lives on its own and
 * can be re-exported from there (decision D-28).
 */
import type { DocumentKind, LegalKind } from '../db/types';

export type ExpiryDoc = {
  id: string;
  vehicleId: string;
  kind: DocumentKind;
  title: string;
  expiresAt: string | null;
  reminderId: string | null;
};

export type ExpiryStatus = 'expired' | 'soon' | 'later';

export type ExpirySuggestion = {
  documentId: string;
  vehicleId: string;
  kind: DocumentKind;
  title: string;
  /** YYYY-MM-DD */
  expiresAt: string;
  status: ExpiryStatus;
  /** Negative when already expired. */
  daysLeft: number;
  /** The date the reminder should be due: the expiry itself (the reminder system adds its own lead time). */
  dueDate: string;
  legalKind: LegalKind | null;
};

/** "Soon" = within this many days. */
export const SOON_DAYS = 60;

const LEGAL: Partial<Record<DocumentKind, LegalKind>> = { seguro: 'seguro', marbete: 'marbete', licencia: 'licencia' };

const day = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000 : null;
};

/** `today` is the person's local YYYY-MM-DD. Documents without an expiry, or already linked to a reminder, are left out. */
export function suggestExpiryReminders(docs: ExpiryDoc[], today: string): ExpirySuggestion[] {
  const t = day(today);
  if (t == null) return [];
  const out: ExpirySuggestion[] = [];
  for (const d of docs) {
    if (!d.expiresAt || d.reminderId) continue;
    const e = day(d.expiresAt);
    if (e == null) continue;
    const daysLeft = Math.round(e - t);
    const dueDate = d.expiresAt.slice(0, 10);
    out.push({
      documentId: d.id,
      vehicleId: d.vehicleId,
      kind: d.kind,
      title: d.title,
      expiresAt: dueDate,
      status: daysLeft < 0 ? 'expired' : daysLeft <= SOON_DAYS ? 'soon' : 'later',
      daysLeft,
      dueDate,
      legalKind: LEGAL[d.kind] ?? null,
    });
  }
  // Expired first, then the nearest expiry.
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
