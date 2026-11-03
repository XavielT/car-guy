/**
 * cg-stt (IMP 03112026 SPEC-B §B3, SPEC-A §A3): a short voice clip in, the transcript out. Same gateway as every other
 * function (JWT, kill switch, consent, limits, one usage row); what is different is the provider: the speech-to-text
 * secrets `STT_*` (SGC's path is OpenAI or Groq, NOT Azure: PROMPT-00 decision D-02), so "configured" means an STT key
 * exists, not the Anthropic key.
 *
 *   body { audio: base64, mime }   audio/webm (Chrome MediaRecorder), audio/mp4 / m4a (Safari, Android AAC),
 *                                  audio/mpeg, audio/wav, audio/ogg  — all accepted by the OpenAI/Groq transcription
 *                                  endpoints, so NO client-side conversion to WAV is needed (decision D-18).
 *   → { text }  (the transcript is shown and editable before anything else happens: it is never acted on silently)
 *
 * The audio lives only in this request and is discarded after the transcription. Nothing is logged but the usage row
 * (function, model, estimated cost). ≤ 2 MB (~30 s of speech).
 */
import { AiCallError } from '../_shared/anthropic.ts';
import { sttCostUsd } from '../_shared/cost.ts';
import type { EnvGetter } from '../_shared/env.ts';
import type { Handler } from '../_shared/handler.ts';
import { base64Bytes } from '../_shared/images.ts';
import { MAX_AUDIO_BYTES, resolveSttConfig, transcribeAudio } from '../_shared/stt.ts';

export const sttConfigured = (env: EnvGetter) => resolveSttConfig(env) !== null;

/** mime → file extension the provider uses to sniff the container. */
export const AUDIO_MIMES: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

export function mimeBase(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase();
}

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const sttHandler: Handler = async (ctx) => {
  const body = (ctx.body ?? {}) as { audio?: unknown; mime?: unknown };
  const mime = typeof body.mime === 'string' ? mimeBase(body.mime) : '';
  const ext = AUDIO_MIMES[mime];
  const b64 = typeof body.audio === 'string' ? body.audio : '';
  if (!ext || b64.length < 16 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new AiCallError('bad_input');
  const bytes = base64Bytes(b64);
  if (bytes > MAX_AUDIO_BYTES) throw new AiCallError('bad_input');

  const cfg = resolveSttConfig(ctx.env);
  if (!cfg) throw new AiCallError('ai_not_configured');

  const usage = { model: cfg.model, inputTokens: 0, outputTokens: 0, costUsd: sttCostUsd(cfg.provider, bytes) };
  let text: string;
  try {
    text = await transcribeAudio(new Blob([decode(b64) as BlobPart], { type: mime }), ext, cfg, ctx.fetch);
  } catch {
    throw new AiCallError('provider_error');
  }
  if (!text) throw new AiCallError('unreadable', usage);
  return { body: { text: text.slice(0, 600) }, usage };
};
