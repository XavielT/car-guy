import { lookup } from './dtc';
import type { HistoryEntry } from '../db/types';
import { FUEL_CATALOG } from '../fuel';
import { EXPENSE_CATEGORY_LABELS } from '../db/types';
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
    return entry.title === 'ok' ? es.history.checkOk : es.history.checkWithFails;
  }
  if (entry.kind === 'viaje') {
    // v5 view: title = distance in meters, subtitle = "<duration_s>|<from>|<to>".
    const km = (Number(entry.title) || 0) / 1000;
    const seconds = Number(entry.subtitle?.split('|')[0]) || 0;
    return es.history.tripTitle(km.toFixed(1), Math.round(seconds / 60));
  }
  // An expense saved without a description is still a Marbete, not a "—".
  if (entry.kind === 'gasto' && !entry.title) return expenseLabel(entry.subtitle) ?? '—';
  return entry.title || '—';
}

/** The meta line's second part: an expense's category key becomes its label. */
export function historySubtitle(entry: HistoryEntry): string | null {
  if (entry.kind === 'gasto') return expenseLabel(entry.subtitle) ?? entry.subtitle;
  if (entry.kind === 'obd') {
    const d = lookup(entry.title);
    const state = entry.subtitle === 'resuelto' ? 'Resuelto' : 'Abierto';
    return [state, d?.descEs].filter(Boolean).join(' · ');
  }
  if (entry.kind === 'viaje') {
    const [, from, to] = (entry.subtitle ?? '').split('|');
    return from || to ? `${from || '—'} → ${to || '—'}` : null;
  }
  if (entry.kind === 'mod' && entry.subtitle?.includes('|')) {
    // "<status>|<brand>" (history_feed v3): "Instalado · BC Racing".
    const [status, brand] = entry.subtitle.split('|');
    const label = (es.build.statuses as Record<string, string>)[status] ?? status;
    return brand ? `${label} · ${brand}` : label;
  }
  return entry.subtitle;
}

function expenseLabel(key: string | null): string | null {
  return key ? ((EXPENSE_CATEGORY_LABELS as Record<string, string>)[key] ?? null) : null;
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
    case 'mod':
      return es.history.kinds.mod;
    case 'hito':
      return es.history.kinds.hito;
    case 'pista':
      return es.history.kinds.pista;
    case 'obd':
      return es.history.kinds.obd;
    case 'viaje':
      return es.history.kinds.viaje;
    default:
      return kind;
  }
}
