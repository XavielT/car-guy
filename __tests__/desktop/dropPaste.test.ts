import { MAX_DROP_BYTES, allImages, firstImage, ignoredCount, isReadableImage } from '@/lib/desktop/dropPaste';

const f = (type: string, size = 1000) => ({ type, size });

describe('drop and paste helpers (SPEC-F §F3)', () => {
  it('images are readable; PDFs, text and huge files are not', () => {
    expect(isReadableImage(f('image/jpeg'))).toBe(true);
    expect(isReadableImage(f('image/PNG'))).toBe(true);
    expect(isReadableImage(f('image/webp'))).toBe(true);
    expect(isReadableImage(f('image/heic'))).toBe(true);
    expect(isReadableImage(f('application/pdf'))).toBe(false);
    expect(isReadableImage(f('image/svg+xml'))).toBe(false);
    expect(isReadableImage(f('image/jpeg', MAX_DROP_BYTES + 1))).toBe(false);
    expect(isReadableImage({ type: 'image/jpeg' })).toBe(true);
  });
  it('firstImage skips what it cannot read and handles nothing', () => {
    expect(firstImage([f('application/pdf'), f('image/png'), f('image/jpeg')])).toEqual(f('image/png'));
    expect(firstImage([f('text/plain')])).toBeNull();
    expect(firstImage(null)).toBeNull();
    expect(firstImage([])).toBeNull();
  });
  it('counts what was ignored and keeps all the images for a multi-file drop', () => {
    const drop = [f('image/jpeg'), f('application/pdf'), f('image/png'), f('video/mp4')];
    expect(ignoredCount(drop)).toBe(2);
    expect(allImages(drop)).toHaveLength(2);
    expect(allImages(undefined)).toEqual([]);
  });
});
