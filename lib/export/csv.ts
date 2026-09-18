import type { FuelLog, HistoryEntry } from '../db/types';
import { economyById } from '../domain/economy';
import { historyTitle } from '../domain/history';
import type { FillUp } from '../types';
import { FUEL_CATALOG } from '../fuel';

/**
 * CSV export.
 *
 * **Comma-separated and quoted**, not semicolons. A semicolon is what Excel
 * expects in a locale whose decimal separator is a comma, and the temptation is
 * real, but it is not CSV — LibreOffice, Numbers, Google Sheets and every
 * script that will ever read these files expect commas. So: commas, every field
 * that could contain one wrapped in quotes, and numbers written with a dot so
 * they parse as numbers rather than as text.
 *
 * **UTF-8 with a BOM.** Without it Excel on Windows reads the file as the
 * system code page and "Gasoil Óptimo" arrives as "Gasoil Ã“ptimo". The three
 * bytes are ugly and every other reader ignores them.
 *
 * **CRLF line endings**, which RFC 4180 specifies and Excel is happiest with.
 */

export const BOM = '﻿';

/** Wraps a field only when it needs it, and doubles any embedded quote. */
function field(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A number for a spreadsheet: dot decimal, no thousands separator, no currency. */
function num(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '';
  return value.toFixed(decimals);
}

/** `YYYY-MM-DD`, which every spreadsheet recognises as a date. */
function day(iso: string): string {
  return iso.slice(0, 10);
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(field).join(','), ...rows.map((row) => row.map(field).join(','))];
  return BOM + lines.join('\r\n') + '\r\n';
}

export const HISTORY_HEADERS = [
  'fecha',
  'tipo',
  'titulo',
  'detalle',
  'odometro_km',
  'monto_dop',
];

/** The unified timeline, one row per record. */
export function historyCsv(entries: HistoryEntry[]): string {
  return toCsv(
    HISTORY_HEADERS,
    entries.map((entry) => [
      day(entry.occurredAt),
      entry.kind,
      // The readable title, not the raw enum the view stores for a fill-up.
      historyTitle(entry),
      entry.subtitle ?? '',
      entry.odometerKm != null ? num(entry.odometerKm, 0) : '',
      entry.amountDop != null ? num(entry.amountDop) : '',
    ]),
  );
}

export const FUEL_HEADERS = [
  'fecha',
  'odometro_km',
  'combustible',
  'volumen',
  'unidad',
  'precio_por_unidad_dop',
  'total_dop',
  'tanque_lleno',
  'falto_carga_anterior',
  'estacion',
  'nota',
  'km_recorridos',
  'km_por_unidad',
  'costo_por_km_dop',
];

/**
 * Every fuel column, plus the three derived figures the app computes.
 *
 * The economy columns are blank on the rows that have none — a partial tank, a
 * baseline tank, or one flagged `falto_carga_anterior` — rather than carrying
 * the previous row's number down. A blank cell is a fact; a repeated one is a
 * lie a spreadsheet will happily average.
 */
export function fuelCsv(logs: FuelLog[]): string {
  // computeEconomy works on the app-facing FillUp shape and keys its output by
  // fill-up id, so the join below is by id and never by position.
  const asFillUps: FillUp[] = logs.map((log) => ({
    id: log.id,
    vehicleId: log.vehicleId,
    occurredAt: log.occurredAt,
    odometerKm: log.odometerKm,
    volume: log.volume,
    pricePerUnit: log.pricePerUnit,
    totalDop: log.totalDop,
    fuelType: log.fuelType,
    isFullTank: log.isFullTank,
    missedPrevious: log.missedPrevious,
    station: log.station,
    notes: log.notes,
    createdAt: log.createdAt,
  }));
  const economy = economyById(asFillUps);

  const sorted = [...logs].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return toCsv(
    FUEL_HEADERS,
    sorted.map((log) => {
      const point = economy.get(log.id);
      return [
        day(log.occurredAt),
        num(log.odometerKm, 0),
        FUEL_CATALOG[log.fuelType].label,
        num(log.volume, 3),
        FUEL_CATALOG[log.fuelType].unitLabel,
        num(log.pricePerUnit),
        num(log.totalDop),
        log.isFullTank ? 'si' : 'no',
        log.missedPrevious ? 'si' : 'no',
        log.station,
        log.notes,
        point ? num(point.distanceKm, 0) : '',
        point ? num(point.kmPerUnit, 3) : '',
        point?.costPerKm != null ? num(point.costPerKm) : '',
      ];
    }),
  );
}

/** A filename a person can find again: `car-guy-historial-corolla-2026-09-18.csv`. */
export function exportFileName(kind: string, vehicleName: string, today: string): string {
  const slug = vehicleName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `car-guy-${kind}${slug ? `-${slug}` : ''}-${day(today)}.csv`;
}
