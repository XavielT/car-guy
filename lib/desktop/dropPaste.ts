/**
 * Drag-and-drop and paste of photos onto the capture components (IMP 03112026 SPEC-F §F3). Pure helpers: which file of a drop or a paste
 * is the one to read. An image only: the AI reads images (a PDF cannot be rendered to one yet, PROGRESS D-30), so a dropped PDF is
 * ignored here and a screen that takes PDFs handles it itself.
 */
export type FileLike = { type: string; name?: string; size?: number };

export const MAX_DROP_BYTES = 25_000_000;

export const isReadableImage = (f: FileLike): boolean => /^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type) && (f.size == null || f.size <= MAX_DROP_BYTES);

/** The first readable image among the files of a drop or a clipboard, or null. */
export function firstImage<T extends FileLike>(files: ArrayLike<T> | null | undefined): T | null {
  for (let i = 0; i < (files?.length ?? 0); i++) {
    const f = files![i]!;
    if (isReadableImage(f)) return f;
  }
  return null;
}

/** How many files of a drop are not images we can use (the screen says "only photos"). */
export function ignoredCount(files: ArrayLike<FileLike> | null | undefined): number {
  let n = 0;
  for (let i = 0; i < (files?.length ?? 0); i++) if (!isReadableImage(files![i]!)) n++;
  return n;
}

/** All readable images, in order, for the multi-file drop on the album importer. */
export function allImages<T extends FileLike>(files: ArrayLike<T> | null | undefined): T[] {
  const out: T[] = [];
  for (let i = 0; i < (files?.length ?? 0); i++) if (isReadableImage(files![i]!)) out.push(files![i]!);
  return out;
}
