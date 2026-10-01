/**
 * The centred-square crop for profile photos (IMP 30092026 note 10). The
 * picker's `aspect: [1, 1]` is a request, not a promise — web and several
 * Android galleries return the photo as it was — so every profile photo is
 * squared here before `compressPhoto` brings it down to 512 px.
 *
 * Same lifetime rules as compress.ts (expo/expo#50217): the context and the
 * rendered image stay referenced until `saveAsync` resolves and are released in
 * `finally`, never mid-render.
 */
import * as ImageManipulator from 'expo-image-manipulator';

import { centerSquareCrop, isFullFrame } from '../avatars';
import type { Compressed } from './compress';

function releaseQuietly(object: unknown): void {
  const release = (object as { release?: () => void } | null)?.release;
  if (typeof release !== 'function') return;
  try {
    release.call(object);
  } catch {
    // Already released.
  }
}

/** Width and height of an image the picker did not describe. */
async function measure(uri: string): Promise<{ width: number; height: number }> {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | null = null;
  try {
    rendered = await context.renderAsync();
    return { width: rendered.width, height: rendered.height };
  } finally {
    releaseQuietly(rendered);
    releaseQuietly(context);
  }
}

/**
 * The photo cropped to its centred square, as a new JPEG (quality 1 — the
 * compression step that follows is the lossy one). Already square: the photo
 * is handed back untouched.
 */
export async function cropToSquare(uri: string, width: number | null, height: number | null): Promise<Compressed> {
  const size = width && height ? { width, height } : await measure(uri);
  const crop = centerSquareCrop(size.width, size.height);
  if (!crop || isFullFrame(crop, size.width, size.height)) return { uri, width: size.width, height: size.height };

  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | null = null;
  try {
    context.crop(crop);
    rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ compress: 1, format: ImageManipulator.SaveFormat.JPEG });
    return { uri: result.uri, width: result.width ?? crop.width, height: result.height ?? crop.height };
  } finally {
    releaseQuietly(rendered);
    releaseQuietly(context);
  }
}
