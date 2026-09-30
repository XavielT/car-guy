import type { Tone } from '@/components/ui';
import type { FeedbackStatus } from '@/lib/feedback/inbox';
import { es } from '@/lib/i18n/es';

/** Shared by the inbox list and the detail (app/admin/comentarios*). */
export const STATUS_TONE: Record<string, Tone> = { new: 'urgente', seen: 'proximo', done: 'ok' };

export function kindLabel(kind: string): string {
  return es.feedback.kinds[kind as keyof typeof es.feedback.kinds] ?? kind;
}

export function statusLabel(status: string): string {
  return es.feedback.admin.statuses[status as FeedbackStatus] ?? status;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`;
}
