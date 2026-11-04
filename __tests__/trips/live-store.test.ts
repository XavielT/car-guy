/** lib/trips/liveStore.ts reduceLive — what the speed cluster shows (ADR-31, ADR-72: the engine's numbers, not a second smoothing). */
import { GPS_STALE_MS, gpsNow, reduceLive, type LiveTrip } from '@/lib/trips/liveStore';

const start: LiveTrip = {
  tripId: 't', vehicleId: 'v', role: 'conductor', startedAt: 0,
  speedKmh: 0, maxKmh: 0, distanceM: 0, movingS: 0, lastFixAt: null, gps: 'none',
};

it('the needle shows the engine’s value as it comes: no moving average on top (that was the lag)', () => {
  const a = reduceLive(start, { t: 1000, speedKmh: 60, accM: 5, stepM: 0, moving: true });
  expect(a.speedKmh).toBe(60);
  const b = reduceLive(a, { t: 2000, speedKmh: 0, accM: 5, stepM: 16, moving: false });
  expect(b.speedKmh).toBe(0);
  expect(b.distanceM).toBe(16);
});

it('the max is the engine’s sustained top speed; it never goes down and a fix without one keeps it', () => {
  let s = reduceLive(start, { t: 0, speedKmh: 50, accM: 8, stepM: 0, moving: true, topKmh: null });
  expect(s.maxKmh).toBe(0);
  s = reduceLive(s, { t: 1000, speedKmh: 90, accM: 8, stepM: 20, moving: true, topKmh: 88 });
  expect(s.maxKmh).toBe(88);
  s = reduceLive(s, { t: 2000, speedKmh: 10, accM: 8, stepM: 5, moving: true, topKmh: 70 });
  expect(s.maxKmh).toBe(88);
  s = reduceLive(s, { t: 3000, speedKmh: 10, accM: 8, stepM: 5, moving: true });
  expect(s.maxKmh).toBe(88);
});

it('a speed spike on the needle does NOT become the max (only the engine’s sustained value does)', () => {
  const s = reduceLive(start, { t: 0, speedKmh: 250, accM: 8, stepM: 0, moving: true, topKmh: 60 });
  expect(s.speedKmh).toBe(250);
  expect(s.maxKmh).toBe(60);
});

it('moving time, GPS quality and the "estimated" flag', () => {
  let s = start;
  s = reduceLive(s, { t: 0, speedKmh: 50, accM: 8, stepM: 0, moving: true, estimated: true });
  s = reduceLive(s, { t: 1000, speedKmh: 90, accM: 8, stepM: 20, moving: true });
  s = reduceLive(s, { t: 2000, speedKmh: 90, accM: 45, stepM: 25, moving: true });
  expect(s.movingS).toBe(2);
  expect(s.gps).toBe('weak');
  expect(s.estimated).toBe(true);
  expect(gpsNow(s, 2000 + GPS_STALE_MS + 1)).toBe('none');
});
