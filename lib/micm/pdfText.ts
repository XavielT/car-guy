/**
 * pdf.js text items → lines, so api/precios.ts can hand lib/micm/parse.ts the
 * same shape `pdftotext -layout` gives (one table row per line). Pure.
 *
 * Items whose baselines are within 2 pt are one line; lines run top to bottom
 * (pdf y grows upwards), items left to right, joined by two spaces — the parser
 * only needs the fuel name first and the numbers after it.
 */
export type PdfTextItem = { str: string; transform: number[] };

export function itemsToLines(items: readonly (PdfTextItem | { type?: string })[]): string {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!('str' in it) || !it.str.trim() || !Array.isArray(it.transform)) continue;
    const x = it.transform[4] ?? 0;
    const y = it.transform[5] ?? 0;
    let row = rows.find((r) => Math.abs(r.y - y) <= 2);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, s: it.str.trim() });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join('  '),
    )
    .join('\n');
}
