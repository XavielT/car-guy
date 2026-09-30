import { lookup } from './dtc';
import type { HistoryEntry } from '../db/types';
import { FUEL_CATALOG } from '../fuel';
import { EXPENSE_CATEGORY_LABELS } from '../db/types';
import { t } from '../i18n';

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
  if (entry.kind === 'chequeo') return checkStatusTitle(entry.title);
  if (entry.kind === 'viaje') {
    // v5 view: title = distance in meters, subtitle = "<duration_s>|<from>|<to>".
    const km = (Number(entry.title) || 0) / 1000;
    const seconds = Number(entry.subtitle?.split('|')[0]) || 0;
    return t.history.tripTitle(km.toFixed(1), Math.round(seconds / 60));
  }
  // An expense saved without a description is still a Marbete, not a "—".
  if (entry.kind === 'gasto' && !entry.title) return expenseLabel(entry.subtitle) ?? '—';
  return entry.title || '—';
}

/**
 * A check's status as Historial words. 'con_avisos' (only ATENCIÓN answers) is
 * its own line: it is not a failure. Anything unknown reads as a failure — the
 * safer mistake for a check.
 */
export function checkStatusTitle(status: string): string {
  if (status === 'ok') return t.history.checkOk;
  if (status === 'con_avisos') return t.history.checkWithWarnings;
  return t.history.checkWithFails;
}

/** "📷 N" for a row that carries photos (history_feed v5 `photos`), else null. */
export function historyPhotoTag(entry: Pick<HistoryEntry, 'photos'>): string | null {
  const n = Number(entry.photos ?? 0);
  return n > 0 ? t.history.photoTag(n) : null;
}

/**
 * The meta line's second part: an expense's category key becomes its label, and
 * a row with photos ends in "📷 N". A check's own subtitle is its template id —
 * not for reading — so a check shows only its photo count.
 */
export function historySubtitle(entry: HistoryEntry): string | null {
  const photos = historyPhotoTag(entry);
  if (entry.kind === 'chequeo') return photos;
  const base = baseSubtitle(entry);
  return photos ? (base ? `${base} · ${photos}` : photos) : base;
}

function baseSubtitle(entry: HistoryEntry): string | null {
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
    const label = (t.build.statuses as Record<string, string>)[status] ?? status;
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
      return t.stats.categories.combustible;
    case 'mantenimiento':
      return t.stats.categories.mantenimiento;
    case 'reparacion':
      return t.stats.categories.reparacion;
    case 'mejora':
      return t.stats.categories.mejora;
    case 'gasto':
      return t.history.kinds.gasto;
    case 'chequeo':
      return t.history.kinds.chequeo;
    case 'mod':
      return t.history.kinds.mod;
    case 'hito':
    // Events get their own label with their screens (PROMPT-05, FEATURE_EVENTS).
    case 'evento':
      return t.history.kinds.hito;
    case 'pista':
      return t.history.kinds.pista;
    case 'obd':
      return t.history.kinds.obd;
    case 'viaje':
      return t.history.kinds.viaje;
    default:
      return kind;
  }
}
