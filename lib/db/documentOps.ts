import { enqueue } from './client';
import { documents as documentRepo, reminders as reminderRepo } from './repos';
import type { DocumentKind, LegalKind } from './types';
import { id as newId } from '../format';

/** Documents whose expiry *is* a legal deadline the app already tracks. */
const LEGAL_BY_KIND: Partial<Record<DocumentKind, LegalKind>> = {
  seguro: 'seguro',
  marbete: 'marbete',
  licencia: 'licencia',
};

export type DocumentDraft = {
  id?: string;
  vehicleId: string;
  kind: DocumentKind;
  title: string;
  issuedAt: string | null;
  expiresAt: string | null;
  mediaId: string | null;
  notes: string;
};

/**
 * Saves a document and, when it carries a real expiry, moves the matching legal
 * reminder onto that date.
 *
 * This is the only place the app learns when your insurance actually expires.
 * The seeded `seguro` reminder starts with no date at all — it cannot know —
 * so photographing the policy is what turns it from a placeholder into
 * something that can warn you.
 */
export async function saveDocument(draft: DocumentDraft): Promise<{ id: string; linked: boolean }> {
  const documentId = draft.id ?? newId();

  const linked = await enqueue(async (db) => {
    const legalKind = LEGAL_BY_KIND[draft.kind];
    let reminderId: string | null = null;

    if (legalKind && draft.expiresAt) {
      const existing = (await reminderRepo.listWhere({ vehicleId: draft.vehicleId, legalKind }))[0];
      if (existing) {
        await reminderRepo.upsert({ id: existing.id, dueDate: draft.expiresAt, isEnabled: true }, db);
        reminderId = existing.id;
      }
    }

    await documentRepo.upsert(
      {
        id: documentId,
        vehicleId: draft.vehicleId,
        kind: draft.kind,
        title: draft.title,
        issuedAt: draft.issuedAt,
        expiresAt: draft.expiresAt,
        reminderId,
        mediaId: draft.mediaId,
        notes: draft.notes,
      },
      db,
    );

    return reminderId != null;
  });

  return { id: documentId, linked };
}

/**
 * The C3 "Crear recordatorio" suggestion (IMP 03112026 SPEC-C §C3): a document with an expiry and no reminder gets one.
 * A legal kind (seguro, marbete, licencia) re-arms the legal reminder the app already tracks, exactly as `saveDocument`
 * does, so it can never create a duplicate of it; any other kind gets its own one-off date reminder due on the expiry.
 * Returns the reminder id, or null when the document has no expiry.
 */
export async function createDocumentReminder(doc: { id: string; vehicleId: string; kind: DocumentKind; title: string; expiresAt: string | null }): Promise<string | null> {
  if (!doc.expiresAt) return null;
  return enqueue(async (db) => {
    const legalKind = LEGAL_BY_KIND[doc.kind];
    let reminderId: string | null = null;
    if (legalKind) {
      const existing = (await reminderRepo.listWhere({ vehicleId: doc.vehicleId, legalKind }))[0];
      if (existing) {
        await reminderRepo.upsert({ id: existing.id, dueDate: doc.expiresAt, isEnabled: true }, db);
        reminderId = existing.id;
      }
    }
    if (!reminderId) {
      const saved = await reminderRepo.upsert(
        {
          vehicleId: doc.vehicleId,
          title: doc.title,
          serviceTypeId: null,
          metric: 'date',
          dueDate: doc.expiresAt,
          dueKm: null,
          isRecurring: false,
          thresholdDays: 30,
          notes: '',
          isEnabled: true,
          snoozedUntil: null,
        },
        db,
      );
      reminderId = saved.id;
    }
    await documentRepo.upsert({ id: doc.id, reminderId }, db);
    return reminderId;
  });
}
