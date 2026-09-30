/**
 * The offline outbox (PROMPT-06 item 4): flushed on launch, and idempotent —
 * a send whose answer was lost is repeated with the same id, and the server
 * (carguy.submit_feedback, sql/021: same id → no-op) never gets two rows.
 */
import { createOutbox, OUTBOX_KEY, OUTBOX_MAX_AGE_MS, type DeliverResult, type OutboxItem } from '@/lib/feedback/outbox';
import type { FeedbackPayload } from '@/lib/feedback/payload';

function memoryStorage() {
  const map = new Map<string, string>();
  return { map, getItem: async (k: string) => map.get(k) ?? null, setItem: async (k: string, v: string) => void map.set(k, v) };
}

/** The RPC's contract: rows keyed by id; a known id is accepted again without a new row. */
function fakeServer() {
  const rows = new Map<string, FeedbackPayload>();
  return {
    rows,
    submit(payload: FeedbackPayload) {
      if (!rows.has(payload.id)) rows.set(payload.id, payload);
    },
  };
}

const NOW = Date.parse('2026-09-29T12:00:00Z');

function item(id: string, queuedAt = new Date(NOW - 60_000).toISOString()): OutboxItem {
  return { payload: { id, kind: 'bug', message: `mensaje ${id}`, device_id: 'dev' } as FeedbackPayload, screenshotUri: null, queuedAt };
}

describe('outbox', () => {
  it('a lost answer is retried with the same id and never makes a second row', async () => {
    const storage = memoryStorage();
    const server = fakeServer();
    let loseAnswer = true;
    const deliver = jest.fn(async (i: OutboxItem): Promise<DeliverResult> => {
      server.submit(i.payload);
      if (loseAnswer) throw new Error('Network request failed'); // the row landed, the phone never heard
      return { ok: true };
    });
    const outbox = createOutbox({ storage, deliver, now: () => NOW });
    await outbox.enqueue(item('a'));
    await outbox.enqueue(item('a')); // queued twice by a double tap: one item

    expect(await outbox.flush()).toEqual({ sent: 0, kept: 1, dropped: 0 });
    loseAnswer = false;
    expect(await outbox.flush()).toEqual({ sent: 1, kept: 0, dropped: 0 });
    expect(await outbox.flush()).toEqual({ sent: 0, kept: 0, dropped: 0 });

    expect(server.rows.size).toBe(1);
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(JSON.parse(storage.map.get(OUTBOX_KEY)!)).toEqual([]);
  });

  it('two flushes at once share one run', async () => {
    const server = fakeServer();
    const deliver = jest.fn(async (i: OutboxItem): Promise<DeliverResult> => {
      await new Promise((r) => setTimeout(r, 5));
      server.submit(i.payload);
      return { ok: true };
    });
    const outbox = createOutbox({ storage: memoryStorage(), deliver, now: () => NOW });
    await outbox.enqueue(item('a'));
    await outbox.enqueue(item('b'));
    const [first, second] = await Promise.all([outbox.flush(), outbox.flush()]);
    expect(first).toBe(second);
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(server.rows.size).toBe(2);
  });

  it('stops at the first retryable failure, drops refusals and stale items, keeps the rest', async () => {
    const results: Record<string, DeliverResult> = { refused: { ok: false, retry: false }, offline: { ok: false, retry: true } };
    const deliver = jest.fn(async (i: OutboxItem) => results[i.payload.id] ?? { ok: true });
    const outbox = createOutbox({ storage: memoryStorage(), deliver, now: () => NOW });
    await outbox.enqueue(item('old', new Date(NOW - OUTBOX_MAX_AGE_MS - 1).toISOString()));
    await outbox.enqueue(item('ok1'));
    await outbox.enqueue(item('refused'));
    await outbox.enqueue(item('offline'));
    await outbox.enqueue(item('after'));

    expect(await outbox.flush()).toEqual({ sent: 1, kept: 2, dropped: 2 });
    expect((await outbox.read()).map((i) => i.payload.id)).toEqual(['offline', 'after']);
    expect(deliver.mock.calls.map(([i]) => i.payload.id)).toEqual(['ok1', 'refused', 'offline']);
  });

  it('keeps what was queued while a flush ran', async () => {
    let outbox: ReturnType<typeof createOutbox>;
    const deliver = jest.fn(async (i: OutboxItem): Promise<DeliverResult> => {
      if (i.payload.id === 'a') await outbox.enqueue(item('late'));
      return { ok: true };
    });
    outbox = createOutbox({ storage: memoryStorage(), deliver, now: () => NOW });
    await outbox.enqueue(item('a'));
    await outbox.flush();
    expect((await outbox.read()).map((i) => i.payload.id)).toEqual(['late']);
  });

  it('survives garbage in storage', async () => {
    const storage = memoryStorage();
    storage.map.set(OUTBOX_KEY, '{not json');
    const outbox = createOutbox({ storage, deliver: async () => ({ ok: true }), now: () => NOW });
    expect(await outbox.flush()).toEqual({ sent: 0, kept: 0, dropped: 0 });
  });
});
