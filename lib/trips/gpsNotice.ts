import type { GeoErrorKind } from '../permissions/map';
import type { PermissionStatus } from '../permissions/types';
import { isFreshFix } from './freshness';
import type { MyPosition } from './myPosition';

/**
 * What Modo conducir tells the person about their position (IMP 16102026 M-1, M-2, M-4, M-5). Pure.
 *
 * - `permission`  the permission (or the phone's location) is not in order: the screen shows the registry's chip —
 *                 "Activar mi ubicación" when never asked, "Cómo activarla" when blocked. Never "sin permiso" text.
 * - `error`       permission fine, but the position could not be read, and why (no signal / too slow): "Reintentar".
 * - `approx`      only coarse fixes so far (indoors, first seconds on Safari): the map still moves, saying ±N m.
 * - `searching` / `stale`: waiting for a fix / the last good one is old.
 */
export type GpsNotice =
  | { kind: 'permission'; status: PermissionStatus }
  | { kind: 'error'; reason: GeoErrorKind }
  | { kind: 'approx'; acc: number | null }
  | { kind: 'searching' }
  | { kind: 'stale'; ageMs: number }
  | null;

export function gpsNotice(pos: MyPosition, now: number): GpsNotice {
  if (pos.status === 'idle') return null;
  if (pos.permission && pos.permission !== 'granted' && pos.permission !== 'unknown') return { kind: 'permission', status: pos.permission };
  if (pos.fix) return isFreshFix(pos.fix, now) ? null : { kind: 'stale', ageMs: Math.max(0, now - pos.fix.t) };
  if (pos.status === 'error') return { kind: 'error', reason: pos.error ?? 'unknown' };
  if (pos.approx) return { kind: 'approx', acc: pos.approx.acc };
  return { kind: 'searching' };
}

/** The point the map follows: the precise fix, else the approximate one (drawn greyed, never followed as "fresh"). */
export function mapPosition(pos: MyPosition, now: number) {
  const f = pos.fix ?? pos.approx;
  if (!f) return null;
  const fresh = pos.fix ? isFreshFix(pos.fix, now) : false;
  return { lat: f.lat, lng: f.lng, heading: pos.fix ? f.heading : null, fresh, approx: !pos.fix };
}
