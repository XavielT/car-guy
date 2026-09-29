/**
 * The unit bridge (02-cloud-v3.md "Sync protocol changes" 2).
 *
 * v6 devices store liters; the cloud's `fuel_log.volume`, `price_per_unit` and
 * `vehicle.tank_volume` stay **gallons** because 2.1.x devices still read and
 * write them. So a push writes both — liters in `volume_l` / `price_per_l` /
 * `tank_l`, gallons in the legacy columns — and stamps `schema_hint = 'v6'`,
 * which 2.1.3's gate uses to leave the row alone.
 *
 * A pull prefers the liters columns, with one guard: when a 2.1.x device edits
 * a v6 row it rewrites the gallons and leaves the stale liters in place (it
 * does not know them). The two then disagree, and the gallons — the newer
 * edit — win.
 *
 * GNV is m³ in every column and is never converted. Pure; no database.
 */
import { SCHEMA_HINT } from './merge';
import { GAL_L, isLiquid } from '../domain/units';

type CloudRow = Record<string, unknown>;

/** Tables whose cloud rows carry `schema_hint` (sql/019). */
export const HINTED_TABLES = new Set(['vehicle', 'fuel_log', 'trip']);

const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
/** Legacy and liters columns "agree" within half a centiliter / a cent. */
const agrees = (liters: number, gallons: number) => Math.abs(liters - gallons * GAL_L) < 0.005 * GAL_L;

/** A local row, shaped for the cloud by toCloudShape, gets both units and the hint. */
export function toCloudUnits(table: string, row: CloudRow): CloudRow {
  if (!HINTED_TABLES.has(table)) return row;
  const out: CloudRow = { ...row, schema_hint: SCHEMA_HINT };

  if (table === 'fuel_log' && isLiquid(row.fuel_type as string)) {
    const liters = num(row.volume);
    const perLiter = num(row.price_per_unit);
    out.volume_l = liters;
    out.price_per_l = perLiter;
    if (liters != null) out.volume = r6(liters / GAL_L);
    if (perLiter != null) out.price_per_unit = r6(perLiter * GAL_L);
  }
  if (table === 'vehicle') {
    const liters = num(row.tank_volume);
    out.tank_l = liters;
    if (liters != null && isLiquid(row.default_fuel_type as string)) out.tank_volume = r6(liters / GAL_L);
  }
  return out;
}

/** A pulled cloud row, in the local v6 shape (liters). */
export function fromCloudUnits(table: string, row: CloudRow): CloudRow {
  if (table === 'fuel_log') return fuelFromCloud(row);
  if (table === 'vehicle') return vehicleFromCloud(row);
  return row;
}

function fuelFromCloud(row: CloudRow): CloudRow {
  const out: CloudRow = { ...row };
  delete out.volume_l;
  delete out.price_per_l;
  if (!isLiquid(row.fuel_type as string)) return out;

  const gallons = num(row.volume);
  const liters = num(row.volume_l);
  const pricePerGal = num(row.price_per_unit);
  const perLiter = num(row.price_per_l);

  if (liters != null && gallons != null && agrees(liters, gallons)) {
    out.volume = liters;
    out.price_per_unit = perLiter ?? (pricePerGal != null ? r6(pricePerGal / GAL_L) : null);
    return out;
  }
  // An old row (no liters yet), or one a 2.1.x device edited after a v6 push.
  if (gallons != null) out.volume = r6(gallons * GAL_L);
  if (pricePerGal != null) out.price_per_unit = r6(pricePerGal / GAL_L);
  if (gallons != null && (row.volume_entered == null || liters != null)) {
    out.volume_entered = gallons;
    out.volume_entered_unit = 'gal';
  }
  return out;
}

function vehicleFromCloud(row: CloudRow): CloudRow {
  const out: CloudRow = { ...row };
  delete out.tank_l;
  if (!isLiquid(row.default_fuel_type as string)) return out;

  const gallons = num(row.tank_volume);
  const liters = num(row.tank_l);
  if (gallons == null) return out;
  if (liters != null && agrees(liters, gallons)) {
    out.tank_volume = liters;
    return out;
  }
  out.tank_volume = r6(gallons * GAL_L);
  if (row.tank_volume_entered == null || liters != null) out.tank_volume_entered = gallons;
  return out;
}
