import type { LastFix } from './lastFix';

/**
 * Where the drive-mode map looks when it does not know where you are (IMP 16102026 M-7, ADR-64, SPEC-A). Pure.
 * In order: the last position the phone had (with how old it is) → the centre of the recent trips → Santo Domingo.
 * Never a house or any other personal place, and never a black box: the map always has a camera.
 */
export const SANTO_DOMINGO = { lat: 18.4861, lng: -69.9312 } as const;

export type CameraFallback = {
  lat: number;
  lng: number;
  zoom: number;
  source: 'last_fix' | 'trips' | 'default';
  /** Only for `last_fix`: how old the position is, for "hace X". */
  ageMs: number | null;
};

const ok = (p: { lat: number; lng: number }) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

export function fallbackCamera({
  lastFix,
  tripPoints,
  now = Date.now(),
}: {
  lastFix: LastFix | null;
  /** Where recent trips started (any order). */
  tripPoints: { lat: number; lng: number }[];
  now?: number;
}): CameraFallback {
  if (lastFix && ok(lastFix)) return { lat: lastFix.lat, lng: lastFix.lng, zoom: 14, source: 'last_fix', ageMs: Math.max(0, now - lastFix.t) };
  const pts = tripPoints.filter(ok);
  if (pts.length) {
    // The median, so one trip to the other side of the island does not drag the centre into the sea.
    const mid = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    };
    return { lat: mid(pts.map((p) => p.lat)), lng: mid(pts.map((p) => p.lng)), zoom: 12, source: 'trips', ageMs: null };
  }
  return { ...SANTO_DOMINGO, zoom: 12, source: 'default', ageMs: null };
}
