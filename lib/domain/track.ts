/**
 * Track days, drift, drag, juntes (IMP 28092026, 01-data-model-v2.md §2.4,
 * ADR-21). Pure and tested.
 *
 * Times are integer ms end to end; the screen types "1:23.456" and reads it back
 * the same way. Copy-forward copies the **setup sheet** only — never timing,
 * runs or incidents, which belong to the session they happened in.
 */
import type { ConsumableUsage, SetupSheet, TrackDiscipline, TrackEvent, TrackSession } from '../db/types';

// ----------------------------------------------------------------- times ---

/** "1:23.456" / "83.456" / "1:23" / "0:59.9" → ms; null for anything else. */
export function parseLap(raw: string | null | undefined): number | null {
  const s = (raw ?? '').trim().replace(',', '.');
  if (!s) return null;
  const m = s.match(/^(?:(\d{1,2}):)?(\d{1,3})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const min = m[1] ? Number(m[1]) : 0;
  const sec = Number(m[2]);
  if (m[1] && sec >= 60) return null;
  const frac = m[3] ? Number(m[3].padEnd(3, '0')) : 0;
  return (min * 60 + sec) * 1000 + frac;
}

/** ms → "1:23.456" (a sub-minute time keeps the "0:" so every lap reads alike). */
export function formatLap(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.round(ms);
  const min = Math.floor(total / 60000);
  const sec = Math.floor((total % 60000) / 1000);
  const frac = total % 1000;
  return `${min}:${String(sec).padStart(2, '0')}.${String(frac).padStart(3, '0')}`;
}

/** 0–100 and ¼ mile read as seconds: 8456 → "8.456 s". */
export function formatSeconds(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  return `${(ms / 1000).toFixed(3)} s`;
}

// ----------------------------------------------------------- setup sheet ---

type SheetKey = Exclude<keyof SetupSheet, 'id' | 'sessionId' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncedAt' | 'changedFromPrevious'>;

/** The sheet's fields with their Spanish labels, for the form and the "Cambiaste…" note. */
export const SHEET_FIELDS: { key: SheetKey; label: string; group: 'gomas' | 'presion' | 'alineacion' | 'altura' | 'suspension' | 'frenos' | 'drift' | 'drag' }[] = [
  { key: 'tireSetFId', label: 'Set delante', group: 'gomas' },
  { key: 'tireSetRId', label: 'Set detrás', group: 'gomas' },
  { key: 'tireSizeF', label: 'Gomas delante', group: 'gomas' },
  { key: 'tireSizeR', label: 'Gomas detrás', group: 'gomas' },
  { key: 'compoundF', label: 'Compuesto delante', group: 'gomas' },
  { key: 'compoundR', label: 'Compuesto detrás', group: 'gomas' },
  { key: 'psiColdFl', label: 'DI frío', group: 'presion' },
  { key: 'psiColdFr', label: 'DD frío', group: 'presion' },
  { key: 'psiColdRl', label: 'TI frío', group: 'presion' },
  { key: 'psiColdRr', label: 'TD frío', group: 'presion' },
  { key: 'psiHotFl', label: 'DI caliente', group: 'presion' },
  { key: 'psiHotFr', label: 'DD caliente', group: 'presion' },
  { key: 'psiHotRl', label: 'TI caliente', group: 'presion' },
  { key: 'psiHotRr', label: 'TD caliente', group: 'presion' },
  { key: 'camberFl', label: 'Camber DI', group: 'alineacion' },
  { key: 'camberFr', label: 'Camber DD', group: 'alineacion' },
  { key: 'camberRl', label: 'Camber TI', group: 'alineacion' },
  { key: 'camberRr', label: 'Camber TD', group: 'alineacion' },
  { key: 'toeFMm', label: 'Toe delante (mm)', group: 'alineacion' },
  { key: 'toeRMm', label: 'Toe detrás (mm)', group: 'alineacion' },
  { key: 'casterL', label: 'Caster izq.', group: 'alineacion' },
  { key: 'casterR', label: 'Caster der.', group: 'alineacion' },
  { key: 'rhFlMm', label: 'Altura DI', group: 'altura' },
  { key: 'rhFrMm', label: 'Altura DD', group: 'altura' },
  { key: 'rhRlMm', label: 'Altura TI', group: 'altura' },
  { key: 'rhRrMm', label: 'Altura TD', group: 'altura' },
  { key: 'springF', label: 'Resorte delante', group: 'suspension' },
  { key: 'springR', label: 'Resorte detrás', group: 'suspension' },
  { key: 'springUnit', label: 'Unidad de resorte', group: 'suspension' },
  { key: 'bumpF', label: 'Compresión delante', group: 'suspension' },
  { key: 'reboundF', label: 'Extensión delante', group: 'suspension' },
  { key: 'bumpR', label: 'Compresión detrás', group: 'suspension' },
  { key: 'reboundR', label: 'Extensión detrás', group: 'suspension' },
  { key: 'clicksTotal', label: 'Clicks totales', group: 'suspension' },
  { key: 'swaybarF', label: 'Barra delante', group: 'suspension' },
  { key: 'swaybarR', label: 'Barra detrás', group: 'suspension' },
  { key: 'padF', label: 'Pastillas delante', group: 'frenos' },
  { key: 'padR', label: 'Pastillas detrás', group: 'frenos' },
  { key: 'brakeBias', label: 'Balance de frenos', group: 'frenos' },
  { key: 'steeringAngleDeg', label: 'Ángulo', group: 'drift' },
  { key: 'hydro', label: 'Freno de mano hidráulico', group: 'drift' },
  { key: 'lsdType', label: 'LSD', group: 'drift' },
  { key: 'lsdPreload', label: 'Precarga LSD', group: 'drift' },
  { key: 'twoStepRpm', label: 'Two-step (rpm)', group: 'drag' },
  { key: 'revLimitRpm', label: 'Corte (rpm)', group: 'drag' },
];

export type SheetValues = Partial<Pick<SetupSheet, SheetKey>>;

/** The next session's sheet: every setup value carried over, nothing marked as changed. */
export function copyForward(prev: Partial<SetupSheet> | null): SheetValues & { changedFromPrevious: string } {
  const out: SheetValues = {};
  if (prev) for (const f of SHEET_FIELDS) if (prev[f.key] !== undefined) (out as Record<string, unknown>)[f.key] = prev[f.key];
  return { ...out, changedFromPrevious: '[]' };
}

export type SheetChange = { key: SheetKey; label: string; from: unknown; to: unknown };

const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null) || (a === false && b == null) || (a == null && b === false);

