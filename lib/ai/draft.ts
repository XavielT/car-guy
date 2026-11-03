/**
 * The AI draft store (IMP 03112026 SPEC-B §B2/§B3, ADR-67): how a read or a dictated sentence reaches an EXISTING form.
 * A capture button (or the intent router) puts a draft here and navigates; the form takes it on mount, fills its
 * fields, shows the small "AI" mark on each and the amber outline on the unsure ones. The draft is consumed once
 * (`takeAiDraft` clears it) and never persisted: if the app closes, it is gone, and the form was never saved anyway.
 * Nothing in this module saves anything.
 */
import { useSyncExternalStore } from 'react';

export type DraftForm = 'fuel' | 'service' | 'repair' | 'expense' | 'odometer' | 'reminder' | 'task' | 'event';

/** A photo that stays attached to the record when the person saves (role per SPEC-B §B2/§B7). */
export type DraftPhoto = { uri: string; role: 'invoice' | 'odometer_photo' | 'other' };

export type AiDraft = {
  form: DraftForm;
  /** The values as the form's inputs hold them (strings), only for fields the AI filled. Shape per form. */
  prefill: Record<string, unknown>;
  /** Confidence 0..1 per AI-filled field; drives the mark and the outline. */
  marks: Record<string, number>;
  photos: DraftPhoto[];
  source: 'photo' | 'voice' | 'text' | 'express';
  /** The vehicle the draft is for, when known (the form switches to it). */
  vehicleId: string | null;
  createdAt: number;
};

const drafts = new Map<DraftForm, AiDraft>();
const listeners = new Set<() => void>();
/** A draft older than this is stale (the person wandered off): it is not applied. */
export const DRAFT_TTL_MS = 10 * 60_000;

const emit = () => listeners.forEach((l) => l());

export function setAiDraft(d: Omit<AiDraft, 'createdAt'> & { createdAt?: number }): void {
  drafts.set(d.form, { ...d, createdAt: d.createdAt ?? Date.now() });
  emit();
}

/** The draft for a form without consuming it (null when none or stale). */
export function peekAiDraft(form: DraftForm, now: number = Date.now()): AiDraft | null {
  const d = drafts.get(form);
  if (!d) return null;
  if (now - d.createdAt > DRAFT_TTL_MS) {
    drafts.delete(form);
    return null;
  }
  return d;
}

/** The draft for a form, removed from the store (null when none or stale). The form calls this once, on mount. */
export function takeAiDraft(form: DraftForm, now: number = Date.now()): AiDraft | null {
  const d = peekAiDraft(form, now);
  if (d) {
    drafts.delete(form);
    emit();
  }
  return d;
}

export function clearAiDraft(form?: DraftForm): void {
  if (form) drafts.delete(form);
  else drafts.clear();
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Re-renders when a draft for this form is set or consumed (the capture button navigates; the form reads on mount). */
export function useHasAiDraft(form: DraftForm): boolean {
  return useSyncExternalStore(subscribe, () => drafts.has(form), () => false);
}

/** Editing a field removes its mark: the person's value is theirs now. */
export function withoutMark(marks: Record<string, number>, field: string): Record<string, number> {
  if (!(field in marks)) return marks;
  const next = { ...marks };
  delete next[field];
  return next;
}
