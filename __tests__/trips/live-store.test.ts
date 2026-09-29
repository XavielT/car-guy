/** lib/trips/liveStore.ts reduceLive — what the speed cluster shows (ADR-31). */
import { GPS_STALE_MS, gpsNow, reduceLive, type LiveTrip } from '@/lib/trips/liveStore';

const start: LiveTrip = {
  tripId: 't', vehicleId: 'v', role: 'conductor', startedAt: 0,
  speedKmh: 0, maxKmh: 0, distanceM: 0, movingS: 0, lastFixAt: null, gps: 'none',
};

it('the first fix sets the speed; later ones are smoothed', () => {
  const a = reduceLive(start, { t: 1000, speedKmh: 60, accM: 5, stepM: 0, moving: true });
  expect(a.speedKmh).toBe(60);
  const b = reduceLive(a, { t: 2000, speedKmh: 0, accM: 5, stepM: 16, moving: false });
  expect(b.speedKmh).toBeCloseTo(60 * 0.65, 5);
  expect(b.distanceM).toBe(16);
});

it('max, moving time and GPS quality', () => {
  let s = start;
  s = reduceLive(s, { t: 0, speedKmh: 50, accM: 8, stepM: 0, moving: true });
  s = reduceLive(s, { t: 1000, speedKmh: 90, accM: 8, stepM: 20, moving: true });
  s = reduceLive(s, { t: 2000, speedKmh: 90, accM: 45, stepM: 25, moving: true });
  expect(s.maxKmh).toBeGreaterThan(70);
  expect(s.movingS).toBe(2);
  expect(s.gps).toBe('weak');
  expect(gpsNow(s, 2000 + GPS_STALE_MS + 1)).toBe('none');
});