/** What changed from `prev` to `next`, in field order. */
export function diffSheets(prev: Partial<SetupSheet> | null, next: Partial<SetupSheet>): SheetChange[] {
  if (!prev) return [];
  return SHEET_FIELDS.filter((f) => !same(prev[f.key], next[f.key])).map((f) => ({ key: f.key, label: f.label, from: prev[f.key] ?? null, to: next[f.key] ?? null }));
}

const CORNER_LABEL: Record<string, string> = { Fl: 'DI', Fr: 'DD', Rl: 'TI', Rr: 'TD' };

/**
 * The artboard's note: "TI/TD 40 → 42". A pair of corners that moved together
 * (both rears, both fronts) reads as one change; everything else is listed.
 */
export function describeChanges(changes: SheetChange[]): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  const fmt = (v: unknown) => (v == null || v === '' ? '—' : v === true ? 'sí' : v === false ? 'no' : String(v));
  for (const c of changes) {
    if (used.has(c.key)) continue;
    const m = String(c.key).match(/^(psiCold|psiHot|camber|rh)(Fl|Fr|Rl|Rr)(Mm)?$/);
    if (m) {
      const partner = `${m[1]}${m[2] === 'Fl' ? 'Fr' : m[2] === 'Fr' ? 'Fl' : m[2] === 'Rl' ? 'Rr' : 'Rl'}${m[3] ?? ''}`;
      const p = changes.find((x) => x.key === partner);
      if (p && same(p.from, c.from) && same(p.to, c.to)) {
        const pair = m[2].startsWith('F') ? 'DI/DD' : 'TI/TD';
        const what = m[1] === 'psiHot' ? ' caliente' : m[1] === 'camber' ? ' camber' : m[1] === 'rh' ? ' altura' : '';
        out.push(`${pair}${what} ${fmt(c.from)} → ${fmt(c.to)}`);
        used.add(c.key);
        used.add(partner);
        continue;
      }
      out.push(`${CORNER_LABEL[m[2]]}${m[1] === 'psiHot' ? ' caliente' : m[1] === 'camber' ? ' camber' : m[1] === 'rh' ? ' altura' : ''} ${fmt(c.from)} → ${fmt(c.to)}`);
      used.add(c.key);
      continue;
    }
    out.push(`${c.label} ${fmt(c.from)} → ${fmt(c.to)}`);
    used.add(c.key);
  }
  return out;
}

