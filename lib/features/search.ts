import { foldText } from '../domain/text';
import { activeFeatures, type FeatureDef } from './registry';
import { synonymsOf } from './synonyms';

/**
 * The function search (IMP 16102026 SPEC-C §6): title, description and keywords in **both** languages, without
 * accents, tolerant of a slip ("diagnostco") and of the way people say things ("luz del tablero" finds OBD). Pure.
 */
export type FeatureCopy = { title: string; desc: string };

/** Edit distance up to `max`, early exit. */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
}

/** Words that say nothing about WHAT is wanted, es + en. */
const STOP = new Set(['un', 'una', 'el', 'la', 'los', 'las', 'de', 'del', 'mi', 'mis', 'me', 'se', 'lo', 'le', 'que', 'en', 'este', 'esta', 'por', 'para', 'con', 'ver', 'a', 'i', 'my', 'the', 'an', 'to', 'of', 'did', 'how', 'much', 'quiero', 'hacer', 'fui', 'necesito', 'puedo', 'empezar', 'comenzar', 'agregar', 'anadir', 'subir', 'guardar', 'poner', 'puse', 'lleve', 'llevar', 'registrar', 'anotar', 'crear', 'abrir', 'mostrar', 'buscar', 'saber', 'cuanto', 'cuantos', 'cuantas', 'he', 'tiene', 'tengo', 'alguien', 'algo', 'venza', 'mes', 'semana', 'hoy', 'ano', 'dia', 'log', 'add', 'start', 'open', 'see', 'show', 'i', 'did']);

const words = (s: string) => foldText(s).split(/[^a-z0-9]+/).filter(Boolean);

function score(def: FeatureDef, copy: FeatureCopy, query: string): number {
  const q = foldText(query).trim();
  const tokens = words(query);
  if (!tokens.length) return 1;
  const title = foldText(copy.title);
  const desc = foldText(copy.desc);
  const keywords = [...def.keywords.es, ...def.keywords.en].map(foldText);
  const vocabulary = new Set([...words(copy.title), ...words(copy.desc), ...keywords.flatMap(words)]);

  let total = 0;
  if (keywords.some((k) => k === q)) total += 6;
  else if (keywords.some((k) => k.includes(q))) total += 3;
  // Filler that carries no meaning ("cuanto gaste ESTE mes", "registrar UN servicio"): never required to match.
  const meaningful = tokens.filter((tk) => !STOP.has(tk));
  let missed = 0;
  let strong = 0;
  for (const token of meaningful.length ? meaningful : tokens) {
    let best = 0;
    if (title.includes(token)) best = 4;
    else if (keywords.some((k) => k.includes(token))) best = 3;
    else if (desc.includes(token)) best = 1;
    else if (token.length >= 4) {
      for (const w of vocabulary) if (w.length >= 4 && within(token, w, token.length >= 7 ? 2 : 1)) { best = 1; break; }
    }
    // The words people use (SPEC-K §K4): the same meaning in other words, a notch below the exact word.
    if (!best) {
      for (const syn of synonymsOf(token)) {
        if (syn === token) continue;
        if (title.includes(syn)) best = Math.max(best, 3);
        else if (keywords.some((k) => k.split(/[^a-z0-9]+/).includes(syn))) best = Math.max(best, 2);
      }
    }
    // A phrase is not a keyword list ("cuantos kilometros tiene"): one strong word is enough, up to two words may mean nothing here.
    if (!best) {
      missed++;
      continue;
    }
    strong++;
    total += best;
  }
  if (!strong || missed > 2 || (missed > 0 && meaningful.length < 2)) return 0;
  return total;
}

/** The functions that answer `query`, best first; an empty query returns all of them in registry order. */
export function searchFeatures(query: string, copyOf: (def: FeatureDef) => FeatureCopy, pool: FeatureDef[] = activeFeatures()): FeatureDef[] {
  if (!foldText(query).trim()) return pool;
  return pool
    .map((def, order) => ({ def, order, s: score(def, copyOf(def), query) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.order - b.order)
    .map((r) => r.def);
}
