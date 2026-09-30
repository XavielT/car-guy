import type { FeedbackPayload } from './payload';

/**
 * Comments written offline (03-screens.md "Enviar comentario": `feedback_outbox`
 * in AsyncStorage), sent on the next launch.
 *
 * Idempotent by construction: each payload carries its client-generated id,
 * and carguy.submit_feedback treats a second call with the same id as a no-op
 * (sql/021). So a send whose answer was lost — the row landed, the phone never
 * heard — is safe to repeat; it never makes a second row.
 *
 * Built as a factory over a storage and a sender so the test can drive it with
 * fakes; `lib/feedback/index.ts` wires the real ones.
 */
export type OutboxItem = { payload: FeedbackPayload; screenshotUri: string | null; queuedAt: string };

/** `retry`: keep it for the next launch (offline, server not ready, rate limit). `drop`: the server refused it for good. */
export type DeliverResult = { ok: true } | { ok: false; retry: boolean };

export type OutboxStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export const OUTBOX_KEY = 'feedback_outbox';
/** Older than this and it is dropped: a two-week-old "se cerró" is noise by then. */
export const OUTBOX_MAX_AGE_MS = 14 * 24 * 3600 * 1000;
export const OUTBOX_MAX_ITEMS = 20;

export type FlushReport = { sent: number; kept: number; dropped: number };

export function createOutbox(deps: {
  storage: OutboxStorage;
  deliver: (item: OutboxItem) => Promise<DeliverResult>;
  now?: () => number;
}) {
  const now = deps.now ?? (() => Date.now());

  async function read(): Promise<OutboxItem[]> {
    try {
      const raw = await deps.storage.getItem(OUTBOX_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? (parsed as OutboxItem[]).filter((i) => i?.payload?.id) : [];
    } catch {
      return [];
    }
  }

  async function write(items: OutboxItem[]): Promise<void> {
    try {
      await deps.storage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-OUTBOX_MAX_ITEMS)));
    } catch {
      // Storage blocked: the comment is lost with the tab, as anything else would be.
    }
  }

  async function enqueue(item: OutboxItem): Promise<void> {
    const items = await read();
    if (items.some((i) => i.payload.id === item.payload.id)) return;
    await write([...items, item]);
  }

  let running: Promise<FlushReport> | null = null;

  /** One flush at a time; a second call while one runs gets the same promise. */
  function flush(): Promise<FlushReport> {
    if (running) return running;
    running = (async () => {
      const items = await read();
      const resolved = new Set<string>();
      let sent = 0;
      let dropped = 0;
      let stop = false;
      for (const item of items) {
        const age = now() - Date.parse(item.queuedAt);
        if (Number.isFinite(age) && age > OUTBOX_MAX_AGE_MS) {
          resolved.add(item.payload.id);
          dropped += 1;
          continue;
        }
        if (stop) continue;
        let result: DeliverResult;
        try {
          result = await deps.deliver(item);
        } catch {
          result = { ok: false, retry: true };
        }
        if (result.ok) {
          resolved.add(item.payload.id);
          sent += 1;
        } else if (!result.retry) {
          resolved.add(item.payload.id);
          dropped += 1;
        } else {
          // Offline or not ready: the rest will fail the same way.
          stop = true;
        }
      }
      // Re-read: something may have been queued while this ran.
      const current = await read();
      const left = current.filter((i) => !resolved.has(i.payload.id));
      if (resolved.size) await write(left);
      return { sent, kept: left.length, dropped };
    })().finally(() => {
      running = null;
    });
    return running;
  }

  return { read, enqueue, flush };
}
