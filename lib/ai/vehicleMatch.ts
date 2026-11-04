/**
 * Scanned text → the catalogs the vehicle form uses (IMP 03112026 SPEC-C §C2, ADR-60). The form's Marca / Modelo / Color
 * are pickers over `lib/domain/refdata` (an id when the catalog knows it, the typed text when it does not), so a matrícula
 * that says "TOYOTA COROLLA GRIS" has to land on the same ids a person would have picked, or the pickers show nothing.
 * Pure: reads the bundled JSON, no network.
 */
import { allMakes, colors, modelsFor, type CarMake, type CarModel } from '../domain/refdata';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function matchMake(text: string | null | undefined): CarMake | null {
  const wanted = fold(text ?? '');
  if (!wanted) return null;
  return allMakes().find((m) => [m.name, ...m.aliases].some((n) => fold(n) === wanted)) ?? null;
}

/**
 * A model of that make: an exact name or alias first; then a catalog name that appears inside the text as whole words
 * ("HILUX SR5" → Hilux), the longest first so "Land Cruiser Prado" beats "Land Cruiser".
 */
export function matchModel(makeId: string, text: string | null | undefined): CarModel | null {
  const wanted = fold(text ?? '');
  if (!wanted) return null;
  const models = modelsFor(makeId);
  const exact = models.find((m) => [m.name, ...m.aliases].some((n) => fold(n) === wanted));
  if (exact) return exact;
  const padded = ` ${wanted} `;
  const contained = models
    .flatMap((m) => [m.name, ...m.aliases].map((n) => ({ m, n: fold(n) })))
    .filter(({ n }) => n.length >= 3 && padded.includes(` ${n} `))
    .sort((a, b) => b.n.length - a.n.length);
  return contained[0]?.m ?? null;
}

export type MakeModelMatch = { makeId: string | null; make: string; modelId: string | null; model: string };

/** The form's MakeModelValue fields for a scanned make/model: catalog ids and names where known, the scanned text otherwise. */
export function matchMakeModel(make: string | null | undefined, model: string | null | undefined): MakeModelMatch {
  const m = matchMake(make);
  const mo = m ? matchModel(m.id, model) : null;
  return { makeId: m?.id ?? null, make: m?.name ?? (make ?? '').trim(), modelId: mo?.id ?? null, model: mo?.name ?? (model ?? '').trim() };
}

/** An exterior colour of the catalog by its Spanish or English name ("BLANCO", "Silver"); null when the catalog has no such colour. */
export function matchColor(text: string | null | undefined): { id: string; es: string; en: string } | null {
  const wanted = fold(text ?? '');
  if (!wanted) return null;
  const hit = colors('exterior').find((c) => c.hex && (fold(c.es) === wanted || fold(c.en) === wanted));
  return hit ? { id: hit.id, es: hit.es, en: hit.en } : null;
}
