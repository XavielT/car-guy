import { useEffect, useState } from 'react';

import { trips } from '@/lib/db/tripOps';
import { fallbackCamera, SANTO_DOMINGO, type CameraFallback } from '@/lib/map/fallbackCamera';
import { loadLastFix } from '@/lib/map/lastFix';

/**
 * The camera for a map that does not know where you are (IMP 16102026 M-7, ADR-64): starts on Santo Domingo, then —
 * as soon as the local settings answer — the last position the phone had, or the middle of the recent trips.
 * Never a house, never a blank box.
 */
export function useFallbackCamera(): CameraFallback {
  const [camera, setCamera] = useState<CameraFallback>({ ...SANTO_DOMINGO, zoom: 12, source: 'default', ageMs: null });
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [lastFix, recent] = await Promise.all([
        loadLastFix().catch(() => null),
        trips.listWhere({}, { orderBy: 'started_at', direction: 'DESC', limit: 12 }).catch(() => []),
      ]);
      if (!alive) return;
      const tripPoints = recent.flatMap((t) => (t.startLat != null && t.startLng != null ? [{ lat: t.startLat, lng: t.startLng }] : []));
      setCamera(fallbackCamera({ lastFix, tripPoints }));
    })();
    return () => {
      alive = false;
    };
  }, []);
  return camera;
}
