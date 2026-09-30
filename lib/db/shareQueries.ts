import { getDb } from './client';
import { vehicleShares, vehicles as vehicleRepo } from './repos';
import type { VehicleShare } from './types';
import type { RawDossier, ShareFlags } from '../share/dossier';
import { isEmptyCost } from '../domain/costs';
import { vehicleOwnershipCost } from './statsQueries';

/**
 * The share's local reads (IMP 28092026 Phase 7). `localRawDossier` builds the
 * same JSON `carguy.public_dossier()` returns (sql/012) from the phone's own
 * tables — so the car book and the share screen's preview are the page, word
 * for word, and work before anything is synced.
 */

export const shareId = (vehicleId: string) => `share_${vehicleId}`;

export const DEFAULT_FLAGS: ShareFlags = { plate: false, vin: false, costs: false, odometer: true, maintenance: true, mods: true, track: true, story: true };

export function flagsOf(s: VehicleShare | null): ShareFlags {
  if (!s) return { ...DEFAULT_FLAGS };
  return {
    plate: s.showPlate,
    vin: s.showVin,
    costs: s.showCosts,
    odometer: s.showOdometer,
    maintenance: s.showMaintenance,
    mods: s.showMods,
    track: s.showTrack,
    story: s.showStory,
  };
}

export function flagsPatch(f: ShareFlags): Partial<VehicleShare> {
  return {
    showPlate: f.plate,
    showVin: f.vin,
    showCosts: f.costs,
    showOdometer: f.odometer,
    showMaintenance: f.maintenance,
    showMods: f.mods,
    showTrack: f.track,
    showStory: f.story,
  };
}

export async function getShare(vehicleId: string): Promise<VehicleShare | null> {
  const s = await vehicleShares.getById(shareId(vehicleId));
  return s && !s.deletedAt ? s : null;
}

/** Every live public link in the garage, for Más → Compartir. */
export async function activeShares(): Promise<(VehicleShare & { vehicleName: string })[]> {
  const all = await vehicleShares.listWhere({});
  const live = all.filter((s) => s.slug && !s.revokedAt && s.publishedAt && s.visibility !== 'private');
  const out: (VehicleShare & { vehicleName: string })[] = [];
  for (const s of live) {
    const v = await vehicleRepo.getById(s.vehicleId);
    if (v && !v.deletedAt) out.push({ ...s, vehicleName: v.name });
  }
  return out;
}

