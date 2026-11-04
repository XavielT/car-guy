/**
 * Admin triage draft, the app side of `cg-ai-triage` (IMP 03112026 SPEC-E §E6). The admin opens one comment and asks for a DRAFT:
 * category, area, severity, a one-line summary, a suggested reply and questions to ask. Nothing is sent or saved by asking: the
 * admin reads it, edits it and sends it themselves (mail client). The function is admin-only and redacts the message again.
 */
import type { TriageDraft } from '../../supabase/functions/cg-ai-triage/triage';
import { callAi } from './client';

export type { TriageDraft };

export type TriageSource = { kind: string; message: string; screen: string | null; app_version: string | null; platform: string | null };

export function triageRequest(row: TriageSource) {
  return { kind: row.kind, message: row.message, screen: row.screen, appVersion: row.app_version, platform: row.platform };
}

export async function askTriage(row: TriageSource): Promise<TriageDraft> {
  return callAi<TriageDraft>('cg-ai-triage', triageRequest(row));
}

/** The mail the admin would send: the draft reply as the body. Never opened without the admin pressing the button. */
export function mailtoFor(email: string, subject: string, reply: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(reply)}`;
}
