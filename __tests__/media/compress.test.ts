/**
 * compressPhoto against a fake expo-image-manipulator (expo/expo#50217 workaround).
 */
const mockCalls: string[] = [];
let mockFailures: string[] = [];

jest.mock('expo-image-manipulator', () => {
  class FakeImage {
    constructor(private readonly n: number) {}
    async saveAsync() {
      mockCalls.push(`save${this.n}`);
      return { uri: `file:///out-${this.n}.jpg`, width: 1600, height: 1200 };
    }
    release() {
      mockCalls.push(`releaseImage${this.n}`);
    }
  }
  let n = 0;
  return {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: {
      manipulate: (uri: string) => {
        const id = ++n;
        mockCalls.push(`manipulate${id}:${uri}`);
        return {
          resize: () => mockCalls.push(`resize${id}`),
          renderAsync: async () => {
            await new Promise((r) => setTimeout(r, 5));
            const failure = mockFailures.shift();
            if (failure) throw new Error(failure);
            mockCalls.push(`render${id}`);
            return new FakeImage(id);
          },
          release: () => mockCalls.push(`releaseContext${id}`),
        };
      },
    },
  };
});

import { compressPhoto, isRenderCancelled, MediaError } from '@/lib/media/compress';

const CANCELLED =
  "Call to function 'Context.renderAsync' has been rejected.\n→ Caused by: kotlinx.coroutines.JobCancellationException: DeferredCoroutine was cancelled";
const FULL = { width: 1600, quality: 0.75 };

beforeEach(() => {
  mockCalls.length = 0;
  mockFailures = [];
});

it('recognises the upstream message', () => {
  expect(isRenderCancelled(new Error(CANCELLED))).toBe(true);
  expect(isRenderCancelled(new Error('ENOSPC'))).toBe(false);
});

it('releases the context and the image only after the save', async () => {
  const out = await compressPhoto('file:///a.jpg', 4000, FULL);
  expect(out).toEqual({ uri: 'file:///out-1.jpg', width: 1600, height: 1200 });
  const order = mockCalls.filter((c) => /^(render|save|release)/.test(c));
  expect(order).toEqual(['render1', 'save1', 'releaseImage1', 'releaseContext1']);
});

it('does not resize a photo already under the target', async () => {
  await compressPhoto('file:///small.jpg', 800, FULL);
  expect(mockCalls.some((c) => c.startsWith('resize'))).toBe(false);
});

it('retries a cancelled render once and succeeds', async () => {
  mockFailures = [CANCELLED];
  const out = await compressPhoto('file:///b.jpg', 4000, FULL);
  expect(out.uri).toMatch(/out-\d+\.jpg/);
  expect(mockCalls.filter((c) => c.startsWith('manipulate'))).toHaveLength(2);
  // The failed attempt's context is still released.
  expect(mockCalls.filter((c) => c.startsWith('releaseContext'))).toHaveLength(2);
});

it('gives up after the retry with a typed MediaError', async () => {
  mockFailures = [CANCELLED, CANCELLED];
  await expect(compressPhoto('file:///c.jpg', 4000, FULL)).rejects.toBeInstanceOf(MediaError);
});

it('does not retry other errors', async () => {
  mockFailures = ['out of memory'];
  await expect(compressPhoto('file:///d.jpg', 4000, FULL)).rejects.toThrow('out of memory');
  expect(mockCalls.filter((c) => c.startsWith('manipulate'))).toHaveLength(1);
});

it('shares one promise between two compressions of the same uri', async () => {
  const [a, b] = await Promise.all([compressPhoto('file:///e.jpg', 4000, FULL), compressPhoto('file:///e.jpg', 4000, FULL)]);
  expect(a).toBe(b);
  expect(mockCalls.filter((c) => c.startsWith('manipulate'))).toHaveLength(1);
  // …and a later call starts fresh.
  await compressPhoto('file:///e.jpg', 4000, FULL);
  expect(mockCalls.filter((c) => c.startsWith('manipulate'))).toHaveLength(2);
});
