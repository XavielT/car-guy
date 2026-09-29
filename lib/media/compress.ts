/**
 * Resize + JPEG through expo-image-manipulator, written around expo/expo#50217
 * (IMP 29092026 Phase 1, note 12).
 *
 * On Android, releasing an `ImageManipulatorContext` cancels its render job even
 * while `renderAsync()` is still waiting on it — and a release includes Hermes
 * collecting the JS object. A 12 MP photo renders for a few hundred ms while the
 * new-vehicle form mounts and allocates, which is exactly when a GC lands. The
 * promise then rejects with "Call to function 'Context.renderAsync' has been
 * rejected … JobCancellationException". Unfixed in every SDK 57 release
 * (57.0.20 still cancels in `sharedObjectDidRelease`).
 *
 * So: the context and the rendered image stay referenced from this frame until
 * `saveAsync` resolves, nothing unrelated is awaited in between, both are
 * released in `finally` (after the work, never during), a cancelled render is
 * retried once, and two compressions of the same uri share one promise.
 */
import * as ImageManipulator from 'expo-image-manipulator';

export type CompressTarget = { width: number; quality: number };
export type Compressed = { uri: string; width: number | null; height: number | null };

export class MediaError extends Error {
  constructor(
    public readonly code: 'render_cancelled',
    public readonly cause?: unknown,
  ) {
    super(code);
    this.name = 'MediaError';
  }
}

const RETRY_DELAY_MS = 50;

export function isRenderCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /JobCancellationException|has been rejected/.test(message);
}

function releaseQuietly(object: unknown): void {
  const release = (object as { release?: () => void } | null)?.release;
  if (typeof release !== 'function') return;
  try {
    release.call(object);
  } catch {
    // Already released: nothing left to free.
  }
}

async function renderOnce(uri: string, sourceWidth: number | null, target: CompressTarget): Promise<Compressed> {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | null = null;
  try {
    // Unknown width: resize anyway — a 12 MP photo must never be stored as is.
    if (sourceWidth == null || sourceWidth > target.width) context.resize({ width: target.width });
    rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ compress: target.quality, format: ImageManipulator.SaveFormat.JPEG });
    return { uri: result.uri, width: result.width ?? null, height: result.height ?? null };
  } finally {
    // Only now, with both awaits behind us. Until here `context` and `rendered`
    // were live locals of this frame, so neither could be collected mid-render.
    releaseQuietly(rendered);
    releaseQuietly(context);
  }
}

async function compressWithRetry(uri: string, sourceWidth: number | null, target: CompressTarget): Promise<Compressed> {
  try {
    return await renderOnce(uri, sourceWidth, target);
  } catch (error) {
    if (!isRenderCancelled(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      return await renderOnce(uri, sourceWidth, target);
    } catch (again) {
      if (isRenderCancelled(again)) throw new MediaError('render_cancelled', again);
      throw again;
    }
  }
}

const inFlight = new Map<string, Promise<Compressed>>();

export function compressPhoto(uri: string, sourceWidth: number | null, target: CompressTarget): Promise<Compressed> {
  const key = `${uri}|${target.width}|${target.quality}`;
  const running = inFlight.get(key);
  if (running) return running;
  const promise = compressWithRetry(uri, sourceWidth, target).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
