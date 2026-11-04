/**
 * Voice → text (IMP 03112026 SPEC-B §B3, ADR-67): a short clip recorded by `expo-audio` goes to `cg-stt` as it is, and
 * the transcript comes back. NO client-side conversion (decision D-18): the transcription endpoints behind `cg-stt`
 * read webm (Chrome, Firefox), mp4/m4a (Safari, Android and iOS AAC), ogg, wav and mp3.
 *
 * Privacy: the clip lives in the app's cache until it is sent, then is deleted by `discardClip`; the server discards it
 * after transcribing and never logs it. Recording only happens while the person has the recorder open (foreground).
 * The transcript is shown and editable before anything is done with it.
 */
import { Platform } from 'react-native';

import { toBase64 } from '../social/base64';
import { AiError } from './codes';
import { callAi } from './client';

/** The server's cap (supabase/functions/_shared/stt.ts MAX_AUDIO_BYTES) and the recorder's matching limit. */
export const MAX_AUDIO_BYTES = 2_000_000;
export const MAX_RECORD_MS = 30_000;
/** Shorter than this is a mis-tap, not a sentence. */
export const MIN_RECORD_MS = 600;

export type AudioClip = { audio: string; mime: string };

const BY_EXTENSION: Record<string, string> = {
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};

/** The mime the server accepts for a recording: what the browser says (without ";codecs=…"), else the file extension. Pure. */
export function audioMime(uri: string, blobType?: string | null): string {
  const base = (blobType ?? '').split(';')[0].trim().toLowerCase();
  if (base.startsWith('audio/')) return base;
  if (base === 'video/webm') return 'audio/webm'; // some browsers label an audio-only webm as video
  if (base === 'video/mp4') return 'audio/mp4';
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[ext] ?? 'audio/mp4';
}

/** Decoded size of a base64 string without decoding it. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export class ClipTooLargeError extends Error {
  constructor() {
    super('clip_too_large');
    this.name = 'ClipTooLargeError';
  }
}

/** Reads the recording into what `cg-stt` takes. */
export async function prepareClip(uri: string): Promise<AudioClip> {
  let b64: string;
  let blobType: string | null = null;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    blobType = blob.type;
    b64 = toBase64(new Uint8Array(await blob.arrayBuffer()));
  } else {
    const { File } = await import('expo-file-system');
    b64 = await new File(uri).base64();
  }
  if (base64Bytes(b64) > MAX_AUDIO_BYTES) throw new ClipTooLargeError();
  return { audio: b64, mime: audioMime(uri, blobType) };
}

/** Deletes the recording from the cache (native); a blob URL on the web is released. Never throws. */
export async function discardClip(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    if (Platform.OS === 'web') {
      URL.revokeObjectURL(uri);
      return;
    }
    const { File } = await import('expo-file-system');
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* a leftover cache file is cleared by the system */
  }
}

/** The clip → text. Throws `AiError` (never a provider message). An empty transcript is `unreadable`. */
export async function transcribe(clip: AudioClip): Promise<string> {
  const res = await callAi<{ ok?: boolean; text?: unknown }>('cg-stt', clip);
  const text = typeof res.text === 'string' ? res.text.trim() : '';
  if (!text) throw new AiError('unreadable');
  return text;
}
