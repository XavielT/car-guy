import { Platform } from 'react-native';

import type { Json } from '../cloud/database.types';
import { getSupabase } from '../cloud/supabase';
import { recordError } from '../diagnostics';
import type { DeliverResult, OutboxItem } from './outbox';
import type { FeedbackPayload } from './payload';

/**
 * The wire: carguy.submit_feedback, then (optionally) the screenshot into the
 * private bucket carguy-feedback as <device_id>/<id>.jpg, then
 * attach_feedback_screenshot so the row learns its path (sql/021).
 *
 * The upload happens only after the row exists — the bucket's insert policy
 * refuses any other name — and its failure never costs the comment: the row
 * stays, without a screenshot.
 */
export const FEEDBACK_BUCKET = 'carguy-feedback';
/** The bucket's own limit (021_feedback_storage.shared.sql). */
export const SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;

export type SubmitOutcome = 'sent' | 'rate_limited' | 'network' | 'rejected' | 'unavailable';

export function screenshotPath(deviceId: string, id: string): string {
  return `${deviceId}/${id}.jpg`;
}

/**
 * How to read a PostgREST answer. Only a data error from Postgres itself
 * (class 22 / 23: a bad kind, a message too short) is final; a missing
 * function (PGRST202, sql/021 not applied yet), an expired token or no network
 * is worth another try on the next launch.
 */
export function classifyError(error: { code?: string | null; message?: string | null }): Exclude<SubmitOutcome, 'sent' | 'unavailable'> {
  if (/rate_limited/.test(error.message ?? '')) return 'rate_limited';
  if (error.code && /^2[23]/.test(error.code)) return 'rejected';
  return 'network';
}

export async function submitPayload(payload: FeedbackPayload): Promise<SubmitOutcome> {
  const supabase = getSupabase();
  if (!supabase) return 'unavailable';
  try {
    const { error } = await supabase.rpc('submit_feedback', { p: payload as unknown as Json });
    if (!error) return 'sent';
    const outcome = classifyError(error);
    if (outcome !== 'rate_limited') recordError('feedback-submit', `${error.code ?? ''} ${error.message}`);
    return outcome;
  } catch (error) {
    recordError('feedback-submit', error);
    return 'network';
  }
}

async function readBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web' || /^(blob|data|https?):/.test(uri)) {
    const response = await fetch(uri);
    return new Uint8Array(await response.arrayBuffer());
  }
  const { File } = await import('expo-file-system');
  return new Uint8Array(await new File(uri).bytes());
}

/** Best effort: true when the screenshot is stored and linked to the row. */
export async function uploadScreenshot(payload: FeedbackPayload, uri: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const bytes = await readBytes(uri);
    if (!bytes.byteLength || bytes.byteLength > SCREENSHOT_MAX_BYTES) return false;
    // An ArrayBuffer, not a Blob — React Native cannot build a Blob from bytes (lib/sync/mediaBytes.ts).
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const { error } = await supabase.storage
      .from(FEEDBACK_BUCKET)
      .upload(screenshotPath(payload.device_id, payload.id), copy.buffer, { contentType: 'image/jpeg', upsert: false });
    // A retry after an upload whose answer was lost: the object is already there.
    if (error && !/exists|duplicate/i.test(error.message)) {
      recordError('feedback-screenshot', error);
      return false;
    }
    const { data, error: attachError } = await supabase.rpc('attach_feedback_screenshot', {
      p_id: payload.id,
      p_device_id: payload.device_id,
    });
    if (attachError) recordError('feedback-attach', `${attachError.code ?? ''} ${attachError.message}`);
    return data === true;
  } catch (error) {
    recordError('feedback-screenshot', error);
    return false;
  }
}

export type DeliverOutcome = { outcome: SubmitOutcome; screenshot: 'none' | 'ok' | 'failed' };

export async function deliverNow(payload: FeedbackPayload, screenshotUri: string | null): Promise<DeliverOutcome> {
  const outcome = await submitPayload(payload);
  if (outcome !== 'sent' || !screenshotUri) return { outcome, screenshot: 'none' };
  return { outcome, screenshot: (await uploadScreenshot(payload, screenshotUri)) ? 'ok' : 'failed' };
}

/** The outbox's sender: only a refusal from Postgres drops an item. */
export async function deliverQueued(item: OutboxItem): Promise<DeliverResult> {
  const { outcome } = await deliverNow(item.payload, item.screenshotUri);
  if (outcome === 'sent') return { ok: true };
  return { ok: false, retry: outcome !== 'rejected' };
}
