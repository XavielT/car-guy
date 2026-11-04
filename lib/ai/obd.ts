/**
 * "Explain this code for my car" — the app side of `cg-ai-obd` (IMP 03112026 SPEC-D §D1, PROMPT-04 step 3).
 *
 *   · `buildObdInput`  assembles the MINIMAL request from the device's own data (offline-first stays the source): the car's
 *                      make/model/year/engine, the same code seen before, the repairs of the last 24 months in the systems
 *                      that code belongs to, other pending codes. No plate, no VIN, no owner, no photos, no location.
 *   · `historyHash`    the cache key: same car + same codes + same relevant history = the same question, so re-opening costs
 *                      nothing; a new repair changes the hash (the answer may change), a new odometer reading does not.
 *   · `obdActions`     the CLOSED list of things the answer can offer: create a repair, add a task, remind to re-scan.
 *                      Nothing is ever written silently: each is a draft the person confirms in the normal form.
 *   · the cache        `carguy.ai_insights` (sql/043), written with the person's own session. Optional: if it is missing or
 *                      unreachable the explanation still works, it just costs a call next time.
 * Pure except `askObd` / the cache calls.
 */
import type { ServiceCategory, ServiceRecord, Vehicle, VehicleDtcEvent } from '../db/types';
import { getSupabase } from '../cloud/supabase';
import { normalizeCode } from '../domain/dtc';
import type { FreezeFrame } from '../domain/dtcParse';
import { callAi } from './client';

// ───────────────────────── what the function answers (mirrors supabase/functions/cg-ai-obd/obd.ts) ─────────────────────────
export type CanDrive = 'yes' | 'careful' | 'no';
export type ObdCause = {
  title: string;
  likelihood: 'probable' | 'possible' | 'rare';
  why: string;
  parts: string[];
  diy_or_shop: 'diy' | 'shop' | 'either';
  cost_rd: { min: number; max: number } | null;
  recently_repaired: boolean;
};
export type ObdAnswer = {
  codes: string[];
  can_drive: CanDrive;
  can_drive_reason: string;
  safety_override: string | null;
  history_note: string | null;
  causes: ObdCause[];
  first_checks: string[];
  diy_or_shop: 'diy' | 'shop' | 'either';
  cost_range_rd: { min: number; max: number } | null;
  stop_and_tow_when: string;
  related_codes: string[];
  sanitized: number;
};

export type ObdRequest = {
  codes: string[];
  vehicle: { make: string | null; model: string | null; year: number | null; engine: string | null; fuel: string | null; odometerKm: number | null; transmission: string | null; origin: string | null };
  history: {
    sameCode: { date: string; odometerKm: number | null }[];
    repairs: { date: string; title: string; system: string | null; parts: string[] }[];
    pending: { code: string; date: string }[];
  };
  freezeFrame: FreezeFrame | null;
};

// ───────────────────────── which repairs are "the same system" as a code ─────────────────────────

/** The repair systems whose recent work can explain a code of this block (SAE letter + second digit). */
export function systemsFor(code: string): ServiceCategory[] {
  const c = normalizeCode(code);
  if (!c) return [];
  switch (c[0]) {
    case 'P': return c[1] === '2' ? ['motor', 'electrico'] : ['motor', 'filtros', 'fluidos', 'electrico'];
    case 'C': return ['frenos', 'suspension', 'gomas', 'electrico'];
    case 'B': return ['carroceria', 'electrico'];
    default: return ['electrico']; // U: network / modules
  }
}

const MONTHS_OF_HISTORY = 24;
export const MAX_HISTORY_REPAIRS = 12;

