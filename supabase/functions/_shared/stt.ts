/**
 * Speech to text (SPEC-A §A3). Provider chosen by secrets, the SGC `_shared/stt.ts` shape: STT_PROVIDER
 * ('openai' default | 'groq'), STT_API_KEY (fallback OPENAI_API_KEY), STT_MODEL (optional). Azure is NOT an
 * SGC runtime path (PROMPT-00 correction). Returns null when no key exists so the caller answers
 * ai_not_configured and the app hides the microphone. Clips are short (a spoken sentence): the byte cap is the guard.
 */
import type { EnvGetter } from './env.ts';

export const STT_PROVIDERS: Record<string, { url: string; model: string }> = {
  openai: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'gpt-4o-mini-transcribe' },
  groq: { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3-turbo' },
};

export const MAX_AUDIO_BYTES = 2_000_000; // ~30 s of speech at phone bitrates, with headroom

export type SttConfig = { provider: string; url: string; model: string; apiKey: string };

export function resolveSttConfig(get: EnvGetter): SttConfig | null {
  const apiKey = get('STT_API_KEY') || get('OPENAI_API_KEY');
  if (!apiKey) return null;
  const provider = (get('STT_PROVIDER') || 'openai').toLowerCase();
  const p = STT_PROVIDERS[provider] ?? STT_PROVIDERS.openai;
  return { provider: STT_PROVIDERS[provider] ? provider : 'openai', url: p.url, model: get('STT_MODEL') || p.model, apiKey };
}

export async function transcribeAudio(
  audio: Blob,
  ext: string,
  cfg: SttConfig,
  fetchImpl: typeof fetch = fetch,
  language = 'es',
): Promise<string> {
  if (audio.size > MAX_AUDIO_BYTES) throw new Error('audio too large');
  const form = new FormData();
  form.append('file', audio, `audio.${ext.replace(/[^a-z0-9]/gi, '') || 'webm'}`);
  form.append('model', cfg.model);
  form.append('language', language);
  const res = await fetchImpl(cfg.url, { method: 'POST', headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: form, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`STT ${res.status}`); // never the provider's body: it can echo the request
  const json = (await res.json()) as { text?: string };
  return (json.text ?? '').trim();
}
