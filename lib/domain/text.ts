/**
 * Accent- and case-insensitive text matching — the 2.1.1 search fold
 * ("citroen" finds Citroën, "jeepeta" finds JEEPETA). Pure.
 */
export function foldText(text: string | null | undefined): string {
  return (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** True when every word of `query` appears in `text`, folded. An empty query matches. */
export function matchesQuery(text: string, query: string): boolean {
  const words = foldText(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = foldText(text);
  return words.every((w) => haystack.includes(w));
}