export type Corner = 'fl' | 'fr' | 'rl' | 'rr';

/** Hot − cold per corner, null where either is missing. */
export function pressureDeltas(sheet: Partial<SetupSheet>): Record<Corner, number | null> {
  const d = (hot: number | null | undefined, cold: number | null | undefined) => (hot != null && cold != null ? Math.round((hot - cold) * 10) / 10 : null);
  return {
    fl: d(sheet.psiHotFl, sheet.psiColdFl),
    fr: d(sheet.psiHotFr, sheet.psiColdFr),
    rl: d(sheet.psiHotRl, sheet.psiColdRl),
    rr: d(sheet.psiHotRr, sheet.psiColdRr),
  };
}

/** A rear that grew more than `threshold` psi hot: red on the grid (normal in drift, the note says). */
export function flagRearGrowth(sheet: Partial<SetupSheet>, threshold = 8): boolean {
  const d = pressureDeltas(sheet);
  return (d.rl != null && d.rl > threshold) || (d.rr != null && d.rr > threshold);
}

// --------------------------------------------------------------- summary ---

export type EventSummary = {
  sessions: number;
  runs: number;
  laps: number;
  bestLapMs: number | null;
  tiresBurned: number;
  kmOnTrack: number | null;
  spendDop: number;
};

export function eventSummary(
  event: Pick<TrackEvent, 'odometerStartKm' | 'odometerEndKm' | 'entryFeeDop' | 'fuelCostDop' | 'otherCostDop'>,
  sessions: Pick<TrackSession, 'runs' | 'laps' | 'bestLapMs' | 'deletedAt'>[],
  usage: Pick<ConsumableUsage, 'kind' | 'deletedAt'>[],
): EventSummary {
  const live = sessions.filter((s) => !s.deletedAt);
  const laps = live.map((s) => s.bestLapMs).filter((x): x is number => x != null && x > 0);
  const km = event.odometerStartKm != null && event.odometerEndKm != null && event.odometerEndKm >= event.odometerStartKm ? event.odometerEndKm - event.odometerStartKm : null;
  return {
    sessions: live.length,
    runs: live.reduce((t, s) => t + (s.runs ?? 0), 0),
    laps: live.reduce((t, s) => t + (s.laps ?? 0), 0),
    bestLapMs: laps.length ? Math.min(...laps) : null,
    tiresBurned: usage.filter((u) => !u.deletedAt && u.kind === 'goma_quemada').length,
    kmOnTrack: km,
    spendDop: (event.entryFeeDop ?? 0) + (event.fuelCostDop ?? 0) + (event.otherCostDop ?? 0),
  };
}

/** Timed disciplines count laps; drift and juntes count runs. */
export function isTimed(discipline: TrackDiscipline): boolean {
  return discipline !== 'drift' && discipline !== 'junte';
}

