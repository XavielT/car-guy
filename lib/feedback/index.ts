import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';

import { getDeviceId, uuidv4 } from './deviceId';
import { createOutbox } from './outbox';
import { buildPayload, type FeedbackContext, type FeedbackDraft } from './payload';
import { deliverNow, deliverQueued } from './send';

/**
 * Enviar comentario (PROMPT-06 item 4, ADR-35). Entry points: Más, the
 * "Reportar" link on error alerts (lib/alert.ts), and the versiones screen —
 * each pushes FEEDBACK_ROUTE, or calls openFeedback().
 */
export const FEEDBACK_ROUTE = '/comentario';
/** Comentarios recibidos — only reachable for the admin session (lib/cloud/admin.ts). */
export const ADMIN_FEEDBACK_ROUTE = '/admin/comentarios';

export const outbox = createOutbox({ storage: AsyncStorage, deliver: deliverQueued });

export type SendOutcome =
  | { status: 'sent'; screenshot: 'none' | 'ok' | 'failed' }
  | { status: 'queued' }
  | { status: 'rate_limited' }
  | { status: 'error' };

export async function sendFeedback(draft: FeedbackDraft, context: FeedbackContext, screenshotUri: string | null): Promise<SendOutcome> {
  const payload = buildPayload({ id: uuidv4(), deviceId: await getDeviceId(), draft, context });
  const { outcome, screenshot } = await deliverNow(payload, screenshotUri);
  switch (outcome) {
    case 'sent':
      return { status: 'sent', screenshot };
    case 'rate_limited':
      return { status: 'rate_limited' };
    case 'network':
      await outbox.enqueue({ payload, screenshotUri, queuedAt: new Date().toISOString() });
      return { status: 'queued' };
    default:
      return { status: 'error' };
  }
}

// The route the user was on before opening the form — kept by useFeedbackBoot.
let lastRoute: string | null = null;

export function noteRoute(pathname: string | null | undefined): void {
  if (!pathname || pathname.startsWith(FEEDBACK_ROUTE) || pathname.startsWith('/admin')) return;
  lastRoute = pathname;
}

export function lastVisitedRoute(): string | null {
  return lastRoute;
}

/** Opens the form, e.g. from an error alert's "Reportar". */
export function openFeedback(kind: FeedbackDraft['kind'] = 'bug'): void {
  router.push({ pathname: FEEDBACK_ROUTE, params: { kind, from: lastRoute ?? '' } } as unknown as Href);
}
