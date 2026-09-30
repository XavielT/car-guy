import type { Tone } from '@/components/ui';
import type { FeedbackStatus } from '@/lib/feedback/inbox';
import { localeTag, t } from '@/lib/i18n';

/** Shared by the inbox list and the detail (app/admin/comentarios*). */
export const STATUS_TONE: Record<string, Tone> = { new: 'urgente', seen: 'proximo', done: 'ok' };

export function kindLabel(kind: string): string {
  return t.feedback.kinds[kind as keyof typeof t.feedback.kinds] ?? kind;
}

export function statusLabel(status: string): string {
  return t.feedback.admin.statuses[status as FeedbackStatus] ?? status;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })}`;
}