const monthsAgo = (today: string, months: number): string => {
  const d = new Date(`${today.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
};

export type ObdSource = {
  vehicle: Pick<Vehicle, 'make' | 'model' | 'year'> & { engineCode?: string | null; defaultFuelType?: string | null; transmission?: string | null; origin?: string | null };
  odometerKm: number | null;
  codes: string[];
  /** Every DTC event of this vehicle (the caller already filtered by vehicle). */
  events: readonly VehicleDtcEvent[];
  /** Every repair of this vehicle. */
  repairs: readonly ServiceRecord[];
  /** Part names per repair id (the repair's items), when the caller has them. */
  partsByRepair?: Readonly<Record<string, readonly string[]>>;
  freezeFrame?: FreezeFrame | null;
  today: string;
};

/** The request, from local data only. Pure. */
export function buildObdInput(s: ObdSource): ObdRequest {
  const codes = [...new Set(s.codes.map((c) => normalizeCode(c)).filter((c): c is string => !!c))];
  const systems = new Set(codes.flatMap(systemsFor));
  const since = monthsAgo(s.today, MONTHS_OF_HISTORY);

  const sameCode = s.events
    .filter((e) => codes.includes(e.code) && !e.deletedAt)
    .sort((a, b) => b.seenAt.localeCompare(a.seenAt))
    .slice(0, 6)
    .map((e) => ({ date: e.seenAt.slice(0, 10), odometerKm: e.odometerKm }));
  const pending = s.events
    .filter((e) => !codes.includes(e.code) && !e.clearedAt && !e.deletedAt)
    .sort((a, b) => b.seenAt.localeCompare(a.seenAt))
    .slice(0, 6)
    .map((e) => ({ code: e.code, date: e.seenAt.slice(0, 10) }));
  const repairs = s.repairs
    .filter((r) => !r.deletedAt && r.kind === 'reparacion' && r.occurredAt.slice(0, 10) >= since && (r.system == null || systems.has(r.system)))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, MAX_HISTORY_REPAIRS)
    .map((r) => ({ date: r.occurredAt.slice(0, 10), title: r.title, system: r.system, parts: [...(s.partsByRepair?.[r.id] ?? [])].slice(0, 6) }));

  return {
    codes,
    vehicle: {
      make: s.vehicle.make ?? null, model: s.vehicle.model ?? null, year: s.vehicle.year ?? null,
      engine: s.vehicle.engineCode ?? null, fuel: s.vehicle.defaultFuelType ?? null, odometerKm: s.odometerKm,
      transmission: s.vehicle.transmission ?? null, origin: s.vehicle.origin ?? null,
    },
    history: { sameCode, repairs, pending },
    freezeFrame: s.freezeFrame ?? null,
  };
}

// ───────────────────────── the cache key ─────────────────────────

/** FNV-1a, 32 bit, as 8 hex digits. Not a security hash: a cache key over data the person already owns. */
function fnv1a(s: string, seed = 0x811c9dc5): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Same car + same codes + same relevant history → same key. The ODOMETER and today's date are NOT in it (they change every
 * day and would make the cache useless); the code set, the vehicle's identity, the same-code sightings and the relevant repairs
 * are. Order of the codes does not matter.
 */
export function historyHash(req: ObdRequest): string {
  const canon = JSON.stringify({
    c: [...req.codes].sort(),
    v: [req.vehicle.make, req.vehicle.model, req.vehicle.year, req.vehicle.engine, req.vehicle.fuel],
    s: req.history.sameCode.map((e) => e.date),
    r: req.history.repairs.map((r) => [r.date, r.title, r.system, r.parts]),
    p: req.history.pending.map((e) => e.code).sort(),
    f: req.freezeFrame,
  });
  return fnv1a(canon) + fnv1a(canon, 0x9747b28c);
}

// ───────────────────────── the closed list of actions ─────────────────────────

export type ObdAction =
  | { kind: 'repair'; title: string; description: string; parts: string[] }
  | { kind: 'task'; title: string }
  | { kind: 'rescan'; days: number };

/** Re-scan: soon when it is safe, tomorrow when the answer was cautious. */
export function obdActions(a: ObdAnswer, codes: readonly string[]): ObdAction[] {
  const top = a.causes[0];
  const out: ObdAction[] = [];
  if (top) {
    const parts = [...new Set(a.causes.flatMap((c) => c.parts))].slice(0, 6);
    out.push({
      kind: 'repair',
      title: top.title,
      description: [`${codes.join(', ')}`, parts.length ? `Piezas sospechosas: ${parts.join(', ')}.` : ''].filter(Boolean).join(' · '),
      parts,
    });
    out.push({ kind: 'task', title: `Revisar: ${top.title}` });
  }
  out.push({ kind: 'rescan', days: a.can_drive === 'yes' ? 7 : a.can_drive === 'careful' ? 3 : 1 });
  return out;
}

// ───────────────────────── calls and cache ─────────────────────────

export async function askObd(req: ObdRequest): Promise<ObdAnswer> {
  return callAi<ObdAnswer>('cg-ai-obd', req);
}

/** The two calls the cache needs, on a table the generated types do not know until `types:gen` follows sql/043. */
type Query = { eq(column: string, value: unknown): Query; maybeSingle(): Promise<{ data: unknown; error: unknown }> };
type Insights = { select(columns: string): Query; upsert(row: unknown, options?: unknown): Promise<{ error: unknown }> };
const insights = (): Insights | null => {
  const supabase = getSupabase();
  return supabase ? (supabase as unknown as { from(t: string): Insights }).from('ai_insights') : null;
};

export type CachedObd = { answer: ObdAnswer; status: string; createdAt: string };

/** The stored explanation for this car + question, or null (no account, offline, not applied yet, nothing stored). Never throws. */
export async function readCachedObd(vehicleId: string, hash: string): Promise<CachedObd | null> {
  try {
    const t = insights();
    if (!t) return null;
    const { data, error } = await t.select('payload,status,created_at').eq('vehicle_id', vehicleId).eq('kind', 'obd').eq('input_hash', hash).maybeSingle();
    const row = data as { payload?: ObdAnswer; status?: string; created_at?: string } | null;
    if (error || !row?.payload || !Array.isArray(row.payload.causes)) return null;
    return { answer: row.payload, status: row.status ?? 'new', createdAt: row.created_at ?? '' };
  } catch {
    return null;
  }
}

/** Stores (or, on Refresh, replaces) the explanation. Best effort: a failed save only means the next open asks again. */
export async function saveCachedObd(vehicleId: string, hash: string, answer: ObdAnswer): Promise<boolean> {
  try {
    const t = insights();
    if (!t) return false;
    const { error } = await t.upsert({ vehicle_id: vehicleId, kind: 'obd', input_hash: hash, payload: answer, status: 'new' }, { onConflict: 'user_id,vehicle_id,kind,input_hash' });
    return !error;
  } catch {
    return false;
  }
}
