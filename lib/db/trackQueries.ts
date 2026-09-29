import { getDb } from './client';
import {
  consumables as usageRepo,
  odometer as odometerRepo,
  reminders as reminderRepo,
  setupSheets,
  tires as tireRepo,
  trackEvents,
  trackSessions,
  venues as venueRepo,
} from './repos';
import type { ConsumableUsage, SetupSheet, Tire, TrackEvent, TrackSession, Venue } from './types';
import { addDays, todayIso } from '../domain/dates';
import {
  copyForward,
  diffSheets,
  eventSummary,
  padLife,
  personalBests,
  PAD_MIN_TRACK_MM,
  type EventSummary,
  type PadLife,
  type PadMeasurement,
  type SheetValues,
} from '../domain/track';
import { id as newId } from '../format';

/**
 * Pista's reads and writes (IMP 28092026 Phase 6, ADR-21). An event is a day
 * at a venue; its sessions are numbered from 1 and each has one setup sheet
 * (same id as the session). Consumables hang off the event.
 */

// ---------------------------------------------------------------- venues ---

export async function listVenues(): Promise<Venue[]> {
  return venueRepo.listWhere({}, { orderBy: 'name', direction: 'ASC' });
}

export async function addVenue(input: Pick<Venue, 'name' | 'type'> & { city?: string | null }): Promise<Venue> {
  return venueRepo.upsert({ id: newId(), name: input.name, city: input.city ?? null, type: input.type, isSeeded: false, notes: '', deletedAt: null });
}

// ---------------------------------------------------------------- events ---

export type EventCard = {
  event: TrackEvent;
  venue: Venue | null;
  summary: EventSummary;
};

async function sessionsOf(eventIds: string[]): Promise<TrackSession[]> {
  if (!eventIds.length) return [];
  const all = await Promise.all(eventIds.map((eventId) => trackSessions.listWhere({ eventId }, { orderBy: 'seq', direction: 'ASC' })));
  return all.flat();
}

async function usageOf(eventIds: string[]): Promise<ConsumableUsage[]> {
  if (!eventIds.length) return [];
  const all = await Promise.all(eventIds.map((eventId) => usageRepo.listWhere({ eventId })));
  return all.flat();
}

/** Every event (of a vehicle, or of the garage), newest first, with its summary. */
export async function listEvents(vehicleId?: string): Promise<EventCard[]> {
  const events = await trackEvents.listWhere(vehicleId ? { vehicleId } : {}, { orderBy: 'occurred_at', direction: 'DESC' });
  const ids = events.map((e) => e.id);
  const [sessions, usage, venues] = await Promise.all([sessionsOf(ids), usageOf(ids), listVenues()]);
  const venueById = new Map(venues.map((v) => [v.id, v]));
  return events.map((event) => ({
    event,
    venue: event.venueId ? venueById.get(event.venueId) ?? null : null,
    summary: eventSummary(
      event,
      sessions.filter((s) => s.eventId === event.id),
      usage.filter((u) => u.eventId === event.id),
    ),
  }));
}

export type PersonalBest = { venue: Venue | null; layout: string | null; bestLapMs: number; eventId: string; occurredAt: string };

export async function vehicleBests(vehicleId?: string): Promise<PersonalBest[]> {
  const events = await trackEvents.listWhere(vehicleId ? { vehicleId } : {});
  const [sessions, venues] = await Promise.all([sessionsOf(events.map((e) => e.id)), listVenues()]);
  const venueById = new Map(venues.map((v) => [v.id, v]));
  return personalBests(events, sessions).map((b) => ({ ...b, venue: venueById.get(b.venueId) ?? null }));
}

/** The hub's Resumen line: "3 eventos · PB Sunix 1:23.456". */
export async function trackLine(vehicleId: string): Promise<{ events: number; best: PersonalBest | null }> {
  const [events, bests] = await Promise.all([trackEvents.count(vehicleId), vehicleBests(vehicleId)]);
  return { events, best: bests[0] ?? null };
}

export type EventDetail = {
  event: TrackEvent;
  venue: Venue | null;
  sessions: TrackSession[];
  usage: ConsumableUsage[];
  summary: EventSummary;
};

