import { enqueue, getDb, now } from './client';
import { id as newId } from '../format';

/**
 * Data access for `ai_queue` (schema v13, IMP 03112026 SPEC-B §B7.6): the local-only queue of Fuel Express reads waiting
 * for a connection. Never synced, never backed up. A job is the compressed photos (base64 JSON) plus a status:
 * queued → processing → ready (the person confirms) | failed | dropped ("Llenarlo a mano") | expired (7 days).
 */
export type AiJobStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'dropped' | 'expired';
export type AiJobKind = 'fuel_express';

export type AiJob = {
  id: string;
  kind: AiJobKind;
  vehicleId: string;
  imagesB64: string[];
  imageUris: string[];
  status: AiJobStatus;
  attempts: number;
  resultJson: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string; kind: AiJobKind; vehicle_id: string; images_b64: string; image_uris: string; status: AiJobStatus;
  attempts: number; result_json: string | null; error_code: string | null; created_at: string; updated_at: string;
};

const parseList = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

function fromRow(r: Row): AiJob {
  return {
    id: r.id, kind: r.kind, vehicleId: r.vehicle_id, imagesB64: parseList(r.images_b64), imageUris: parseList(r.image_uris),
    status: r.status, attempts: r.attempts, resultJson: r.result_json, errorCode: r.error_code, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Jobs older than this expire without ever being sent (SPEC-B §B7.6). */
export const AI_JOB_TTL_DAYS = 7;
/** A job that fails this many times for a reason that is not "no connection" is given up on. */
export const AI_JOB_MAX_ATTEMPTS = 3;

export async function enqueueAiJob(input: { kind: AiJobKind; vehicleId: string; imagesB64: string[]; imageUris: string[] }): Promise<string> {
  const id = newId();
  const at = now();
  await enqueue(async (db) => {
    await db.runAsync(
      `INSERT INTO ai_queue (id, kind, vehicle_id, images_b64, image_uris, status, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?)`,
      [id, input.kind, input.vehicleId, JSON.stringify(input.imagesB64), JSON.stringify(input.imageUris), at, at] as never,
    );
  });
  return id;
}

export async function getAiJob(id: string): Promise<AiJob | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>('SELECT * FROM ai_queue WHERE id = ?', [id]);
  return row ? fromRow(row) : null;
}

export async function listAiJobs(statuses: AiJobStatus[]): Promise<AiJob[]> {
  if (!statuses.length) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM ai_queue WHERE status IN (${statuses.map(() => '?').join(',')}) ORDER BY created_at`,
    statuses,
  );
  return rows.map(fromRow);
}

async function setStatus(id: string, status: AiJobStatus, extra: { resultJson?: string | null; errorCode?: string | null; bumpAttempts?: boolean } = {}) {
  await enqueue(async (db) => {
    await db.runAsync(
      `UPDATE ai_queue SET status = ?, result_json = COALESCE(?, result_json), error_code = ?, attempts = attempts + ?, updated_at = ? WHERE id = ?`,
      [status, extra.resultJson ?? null, extra.errorCode ?? null, extra.bumpAttempts ? 1 : 0, now(), id] as never,
    );
  });
}

export const markProcessing = (id: string) => setStatus(id, 'processing');
/** Back to the queue (no connection yet): attempts are NOT consumed by a missing network. */
export const requeue = (id: string) => setStatus(id, 'queued');
export const markReady = (id: string, resultJson: string) => setStatus(id, 'ready', { resultJson });
export const markFailed = (id: string, errorCode: string) => setStatus(id, 'failed', { errorCode, bumpAttempts: true });
/** A provider hiccup that may pass: count the attempt and keep the job queued. */
export const retryLater = (id: string, errorCode: string) => setStatus(id, 'queued', { errorCode, bumpAttempts: true });
/** "Llenarlo a mano": the person went manual, the photos are gone (nothing was sent, nothing is kept). */
export async function dropAiJob(id: string): Promise<void> {
  await enqueue(async (db) => {
    await db.runAsync(`UPDATE ai_queue SET status = 'dropped', images_b64 = '[]', image_uris = '[]', result_json = NULL, updated_at = ? WHERE id = ?`, [now(), id] as never);
  });
}

/** Expires every job older than the TTL that has not been confirmed; returns how many. Their photos are cleared. */
export async function expireOldJobs(nowMs: number = Date.now()): Promise<number> {
  const cutoff = new Date(nowMs - AI_JOB_TTL_DAYS * 86_400_000).toISOString();
  return enqueue(async (db) => {
    const r = await db.runAsync(
      `UPDATE ai_queue SET status = 'expired', images_b64 = '[]', image_uris = '[]', updated_at = ? WHERE status IN ('queued','processing','ready','failed') AND created_at < ?`,
      [now(), cutoff] as never,
    );
    return (r as { changes?: number }).changes ?? 0;
  });
}