/**
 * Best lap per venue (the PB strip). Only timed sessions with a time count;
 * drift days have no lap to beat.
 */
export type Best = { venueId: string; layout: string | null; bestLapMs: number; eventId: string; occurredAt: string };

/** "Completo " and "completo" are the same layout; blank is none. */
export const layoutKey = (layout: string | null | undefined): string => (layout ?? '').trim().toLowerCase();

/**
 * Best lap per venue **and layout** (the PB strip): a lap on the short
 * configuration does not beat one on the full circuit. Only timed sessions
 * with a time count; drift days have no lap to beat.
 */
export function personalBests(
  events: (Pick<TrackEvent, 'id' | 'venueId' | 'occurredAt' | 'discipline' | 'deletedAt'> & { layout?: string | null })[],
  sessions: Pick<TrackSession, 'eventId' | 'bestLapMs' | 'deletedAt'>[],
): Best[] {
  const best = new Map<string, Best>();
  for (const e of events) {
    if (e.deletedAt || !e.venueId || !isTimed(e.discipline)) continue;
    const key = `${e.venueId}|${layoutKey(e.layout)}`;
    for (const s of sessions) {
      if (s.deletedAt || s.eventId !== e.id || !s.bestLapMs) continue;
      const cur = best.get(key);
      if (!cur || s.bestLapMs < cur.bestLapMs) best.set(key, { venueId: e.venueId, layout: e.layout?.trim() || null, bestLapMs: s.bestLapMs, eventId: e.id, occurredAt: e.occurredAt });
    }
  }
  return [...best.values()].sort((a, b) => a.bestLapMs - b.bestLapMs);
}

// ----------------------------------------------------------- consumables ---

/** One heat cycle per `ciclo_goma` row for the tire. */
export function heatCycles(usage: Pick<ConsumableUsage, 'kind' | 'tireId' | 'deletedAt'>[], tireId: string): number {
  return usage.filter((u) => !u.deletedAt && u.kind === 'ciclo_goma' && u.tireId === tireId).length;
}

export type PadMeasurement = { at: string; mm: number; sessionsBefore: number };

export type PadLife = {
  lastMm: number;
  /** mm per session, null until two measurements with sessions between them. */
  wearPerSession: number | null;
  /** Sessions left before `threshold` mm, null without a wear rate. */
  sessionsLeft: number | null;
  /** True when the next session would go under the threshold (or already has). */
  due: boolean;
};

export const PAD_MIN_TRACK_MM = 5;
export const PAD_MIN_STREET_MM = 3;

/**
 * Pad wear from the measurements on track days: the rate between the first
 * and the last measurement since the last pad change, per session driven in
 * between. `due` fires when
 * the last reading is already under the threshold or one more session would
 * take it there.
 */
export function padLife(measurements: PadMeasurement[], threshold = PAD_MIN_TRACK_MM): PadLife | null {
  const sorted = [...measurements].filter((m) => Number.isFinite(m.mm)).sort((a, b) => a.at.localeCompare(b.at));
  if (!sorted.length) return null;
  // A reading thicker than the one before it means new pads: the rate starts over there.
  let start = 0;
  for (let i = 1; i < sorted.length; i++) if (sorted[i].mm > sorted[i - 1].mm) start = i;
  const list = sorted.slice(start);
  const first = list[0];
  const last = list[list.length - 1];
  const sessions = last.sessionsBefore - first.sessionsBefore;
  const wear = list.length > 1 && sessions > 0 && first.mm > last.mm ? (first.mm - last.mm) / sessions : null;
  const sessionsLeft = wear ? Math.max(0, Math.floor((last.mm - threshold) / wear)) : null;
  const due = last.mm <= threshold || (wear != null && last.mm - wear < threshold);
  return { lastMm: last.mm, wearPerSession: wear, sessionsLeft, due };
}
