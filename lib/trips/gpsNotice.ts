import { isFreshFix } from './freshness';
import type { MyPosition } from './myPosition';

/**
 * What Modo conducir tells the person about their position (IMP 16102026 M-1, M-2, M-4, M-5). Pure.
 *
 * - `ask`      never asked (or refused but askable): a button that asks — not "sin permiso".
 * - `blocked`  only the settings / the browser's site settings can change it: a button that shows how.
 * - `error`    permission fine, but the position could not be read (GPS off, timeout): "Reintentar".
 * - `approx`   only coarse fixes so far (indoors, first seconds on Safari): the map still moves, saying ±N m.
 * - `searching` / `stale`: waiting for a fix / the last good one is old.
 */
export type GpsNotice =
  | { kind: 'ask' }
  | { kind: 'blocked' }
  | { kind: 'error' }
  | { kind: 'approx'; acc: number | null }
  | { kind: 'searching' }
  | { kind: 'stale'; ageMs: number }
  | null;

export function gpsNotice(pos: MyPosition, now: number): GpsNotice {
  if (pos.status === 'idle') return null;
  if (pos.permission === 'undetermined' || pos.permission === 'denied') return { kind: 'ask' };
  if (pos.permission === 'blocked') return { kind: 'blocked' };
  if (pos.fix) return isFreshFix(pos.fix, now) ? null : { kind: 'stale', ageMs: Math.max(0, now - pos.fix.t) };
  if (pos.status === 'error') return { kind: 'error' };
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
