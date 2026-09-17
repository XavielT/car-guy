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
