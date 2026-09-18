import type { HistoryEntry } from '../db/types';
import { FUEL_CATALOG } from '../fuel';
import { es } from '../i18n/es';

/**
 * Turning a `history_feed` row into words.
 *
 * The view packs a different meaning into `title` for each arm of its UNION —
 * the fuel type for a fill-up, the inspection status for a check, the real
 * title for everything else — because the eight-column contract has nowhere
 * else to put them. Three consumers now read those rows (the Historial screen,
 * the CSV export and the PDF report), so the translation lives here instead of
 * being reinvented, slightly differently, in each of them.
 */
export function historyTitle(entry: HistoryEntry): string {
  if (entry.kind === 'combustible') {
    return FUEL_CATALOG[entry.title as keyof typeof FUEL_CATALOG]?.label ?? entry.title;
  }
  if (entry.kind === 'chequeo') {
    return entry.title === 'ok' ? 'Chequeo · todo bien' : 'Chequeo · con fallas';
  }
  return entry.title || '—';
}

/** The Spanish name of a feed row's kind. */
export function historyKindLabel(kind: HistoryEntry['kind']): string {
  switch (kind) {
    case 'combustible':
      return es.stats.categories.combustible;
    case 'mantenimiento':
      return es.stats.categories.mantenimiento;
    case 'reparacion':
      return es.stats.categories.reparacion;
    case 'mejora':
      return es.stats.categories.mejora;
    case 'gasto':
      return es.history.kinds.gasto;
    case 'chequeo':
      return es.history.kinds.chequeo;
    default:
      return kind;
  }
}