export async function eventDetail(eventId: string): Promise<EventDetail | null> {
  const event = await trackEvents.getById(eventId);
  if (!event || event.deletedAt) return null;
  const [sessions, usage, venue] = await Promise.all([
    sessionsOf([eventId]),
    usageOf([eventId]),
    event.venueId ? venueRepo.getById(event.venueId) : Promise.resolve(null),
  ]);
  return { event, venue, sessions, usage, summary: eventSummary(event, sessions, usage) };
}

/**
 * Saves an event. Its odometer start/end become readings (source `track`,
 * ids derived from the event so an edit moves them); a cleared value
 * tombstones its reading.
 */
export async function saveEvent(input: Partial<TrackEvent> & Pick<TrackEvent, 'vehicleId' | 'occurredAt' | 'discipline'>): Promise<TrackEvent> {
  const saved = await trackEvents.upsert({ title: '', notes: '', deletedAt: null, ...input, id: input.id ?? newId() });
  const reading = async (suffix: 'start' | 'end', km: number | null, at: string) => {
    const id = `odo_track_${suffix}_${saved.id}`;
    if (km == null) {
      if (await odometerRepo.getById(id)) await odometerRepo.softDelete(id);
      return;
    }
    await odometerRepo.upsert({ id, vehicleId: saved.vehicleId, occurredAt: at, valueKm: km, source: 'track', sourceId: saved.id, deletedAt: null });
  };
  await reading('start', saved.odometerStartKm, saved.occurredAt);
  // The end reading a minute later, so the two never tie on the timeline.
  await reading('end', saved.odometerEndKm, new Date(Date.parse(saved.occurredAt) + 60_000).toISOString());
  return saved;
}

/** Tombstones the event and everything hanging off it. */
export async function deleteEvent(eventId: string): Promise<void> {
  const sessions = await sessionsOf([eventId]);
  for (const s of sessions) {
    await setupSheets.softDelete(s.id);
    await trackSessions.softDelete(s.id);
  }
  for (const u of await usageOf([eventId])) await usageRepo.softDelete(u.id);
  for (const suffix of ['start', 'end']) {
    const id = `odo_track_${suffix}_${eventId}`;
    if (await odometerRepo.getById(id)) await odometerRepo.softDelete(id);
  }
  await trackEvents.softDelete(eventId);
}

// -------------------------------------------------------------- sessions ---

export type SessionDetail = {
  session: TrackSession;
  sheet: SetupSheet | null;
  event: TrackEvent;
  previous: { session: TrackSession; sheet: SetupSheet | null } | null;
  /** How many sessions the event has, for "COPIAR A SESIÓN N+1". */
  count: number;
};

async function previousOf(eventId: string, seq: number): Promise<{ session: TrackSession; sheet: SetupSheet | null } | null> {
  const sessions = await sessionsOf([eventId]);
  const prev = sessions.filter((s) => s.seq < seq).sort((a, b) => b.seq - a.seq)[0];
  if (!prev) return null;
  return { session: prev, sheet: await setupSheets.getForSession(prev.id) };
}

export async function sessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const session = await trackSessions.getById(sessionId);
  if (!session || session.deletedAt) return null;
  const event = await trackEvents.getById(session.eventId);
  if (!event) return null;
  const [sheet, previous, sessions] = await Promise.all([setupSheets.getForSession(sessionId), previousOf(session.eventId, session.seq), sessionsOf([session.eventId])]);
  return { session, sheet: sheet && !sheet.deletedAt ? sheet : null, event, previous, count: sessions.length };
}

/** What "Nueva sesión" opens with: the next number and the last sheet, copied forward. */
export async function sessionDraft(eventId: string): Promise<{ seq: number; sheet: SheetValues; previous: { session: TrackSession; sheet: SetupSheet | null } | null }> {
  const sessions = await sessionsOf([eventId]);
  const seq = sessions.reduce((m, s) => Math.max(m, s.seq), 0) + 1;
  const previous = await previousOf(eventId, seq);
  const { changedFromPrevious: _ignored, ...sheet } = copyForward(previous?.sheet ?? null);
  return { seq, sheet, previous };
}

/**
 * Saves a session and its sheet. `changed_from_previous` is recomputed from
 * the session before it, so the "Cambiaste…" note is always the true diff.
 */
