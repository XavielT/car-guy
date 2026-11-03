/**
 * A photo → what `cg-ai-read` accepts (IMP 03112026 SPEC-B §B2/§B7, ADR-66): a JPEG no larger than ~1600 px on its long
 * side (1280 px for Fuel Express, to cut tokens), about 0.8 quality, as base64.
 *
 * Privacy: `compressPhoto` re-encodes through the image manipulator, which writes a NEW JPEG without the original's
 * EXIF block, so the GPS position a camera embeds never leaves the phone. The server also discards the image after the
 * read and never logs it.
 *
 * If a photo is still over the server's cap after the first pass, it is re-encoded once at 1280 px / 0.6; if that is
 * not enough it fails with `too_large` and the caller says so (the person can pick another photo).
 */
import { Platform } from 'react-native';

import { MediaError } from '../media/compress';
import { compressPhoto } from '../media/compress';
import { toBase64 } from '../social/base64';
import type { PreparedImage } from './read';

export const AI_IMAGE = { width: 1600, quality: 0.8 };
export const AI_IMAGE_EXPRESS = { width: 1280, quality: 0.8 };
export const AI_IMAGE_SMALL = { width: 1280, quality: 0.6 };
/** The server's per-image cap (supabase/functions/_shared/images.ts MAX_IMAGE_BYTES), decoded. */
export const AI_MAX_BYTES = 1_500_000;

export class TooLargeError extends Error {
  constructor() {
    super('too_large');
    this.name = 'TooLargeError';
  }
}

/** Decoded size of a base64 string without decoding it. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

async function bytesOf(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return toBase64(new Uint8Array(await res.arrayBuffer()));
  }
  const { File } = await import('expo-file-system');
  return new File(uri).base64();
}

/** `uri` is the picked photo (file:// on native, blob: / http on web). `express` uses the smaller long edge. */
export async function prepareForAi(uri: string, opts: { express?: boolean; sourceWidth?: number | null } = {}): Promise<PreparedImage> {
  const first = opts.express ? AI_IMAGE_EXPRESS : AI_IMAGE;
  let out = await compressPhoto(uri, opts.sourceWidth ?? null, first);
  let data = await bytesOf(out.uri);
  if (base64Bytes(data) > AI_MAX_BYTES) {
    out = await compressPhoto(out.uri, out.width, AI_IMAGE_SMALL);
    data = await bytesOf(out.uri);
    if (base64Bytes(data) > AI_MAX_BYTES) throw new TooLargeError();
  }
  return { data, mime: 'image/jpeg' };
}

export { MediaError };
