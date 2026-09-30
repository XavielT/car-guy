import type { DiagnosticEntry } from '../diagnostics';
import { redactDeep, redactText } from './redact';

/**
 * The jsonb `p` that carguy.submit_feedback (sql/021) takes. Built by a pure
 * function so the test can prove what leaves the phone: everything the app
 * fills in by itself is redacted; only the message and the optional email —
 * typed by the user for this purpose — go as written.
 */
export type FeedbackKind = 'bug' | 'idea' | 'otro';
export const FEEDBACK_KINDS: readonly FeedbackKind[] = ['bug', 'idea', 'otro'];

export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 4000;
/** The last N ring-buffer entries (lib/diagnostics.ts keeps 20). */
export const DIAGNOSTICS_LIMIT = 20;

export type FeedbackDraft = {
  kind: FeedbackKind;
  message: string;
  email?: string | null;
};

/** What the device knows about itself when the form opens (lib/feedback/context.ts). */
export type FeedbackContext = {
  appVersion: string | null;
  build: string | null;
  gitSha: string | null;
  variant: string | null;
  platform: string;
  osVersion: string | null;
  device: string | null;
  screen: string | null;
  flags: Record<string, boolean>;
  dbVersion: number | null;
  sync: { signedIn: boolean; state: string; pending: number | null; lastSyncAt: string | null; message?: string | null };
  diagnosticsMode: boolean;
  errors: DiagnosticEntry[];
  /** Exact values that must not leave the device: plates, VINs, the session email. */
  secrets: string[];
};

export type FeedbackPayload = {
  id: string;
  kind: FeedbackKind;
  message: string;
  email: string | null;
  device_id: string;
  app_version: string | null;
  build: string | null;
  platform: string;
  os_version: string | null;
  device: string | null;
  screen: string | null;
  diagnostics: {
    git_sha: string | null;
    variant: string | null;
    flags: Record<string, boolean>;
    db_version: number | null;
    sync: FeedbackContext['sync'];
    diagnostics_mode: boolean;
    errors: DiagnosticEntry[];
  };
};

export function validateDraft(draft: FeedbackDraft): 'kind' | 'short' | 'long' | 'email' | null {
  if (!FEEDBACK_KINDS.includes(draft.kind)) return 'kind';
  const length = draft.message.trim().length;
  if (length < MESSAGE_MIN) return 'short';
  if (length > MESSAGE_MAX) return 'long';
  const email = draft.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'email';
  return null;
}

/** Keeps a route's path, drops its query (search terms, prefilled values). */
function cleanRoute(route: string | null): string | null {
  if (!route) return null;
  return route.split('?')[0].slice(0, 200);
}

export function buildPayload(input: { id: string; deviceId: string; draft: FeedbackDraft; context: FeedbackContext }): FeedbackPayload {
  const { id, deviceId, draft, context } = input;
  const secrets = context.secrets;
  const r = (text: string | null) => (text == null ? null : redactText(text, secrets));
  const email = draft.email?.trim() || null;

  return {
    id,
    kind: draft.kind,
    message: draft.message.trim().slice(0, MESSAGE_MAX),
    email,
    device_id: deviceId,
    app_version: r(context.appVersion),
    build: r(context.build),
    platform: context.platform,
    os_version: r(context.osVersion),
    device: r(context.device)?.slice(0, 120) ?? null,
    screen: r(cleanRoute(context.screen)),
    diagnostics: {
      // A commit hash is long hex by design; it is the one opaque string we want.
      git_sha: context.gitSha,
      ...redactDeep(
        {
          variant: context.variant,
          flags: context.flags,
          db_version: context.dbVersion,
          sync: { ...context.sync, message: context.sync.message?.slice(0, 300) ?? null },
          diagnostics_mode: context.diagnosticsMode,
          errors: context.errors.slice(-DIAGNOSTICS_LIMIT).map((e) => ({ at: e.at, where: e.where, message: e.message.slice(0, 500) })),
        },
        secrets,
      ),
    },
  };
}