export async function saveSession(
  session: Partial<TrackSession> & Pick<TrackSession, 'eventId' | 'seq'>,
  sheet: SheetValues,
): Promise<TrackSession> {
  const saved = await trackSessions.upsert({ kind: 'practica', notes: '', sectorsMs: '[]', passenger: false, deletedAt: null, ...session, id: session.id ?? newId() });
  const previous = await previousOf(saved.eventId, saved.seq);
  // The column defaults count as values, or a sheet saved without them would "change" them.
  const full: SheetValues = { springUnit: 'kgf_mm', hydro: false, ...sheet };
  const changed = diffSheets(previous?.sheet ?? null, full).map((c) => c.key);
  await setupSheets.upsertForSession(saved.id, { ...full, changedFromPrevious: JSON.stringify(changed), deletedAt: null });
  return saved;
}

/** COPIAR A SESIÓN N+1: a new session with the same sheet and nothing else. */
export async function copyToNextSession(sessionId: string): Promise<TrackSession | null> {
  const d = await sessionDetail(sessionId);
  if (!d) return null;
  const draft = await sessionDraft(d.session.eventId);
  const { changedFromPrevious: _ignored, ...sheet } = copyForward(d.sheet);
  return saveSession({ eventId: d.session.eventId, seq: draft.seq, kind: d.session.kind }, sheet);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await setupSheets.softDelete(sessionId);
  await trackSessions.softDelete(sessionId);
}

// ----------------------------------------------------------- consumables ---

/** The tires of the event's vehicle that are still usable, for "Gomas usadas". */
export async function usableTires(vehicleId: string): Promise<Tire[]> {
  const all = await tireRepo.listWhere({ vehicleId });
  return all.filter((t) => t.status !== 'quemada' && t.status !== 'vendida');
}

const cycleId = (scopeId: string, tireId: string) => `cyc_${scopeId}_${tireId}`;

/**
 * A heat cycle for a tire: once for the day on the event ("Gomas usadas"), or
 * once per session when a session is given ("Gomas en esta sesión"). The row's
 * id is derived from its scope, so ticking twice counts once; unticking
 * tombstones the row and gives the cycle back.
 */
export async function setTireUsed(eventId: string, tire: Tire, used: boolean, sessionId?: string): Promise<void> {
  const id = cycleId(sessionId ?? eventId, tire.id);
  const existing = await usageRepo.getById(id);
  const live = Boolean(existing && !existing.deletedAt);
  if (used === live) return;
  if (used) await usageRepo.upsert({ id, eventId, sessionId: sessionId ?? null, tireId: tire.id, kind: 'ciclo_goma', qty: 1, notes: '', deletedAt: null });
  else await usageRepo.softDelete(id);
  const fresh = (await tireRepo.getById(tire.id)) ?? tire;
  await tireRepo.upsert({ id: tire.id, heatCycles: Math.max(0, (fresh.heatCycles ?? 0) + (used ? 1 : -1)), status: used && fresh.status === 'nueva' ? 'en_uso' : fresh.status });
}

/** "Goma quemada": the tire is retired from the garage (status quemada, off the car). */
export async function burnTire(eventId: string, tire: Tire): Promise<void> {
  // `unit` keeps the corner it burned on; the tire itself leaves the car.
  await usageRepo.upsert({ id: `burn_${eventId}_${tire.id}`, eventId, tireId: tire.id, wheelSetId: tire.wheelSetId, kind: 'goma_quemada', qty: 1, unit: tire.position, treadMm: tire.treadMmCurrent, notes: '', deletedAt: null });
  await tireRepo.upsert({ id: tire.id, status: 'quemada', position: 'unmounted' });
}

export type Axle = 'f' | 'r';

/** "Medir pastillas": one row per axle measured; `unit` carries the axle. */
export async function measurePads(eventId: string, mm: Partial<Record<Axle, number | null>>): Promise<void> {
  for (const axle of ['f', 'r'] as const) {
    const v = mm[axle];
    if (v == null || !Number.isFinite(v)) continue;
    await usageRepo.upsert({ id: `pad_${eventId}_${axle}`, eventId, kind: 'medida_pastilla', padThicknessMm: v, unit: `mm_${axle}`, notes: '', deletedAt: null });
  }
  const event = await trackEvents.getById(eventId);
  if (event) await syncPadReminder(event.vehicleId);
}

