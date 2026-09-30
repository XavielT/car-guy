/**
 * What "Lo que se envía" must never carry (PROMPT-06 item 4): tokens, emails,
 * plates. Applied to every field the app fills in by itself — the diagnostics,
 * the route, the sync message — never to what the user typed on purpose (the
 * message and the optional email are theirs to send).
 *
 * Two layers: the exact values this device knows are sensitive (its plates and
 * VINs, the session's email), and patterns for anything else of those shapes
 * that ended up inside an error message.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** A JWT (Supabase access tokens, the anon key). */
const JWT = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
/** Supabase's newer keys, and `Bearer …` / `apikey=…` / `token: …` pairs. */
const SB_KEY = /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+/g;
const LABELLED = /\b(bearer|apikey|api_key|access_token|refresh_token|token|password|secret)(["'\s:=]+)[^\s"',;&]+/gi;
/**
 * Long opaque strings with a digit and no dashes (keys, hashes). A uuid has
 * dashes and stays; a long identifier in a stack ("ExpoSQLiteNativeModule…")
 * has no digit and stays.
 */
const OPAQUE = /\b(?=[A-Za-z_]*\d)[A-Za-z0-9_]{32,}\b/g;
/** A VIN: 17 characters with a digit, no I/O/Q. */
const VIN = /\b(?=[A-HJ-NPR-Z]*\d)[A-HJ-NPR-Z0-9]{17}\b/gi;
/** Dominican plates: one or two letters then 5–6 digits (A700001, G123456, EX12345). */
const PLATE = /\b[A-Z]{1,2}[- ]?\d{5,6}\b/gi;

export const REDACTED = '[…]';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Redacts one string. `known` are exact values to remove (case-insensitive). */
export function redactText(text: string, known: readonly string[] = []): string {
  let out = text;
  for (const value of known) {
    const v = value?.trim();
    // Very short values ("A1") would eat ordinary words.
    if (!v || v.length < 4) continue;
    out = out.replace(new RegExp(escapeRegExp(v), 'gi'), REDACTED);
  }
  return out
    .replace(JWT, REDACTED)
    .replace(SB_KEY, REDACTED)
    .replace(LABELLED, (_m, label: string, sep: string) => `${label}${sep}${REDACTED}`)
    .replace(EMAIL, REDACTED)
    .replace(OPAQUE, REDACTED)
    .replace(VIN, REDACTED)
    .replace(PLATE, REDACTED);
}

/** Deep copy of a JSON-ish value with every string (keys included) redacted. */
export function redactDeep<T>(value: T, known: readonly string[] = []): T {
  if (typeof value === 'string') return redactText(value, known) as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, known)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[redactText(k, known)] = redactDeep(v, known);
    return out as T;
  }
  return value;
}
