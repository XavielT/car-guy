/**
 * A vehicle's photo gallery (01-data-model-v6.md §1.2): an ordered list of
 * media ids plus the cover, which is always one of them. Pure.
 */
export type Gallery = { ids: string[]; cover: string | null };

/** The cover is kept when it is in the list; otherwise the first photo takes it. */
export function normalizeGallery(ids: string[], cover: string | null): Gallery {
  const unique = [...new Set(ids)];
  return { ids: unique, cover: cover && unique.includes(cover) ? cover : (unique[0] ?? null) };
}

export function addPhotos(g: Gallery, added: string[]): Gallery {
  return normalizeGallery([...g.ids, ...added], g.cover);
}

/** Removing the cover promotes the next photo (the one after it, else the one before). */
export function removePhoto(g: Gallery, id: string): Gallery {
  const at = g.ids.indexOf(id);
  if (at < 0) return g;
  const ids = g.ids.filter((x) => x !== id);
  if (g.cover !== id) return normalizeGallery(ids, g.cover);
  return { ids, cover: ids[at] ?? ids[at - 1] ?? null };
}

export function setCover(g: Gallery, id: string): Gallery {
  return g.ids.includes(id) ? { ...g, cover: id } : g;
}

/** One step left (-1) or right (+1); the ends stay put. */
export function movePhoto(g: Gallery, id: string, step: -1 | 1): Gallery {
  const at = g.ids.indexOf(id);
  const to = at + step;
  if (at < 0 || to < 0 || to >= g.ids.length) return g;
  const ids = [...g.ids];
  [ids[at], ids[to]] = [ids[to], ids[at]];
  return { ...g, ids };
}