/**
 * Pad measurements of a vehicle per axle, each with how many sessions the
 * car had run by the end of that event — the wear rate's denominator.
 */
export async function padSeries(vehicleId: string): Promise<Record<Axle, PadMeasurement[]>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ occurred_at: string; event_id: string; unit: string | null; pad_thickness_mm: number | null; sessions_before: number }>(
    `SELECT e.occurred_at, u.event_id, u.unit, u.pad_thickness_mm,
            (SELECT COUNT(*) FROM track_session s JOIN track_event e2 ON e2.id = s.event_id
              WHERE e2.vehicle_id = e.vehicle_id AND e2.deleted_at IS NULL AND s.deleted_at IS NULL
                AND e2.occurred_at <= e.occurred_at) AS sessions_before
       FROM consumable_usage u JOIN track_event e ON e.id = u.event_id
      WHERE e.vehicle_id = ? AND e.deleted_at IS NULL AND u.deleted_at IS NULL AND u.kind = 'medida_pastilla'
      ORDER BY e.occurred_at ASC`,
    [vehicleId],
  );
  const out: Record<Axle, PadMeasurement[]> = { f: [], r: [] };
  for (const r of rows) {
    if (r.pad_thickness_mm == null) continue;
    const axle: Axle = r.unit === 'mm_r' ? 'r' : 'f';
    out[axle].push({ at: r.occurred_at, mm: r.pad_thickness_mm, sessionsBefore: r.sessions_before });
  }
  return out;
}

export async function padStatus(vehicleId: string): Promise<Record<Axle, PadLife | null>> {
  const series = await padSeries(vehicleId);
  return { f: padLife(series.f, PAD_MIN_TRACK_MM), r: padLife(series.r, PAD_MIN_TRACK_MM) };
}

export const padReminderId = (vehicleId: string) => `rem_pads_track_${vehicleId}`;

/**
 * The reminder hook: when either axle is (or will be after the next session)
 * under 5 mm, "Pastillas (pista)" is due on the next event's date, or in 30
 * days when none is planned. When the pads are fine again (new pads measured),
 * the reminder is switched off rather than deleted, so its history stays.
 */
export async function syncPadReminder(vehicleId: string, today: string = todayIso()): Promise<'armed' | 'cleared' | 'none'> {
  const status = await padStatus(vehicleId);
  const due = Boolean(status.f?.due || status.r?.due);
  const id = padReminderId(vehicleId);
  const existing = await reminderRepo.getById(id);
  if (!due) {
    if (existing && existing.isEnabled) {
      await reminderRepo.upsert({ id, isEnabled: false });
      return 'cleared';
    }
    return 'none';
  }
  const upcoming = (await trackEvents.listWhere({ vehicleId }, { orderBy: 'occurred_at', direction: 'ASC' })).find((e) => e.occurredAt > today);
  const dueDate = upcoming ? upcoming.occurredAt : addDays(today, 30);
  const lows = [status.f?.due ? `delante ${status.f.lastMm} mm` : null, status.r?.due ? `detrás ${status.r.lastMm} mm` : null].filter(Boolean).join(' · ');
  await reminderRepo.upsert({
    id,
    vehicleId,
    title: 'Pastillas (pista)',
    serviceTypeId: 'pastillas_frenos',
    metric: 'date',
    dueDate,
    isRecurring: false,
    fixedInterval: false,
    isEnabled: true,
    notes: `Medida en pista: ${lows}. Mínimo para pista ${PAD_MIN_TRACK_MM} mm.`,
    deletedAt: null,
  });
  return 'armed';
}

/** The event's photos (album items owned by it), oldest first. */
export async function eventPhotos(eventId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ media_id: string }>(
    `SELECT a.media_id FROM album_item a JOIN media m ON m.id = a.media_id
      WHERE a.track_event_id = ? AND a.deleted_at IS NULL AND m.deleted_at IS NULL
      ORDER BY m.taken_at ASC, a.created_at ASC`,
    [eventId],
  );
  return rows.map((r) => r.media_id);
}

/** The tires ticked for one session (its own heat cycles). */
export async function sessionTireIds(sessionId: string): Promise<string[]> {
  const rows = await usageRepo.listWhere({ sessionId });
  return rows.filter((u) => u.kind === 'ciclo_goma' && u.tireId && !u.deletedAt).map((u) => u.tireId as string);
}
