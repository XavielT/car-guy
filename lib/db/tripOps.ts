import type { AlbumItem, Trip, TripPoint } from './types';
import { enqueue, getDb, now } from './client';
import { makeRepo } from './repos/base';
import { odometer as odometerRepo, settings as settingsRepo } from './repos';
import { calibrationFactor, estimateOdometer } from '../trips/odometer';

/**
 * Schema v6 data access that is not a plain synced table (01-data-model-v6.md):
 * trips and their local-only points, the vehicle gallery, the garage layout.
 * Nothing renders these yet — FEATURE_TRIPS and FEATURE_GARAGE_V2 are off.
 */

export const trips = makeRepo<Trip>({ table: 'trip' });

/** Points are kept for this long after a trip is done, then purged. */
export const TRIP_POINTS_KEEP_DAYS = 30;

/**
 * GPS fixes. Local only: never synced, never backed up — the trip row keeps the
 * simplified polyline and the numbers, which is all a second device needs.
 */
export const tripPoints = {
  async insertBatch(points: TripPoint[]): Promise<number> {
    if (!points.length) return 0;
    await enqueue(async (db) => {
      for (const p of points) {
        await db.runAsync(
          `INSERT OR REPLACE INTO trip_point (trip_id, t, lat, lng, speed, acc, alt, heading) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.tripId, p.t, p.lat, p.lng, p.speed, p.acc, p.alt, p.heading] as never,
        );
      }
    });
    return points.length;
  },

  async forTrip(tripId: string): Promise<TripPoint[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Record<string, number | string | null>>(
      'SELECT * FROM trip_point WHERE trip_id = ? ORDER BY t',
      [tripId],
    );
    return rows.map((r) => ({
      tripId: r.trip_id as string,
      t: r.t as number,
      lat: r.lat as number,
      lng: r.lng as number,
      speed: r.speed as number | null,
      acc: r.acc as number | null,
      alt: r.alt as number | null,
      heading: r.heading as number | null,
    }));
  },

  /** Drops the points of trips that ended (done or discarded) before `beforeIso`. */
  async purgeOlderThan(beforeIso: string): Promise<number> {
    let removed = 0;
    await enqueue(async (db) => {
      const result = await db.runAsync(
        `DELETE FROM trip_point WHERE trip_id IN (
           SELECT id FROM trip WHERE status IN ('done', 'discarded') AND COALESCE(ended_at, updated_at) < ?)`,
        [beforeIso],
      );
      removed = result.changes;
    });
    return removed;
  },
};

/** The purge cut-off for "now": TRIP_POINTS_KEEP_DAYS ago. */
export function tripPointsCutoff(from: Date = new Date(now())): string {
  return new Date(from.getTime() - TRIP_POINTS_KEEP_DAYS * 86_400_000).toISOString();
}

const albumItems = makeRepo<AlbumItem>({ table: 'album_item' });

/**
 * The vehicle's gallery: album items with role 'vehicle', in the user's order.
 * The cover is still `vehicle.photo_media_id` (one of these).
 */
export async function vehicleGallery(vehicleId: string): Promise<AlbumItem[]> {
  const items = await albumItems.listWhere({ vehicleId, role: 'vehicle' });
  return items.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

export type GarageLayout = {
  mode: 'grid' | 'list' | 'covers';
  /** Vehicle ids in the user's order; ids not listed go last. */
  order: string[];
  pinned: string | null;
};

export const DEFAULT_GARAGE_LAYOUT: GarageLayout = { mode: 'grid', order: [], pinned: null };

export async function garageLayout(): Promise<GarageLayout> {
  const stored = await settingsRepo.get<Partial<GarageLayout> | null>('garage_layout', null);
  return {
    mode: stored?.mode === 'list' || stored?.mode === 'covers' ? stored.mode : 'grid',
    order: Array.isArray(stored?.order) ? stored.order.filter((id): id is string => typeof id === 'string') : [],
    pinned: typeof stored?.pinned === 'string' ? stored.pinned : null,
  };
}

export async function setGarageLayout(layout: GarageLayout): Promise<void> {
  await settingsRepo.set('garage_layout', layout);
}

/**
 * After a trip is done: the odometer it suggests (ADR-30), as a 'trip_estimate'
 * reading, linked from the trip. Nothing for a passenger trip or a car with no
 * typed reading yet. Returns the suggested km.
 */
export async function suggestOdometerFromTrip(trip: Trip): Promise<number | null> {
  if (trip.role === 'pasajero' || trip.status !== 'done') return null;
  const db = await getDb();
  const typed = await db.getAllAsync<{ value_km: number; occurred_at: string }>(
    `SELECT value_km, occurred_at FROM odometer_reading
      WHERE vehicle_id = ? AND deleted_at IS NULL AND source <> 'trip_estimate'
      ORDER BY occurred_at DESC, value_km DESC LIMIT 2`,
    [trip.vehicleId],
  );
  if (!typed.length) return null;
  const gpsKm = async (fromIso: string, toIso: string | null) =>
    ((
      await db.getFirstAsync<{ m: number | null }>(
        `SELECT SUM(distance_m) AS m FROM trip WHERE vehicle_id = ? AND deleted_at IS NULL AND status = 'done'
           AND role = 'conductor' AND started_at > ? AND (? IS NULL OR started_at <= ?)`,
        [trip.vehicleId, fromIso, toIso, toIso],
      )
    )?.m ?? 0) / 1000;
  const [last, prev] = typed;
  const factor = prev ? calibrationFactor(last.value_km - prev.value_km, await gpsKm(prev.occurred_at, last.occurred_at)) : 1;
  const km = estimateOdometer({ lastTypedKm: last.value_km, gpsSinceKm: await gpsKm(last.occurred_at, null), factor });
  if (km == null || km <= last.value_km) return null;
  const readingId = `odo_trip_${trip.id}`;
  await odometerRepo.upsert({
    id: readingId,
    vehicleId: trip.vehicleId,
    occurredAt: trip.endedAt ?? now(),
    valueKm: km,
    source: 'trip_estimate',
    sourceId: trip.id,
    deletedAt: null,
  });
  await trips.upsert({ id: trip.id, odometerReadingId: readingId });
  return km;
}

/** Local scratch cleanup at launch: GPS points of trips done more than 30 days ago. */
export async function purgeOldTripPoints(): Promise<number> {
  return tripPoints.purgeOlderThan(tripPointsCutoff());
}

/** The recorder's memory (trip_state, one row 'state', local only). */
export async function loadTripStateJson(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>(`SELECT json FROM trip_state WHERE id = 'state'`);
  return row?.json ?? null;
}

export async function saveTripStateJson(json: string): Promise<void> {
  await enqueue(async (db) => {
    await db.runAsync(
      `INSERT INTO trip_state (id, json, updated_at) VALUES ('state', ?, ?)
       ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
      [json, now()],
    );
  });
}
