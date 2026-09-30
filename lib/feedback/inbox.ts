import type { Tables } from '../cloud/database.types';
import { getSupabase } from '../cloud/supabase';
import { recordError } from '../diagnostics';
import { FEEDBACK_BUCKET } from './send';

/**
 * Comentarios recibidos (ADR-35): the admin's reads and the two writes RLS
 * lets the admin make (status, admin_note — sql/021's column grant). For any
 * other session these return nothing, which is the server's decision, not
 * this file's.
 */
export type FeedbackRow = Tables<{ schema: 'carguy' }, 'feedback'>;
export type FeedbackStatus = 'new' | 'seen' | 'done';
export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = ['new', 'seen', 'done'];

const LIST_COLUMNS = 'id, created_at, kind, status, app_version, build, platform, device, message, email, user_id, screenshot_path';

export type FeedbackListRow = Pick<
  FeedbackRow,
  'id' | 'created_at' | 'kind' | 'status' | 'app_version' | 'build' | 'platform' | 'device' | 'message' | 'email' | 'user_id' | 'screenshot_path'
>;

export async function listFeedback(limit = 200): Promise<FeedbackListRow[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from('feedback').select(LIST_COLUMNS).order('created_at', { ascending: false }).limit(limit);
  if (error) {
    recordError('feedback-inbox', `${error.code ?? ''} ${error.message}`);
    return null;
  }
  return data as FeedbackListRow[];
}

export async function getFeedback(id: string): Promise<FeedbackRow | null | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;
  const { data, error } = await supabase.from('feedback').select('*').eq('id', id).maybeSingle();
  if (error) {
    recordError('feedback-inbox', `${error.code ?? ''} ${error.message}`);
    return undefined;
  }
  return data;
}

export async function updateFeedback(id: string, patch: { status?: FeedbackStatus; admin_note?: string | null }): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('feedback').update(patch).eq('id', id);
  if (error) recordError('feedback-inbox', `${error.code ?? ''} ${error.message}`);
  return !error;
}

/** A one-hour link to the private screenshot (the bucket's select policy is admin-only). */
export async function screenshotUrl(path: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(FEEDBACK_BUCKET).createSignedUrl(path, 3600);
  if (error) {
    recordError('feedback-screenshot-url', error);
    return null;
  }
  return data.signedUrl;
}