/** The favourites that go public (≤ 24), newest first — the same rule as the SQL. */
export async function sharedPhotoIds(vehicleId: string, limit = 24): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT m.id FROM album_item a JOIN media m ON m.id = a.media_id
      WHERE a.vehicle_id = ? AND a.deleted_at IS NULL AND m.deleted_at IS NULL AND m.is_favorite = 1
      ORDER BY m.taken_at DESC, m.created_at DESC LIMIT ?`,
    [vehicleId, limit],
  );
  return rows.map((r) => r.id);
}

/** Album photos of the vehicle (any), newest first — the book's photo pages. */
export async function albumPhotoIds(vehicleId: string, from: string | null, to: string | null, limit: number): Promise<{ id: string; takenAt: string | null }[]> {
  const db = await getDb();
  return db.getAllAsync<{ id: string; takenAt: string | null }>(
    `SELECT m.id, m.taken_at AS takenAt FROM album_item a JOIN media m ON m.id = a.media_id
      WHERE a.vehicle_id = ? AND a.deleted_at IS NULL AND m.deleted_at IS NULL
        AND (? IS NULL OR COALESCE(m.taken_at, m.created_at) >= ?) AND (? IS NULL OR COALESCE(m.taken_at, m.created_at) <= ?)
      ORDER BY m.is_favorite DESC, m.taken_at DESC LIMIT ?`,
    [vehicleId, from, from, to, to, limit],
  );
}

const mask = (s: string | null | undefined) => (s ? `${s.slice(0, 3)}••••` : null);

/**
 * The dossier from the phone. `period` narrows services, mods and track events
 * (the book's "período"); the page itself always shows everything.
 */
export async function localRawDossier(
  vehicleId: string,
  flags: ShareFlags,
  opts: { slug?: string | null; visibility?: RawDossier['visibility']; from?: string | null; to?: string | null } = {},
): Promise<RawDossier | null> {
  const v = await vehicleRepo.getById(vehicleId);
  if (!v || v.deletedAt) return null;
  const db = await getDb();
  const from = opts.from ?? null;
  const to = opts.to ?? null;
  const inPeriod = (col: string) => `(? IS NULL OR ${col} >= ?) AND (? IS NULL OR ${col} <= ?)`;
  const period = [from, from, to, to];

  const raw: RawDossier = {
    slug: opts.slug ?? null,
    visibility: opts.visibility ?? 'link',
    show: flags,
    vehicle: {
      name: v.name,
      type: v.type,
      make: v.make,
      model: v.model,
      year: v.year,
      trim: v.trim,
      color: v.color,
      nickname: v.nickname,
      status: v.status,
      chassis_code: v.chassisCode,
      engine_code: v.engineCode,
      transmission: v.transmission,
      drivetrain: v.drivetrain,
      origin: v.origin,
      imported_year: v.importedYear,
      hero_media_id: v.heroMediaId,
      plate: flags.plate ? v.plate : mask(v.plate),
      vin: flags.vin ? v.vin : mask(v.vin),
      story: flags.story ? v.story : null,
      updated_at: v.updatedAt,
    },
    photos: await sharedPhotoIds(vehicleId),
  };

  if (flags.odometer) {
    const r = await db.getFirstAsync<{ km: number | null }>('SELECT MAX(value_km) AS km FROM odometer_reading WHERE vehicle_id = ? AND deleted_at IS NULL', [vehicleId]);
    raw.odometer_km = r?.km ?? null;
  }

  if (flags.mods) {
    const sheet = await db.getFirstAsync<{ stock: string; overrides: string }>('SELECT stock, overrides FROM vehicle_specsheet WHERE vehicle_id = ? AND deleted_at IS NULL', [vehicleId]);
    raw.specsheet = sheet ?? null;
    const mods = await db.getAllAsync<{
      id: string; name: string; brand: string | null; variant: string | null; category_id: string; category: string | null; status: string;
      installed_at: string | null; removed_at: string | null; affects_specs: number; spec_effects: string; tags: string; cost: number;
    }>(
      `SELECT m.id, m.name, m.brand, m.variant, m.category_id, c.name AS category, m.status, m.installed_at, m.removed_at,
              m.affects_specs, m.spec_effects, m.tags,
              m.cost_part_dop + m.cost_labor_dop + m.cost_shipping_dop + m.cost_customs_dop AS cost
         FROM mod m LEFT JOIN mod_category c ON c.id = m.category_id
        WHERE m.vehicle_id = ? AND m.deleted_at IS NULL AND m.status NOT IN ('planeado', 'pedido')
          AND ${inPeriod('COALESCE(m.installed_at, m.created_at)')}
        ORDER BY m.installed_at, m.created_at`,
      [vehicleId, ...period],
    );
    raw.mods = mods.map((m) => ({
      id: m.id,
      name: m.name,
      brand: m.brand,
      variant: m.variant,
      category_id: m.category_id,
      category: m.category,
      status: m.status,
      installed_at: m.installed_at,
      removed_at: m.removed_at,
      affects_specs: Boolean(m.affects_specs),
      spec_effects: m.spec_effects,
      tags: m.tags,
      cost_dop: flags.costs ? m.cost : null,
    }));
  }

  if (flags.maintenance) {
    const rows = await db.getAllAsync<{ kind: string; occurred_at: string; title: string; odometer_km: number | null; total_dop: number }>(
      `SELECT kind, occurred_at, title, odometer_km, total_dop FROM service_record
        WHERE vehicle_id = ? AND deleted_at IS NULL AND kind IN ('mantenimiento', 'reparacion', 'mejora') AND ${inPeriod('occurred_at')}
        ORDER BY occurred_at DESC`,
      [vehicleId, ...period],
    );
    raw.services = rows.map((r) => ({ ...r, odometer_km: flags.odometer ? r.odometer_km : null, total_dop: flags.costs ? r.total_dop : null }));
  }

  if (flags.track) {
    raw.track = await db.getAllAsync<NonNullable<RawDossier['track']>[number]>(
      `SELECT e.id, e.occurred_at, e.title, e.discipline, e.venue_id, vn.name AS venue, e.layout,
              (SELECT COUNT(*) FROM track_session s WHERE s.event_id = e.id AND s.deleted_at IS NULL) AS sessions,
              (SELECT SUM(s.runs) FROM track_session s WHERE s.event_id = e.id AND s.deleted_at IS NULL) AS runs,
              (SELECT MIN(s.best_lap_ms) FROM track_session s WHERE s.event_id = e.id AND s.deleted_at IS NULL AND s.best_lap_ms > 0) AS best_lap_ms
         FROM track_event e LEFT JOIN venue vn ON vn.id = e.venue_id
        WHERE e.vehicle_id = ? AND e.deleted_at IS NULL AND ${inPeriod('e.occurred_at')}
        ORDER BY e.occurred_at DESC`,
      [vehicleId, ...period],
    );
  }

  // Note 8: "lo que me ha costado", the same ownershipCost figure as Cifras — only with "costos" on.
  if (flags.costs) {
    const cost = await vehicleOwnershipCost(vehicleId);
    raw.costs =
      cost && !isEmptyCost(cost)
        ? {
            purchase_dop: cost.purchasePrice,
            sold_dop: cost.soldPrice,
            by_category: cost.byCategory,
            total_dop: cost.total,
            per_km_dop: cost.perKm,
            since: cost.since,
          }
        : null;
  }

  if (flags.story) {
    raw.milestones = await db.getAllAsync<NonNullable<RawDossier['milestones']>[number]>(
      `SELECT kind, occurred_at, title, story FROM milestone WHERE vehicle_id = ? AND deleted_at IS NULL ORDER BY occurred_at`,
      [vehicleId],
    );
  }
  return raw;
}
