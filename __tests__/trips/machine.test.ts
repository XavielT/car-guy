import type { Fix } from '@/lib/trips/geo';
import {
  DEFAULT_TRIP_CFG,
  fixFromLocation,
  initialTripState,
  parseTripState,
  resolveTripCfg,
  step,
  stepAll,
  type TripInput,
} from '@/lib/trips/machine';
import { feed, loadDrive, newReplay, openTrips, seqId } from '../helpers/tripReplay';

const LAT = 18.46;
const M_LAT = 110574;
const M_LNG = 111320 * Math.cos((LAT * Math.PI) / 180);
const T0 = Date.parse('2026-09-29T13:00:00Z');
const MIN = 60;

/** Writes 1 Hz fixes for a car moving east along 27 de Febrero (roughly). */
class Drive {
  t = T0;
  x = 0; // meters east of the origin
  y = 0;
  readonly fixes: Fix[] = [];
  private k = 0;

  private push(speed: number | null, acc: number | null) {
    // Tiny deterministic wobble (±1 m) so parked fixes are not identical.
    const w = ((this.k++ % 3) - 1) * 1;
    this.fixes.push({
      t: this.t,
      lat: LAT + (this.y + w) / M_LAT,
      lng: -69.97 + this.x / M_LNG,
      speed,
      acc,
    });
  }

  /** `s` seconds at `v` m/s (reported), one fix per second. */
  go(s: number, v: number, opts: { acc?: number | null; reported?: boolean } = {}) {
    for (let i = 0; i < s; i++) {
      this.t += 1000;
      this.x += v;
      this.push(opts.reported === false ? null : v, opts.acc === undefined ? 5 : opts.acc);
    }
    return this;
  }

  /** Stopped for `s` seconds, still reporting fixes. */
  park(s: number) {
    return this.go(s, 0);
  }

  /** `s` seconds without any fix, moving `m` meters meanwhile. */
  gap(s: number, m = 0) {
    this.t += s * 1000;
    this.x += m;
    return this;
  }

  take() {
    return this.fixes.splice(0);
  }
}

const tick = (t: number): TripInput => ({ type: 'tick', t });

describe('auto start', () => {
  it('opens after 3 consecutive fixes over 5.5 m/s, starting at the fix before the streak', () => {
    const d = new Drive().go(20, 1.2); // walking to the car
    const r = feed(newReplay(), d.take());
    expect(r.trips.size).toBe(0);

    d.go(2, 8);
    feed(r, d.take());
    expect(r.trips.size).toBe(0); // only 2 fast fixes

    d.go(1, 8);
    feed(r, d.take());
    const trips = openTrips(r);
    expect(trips).toHaveLength(1);
    const opened = r.results.find((x) => x.open)!;
    expect(opened.open!.source).toBe('auto');
    expect(opened.switchTo).toBe('recording');
    // Streak (3) + the walking fix before it.
    expect(trips[0].points).toHaveLength(4);
    expect(opened.open!.startedAt).toBe(trips[0].points[0].t);
  });

  it('a slow fix breaks the streak; inaccurate fixes never start a trip', () => {
    const d = new Drive().go(2, 8).go(1, 1).go(2, 8);
    const r = feed(newReplay(), d.take());
    expect(r.trips.size).toBe(0);
    feed(r, new Drive().go(30, 15, { acc: 80 }).take());
    expect(r.trips.size).toBe(0);
  });

  it('also opens on > 300 m of displacement within 2 min (no speed reported, sparse fixes)', () => {
    // Watching mode: a fix every 15 s, 75 m apart (5 m/s, under the start
    // speed), no speed reported — only the displacement rule can fire.
    const d = new Drive();
    const fixes: Fix[] = [];
    for (let i = 0; i < 6; i++) {
      d.gap(15, 75);
      fixes.push({ t: d.t, lat: LAT, lng: -69.97 + d.x / M_LNG, speed: null, acc: 20 });
    }
    const r = feed(newReplay(), fixes);
    expect(r.trips.size).toBe(1);
  });

  it('ignores fixes while idle when auto detection is off (Solo manual)', () => {
    const cfg = resolveTripCfg({ autoDetect: false });
    const r = feed(newReplay(), new Drive().go(60, 15).take(), cfg);
    expect(r.trips.size).toBe(0);
  });
});

describe('stop detection (ADR-28)', () => {
  it('a 3-minute traffic light does NOT end the trip', () => {
    const d = new Drive().go(5 * MIN, 15).park(3 * MIN).go(3 * MIN, 15);
    const r = feed(newReplay(), d.take());
    expect(r.trips.size).toBe(1);
    expect(openTrips(r)).toHaveLength(1);
    expect(r.results.some((x) => x.close)).toBe(false);
  });

  it('a real 5-minute stop ends it 4 minutes in, dated when the car stopped', () => {
    const d = new Drive().go(5 * MIN, 15);
    const stoppedAt = d.t + 1000;
    d.park(5 * MIN);
    const r = feed(newReplay(), d.take());
    const closed = r.results.find((x) => x.close)!;
    expect(closed.close).toMatchObject({ reason: 'stop', discard: false, segments: 1 });
    expect(closed.close!.endedAt).toBe(stoppedAt);
    // Detected on the fix 4 min after the stop began (not at the end of the stop).
    const [trip] = r.trips.values();
    expect(trip.points[trip.points.length - 1].t - stoppedAt).toBe(4 * MIN * 1000);
    expect(closed.switchTo).toBe('watching');
    expect(closed.close!.distanceM).toBeCloseTo(4500, -2);
    expect(r.state.phase).toBe('idle');
  });

  it('slow creeping in traffic (< 1.5 m/s but moving away) does not end it', () => {
    const d = new Drive().go(3 * MIN, 15).go(6 * MIN, 1); // 360 m of crawl
    const r = feed(newReplay(), d.take());
    expect(openTrips(r)).toHaveLength(1);
  });

  it('parked with no fixes at all (distanceInterval): a tick after 4 min closes it', () => {
    const d = new Drive().go(5 * MIN, 15).go(3, 0.5);
    const r = feed(newReplay(), d.take());
    const last = d.t;
    feed(r, [tick(last + 3 * MIN * 1000)]);
    expect(openTrips(r)).toHaveLength(1);
    feed(r, [tick(last + 4 * MIN * 1000 + 1000)]);
    expect(openTrips(r)).toHaveLength(0);
    expect(r.results.find((x) => x.close)!.close!.reason).toBe('stop');
  });

  it('parked with no fixes, then the next fix 6 min later at the same spot: stop, then merge', () => {
    const d = new Drive().go(5 * MIN, 15).go(3, 0.5);
    const r = feed(newReplay(), d.take());
    d.gap(6 * MIN).go(10, 12);
    feed(r, d.take(), DEFAULT_TRIP_CFG, 5);
    expect(r.trips.size).toBe(1);
    const [trip] = r.trips.values();
    expect(trip.segments).toBe(2);
    expect(trip.status).toBe('recording');
  });
});

describe('GPS gaps', () => {
  it('a gap > 10 min closes at the last good fix; the next drive is a new trip', () => {
    const d = new Drive().go(5 * MIN, 15);
    const lastGood = d.t;
    d.gap(12 * MIN, 3000).go(10, 15);
    const r = feed(newReplay(), d.take());
    const closed = r.results.find((x) => x.close)!;
    expect(closed.close).toMatchObject({ reason: 'gap', endedAt: lastGood, discard: false });
    expect(r.trips.size).toBe(2);
    expect(openTrips(r)).toHaveLength(1);
  });

  it('a tick > 10 min after the last fix closes it (no fixes arrive in a tunnel/garage)', () => {
    const d = new Drive().go(5 * MIN, 15);
    const r = feed(newReplay(), d.take());
    feed(r, [tick(d.t + 11 * MIN * 1000)]);
    expect(r.results.find((x) => x.close)!.close!.reason).toBe('gap');
  });

  it('a short gap while moving (tunnel) keeps the trip and counts the distance', () => {
    const d = new Drive().go(2 * MIN, 20).gap(90, 1800).go(MIN, 20);
    const r = feed(newReplay(), d.take());
    expect(r.trips.size).toBe(1);
    expect(r.state.trip!.distanceM).toBeCloseTo(2400 + 1800 + 1200, -2);
  });
});

describe('jump filter', () => {
  it('drops a fix that implies > 70 m/s', () => {
    const d = new Drive().go(2 * MIN, 15);
    const r = feed(newReplay(), d.take());
    const before = r.state.trip!.distanceM;
    const spike: Fix = { t: d.t + 1000, lat: LAT + 0.02, lng: -69.97 + d.x / M_LNG, speed: 15, acc: 5 };
    d.t += 1000;
    d.x += 15;
    feed(r, [spike]);
    expect(r.results[r.results.length - 1].points).toHaveLength(0);
    expect(r.state.trip!.distanceM).toBe(before);
    feed(r, d.go(5, 15).take());
    expect(r.state.trip!.distanceM - before).toBeCloseTo(90, -1);
  });

  it('recovers when the fix before the jump was the bad one', () => {
    const d = new Drive().go(2 * MIN, 15);
    const r = feed(newReplay(), d.take());
    // Pretend a bad fix (2 km off, claiming acc 5 m) was the last one accepted:
    // every real fix after it now looks like a jump.
    const bad: Fix = { t: d.t + 1000, lat: LAT + 0.02, lng: -69.97 + d.x / M_LNG, speed: 15, acc: 5 };
    r.state = { ...r.state, trip: { ...r.state.trip!, last: bad } };
    d.t += 1000;
    const out = feed(r, d.go(8, 15).take());
    const pts = [...out.trips.values()][0].points;
    // First 4 real fixes rejected, the 5th resets the reference, the rest are accepted.
    expect(pts[pts.length - 1].t).toBe(d.t);
    expect(out.state.trip!.rejects).toBe(0);
  });

  it('drops fixes worse than 30 m from the track', () => {
    const d = new Drive().go(MIN, 15).go(10, 15, { acc: 45 }).go(10, 15);
    const r = feed(newReplay(), d.take());
    const [trip] = r.trips.values();
    expect(trip.points.every((p) => (p.acc ?? 0) <= 30)).toBe(true);
  });
});

describe('merge (ADR-28: ≤ 10 min and ≤ 150 m)', () => {
  it('resuming 1 min after a real stop merges into the same trip', () => {
    const d = new Drive().go(5 * MIN, 15).park(5 * MIN).go(3 * MIN, 15);
    const r = feed(newReplay(), d.take(), DEFAULT_TRIP_CFG, 10);
    expect(r.trips.size).toBe(1);
    const [trip] = r.trips.values();
    expect(trip.segments).toBe(2);
    expect(trip.status).toBe('recording');
    const merged = r.results.find((x) => x.merge)!;
    expect(merged.merge!.tripId).toBe(trip.id);
    expect(merged.switchTo).toBe('recording');
    expect(merged.merge!.pausedS).toBeGreaterThan(4 * MIN);
    expect(r.state.trip!.distanceM).toBeCloseTo(4500 + 2700, -2);
    expect(r.switches).toEqual(['recording', 'watching', 'recording']);
  });

  it('resuming after > 10 min is a new trip', () => {
    const d = new Drive().go(5 * MIN, 15).park(5 * MIN).gap(12 * MIN).go(MIN, 15);
    const r = feed(newReplay(), d.take());
    expect(r.trips.size).toBe(2);
  });

  it('resuming within 10 min but > 150 m away (no fixes in between) is a new trip', () => {
    const d = new Drive().go(5 * MIN, 15).park(5 * MIN).gap(3 * MIN, 400).go(MIN, 15);
    const r = feed(newReplay(), d.take());
    expect(r.trips.size).toBe(2);
  });

  it('never merges into a discarded trip, nor into a manual one', () => {
    const d = new Drive().go(30, 10).park(5 * MIN).go(2 * MIN, 15); // 300 m hop, then a drive
    const r = feed(newReplay(), d.take());
    expect([...r.trips.values()].map((t) => t.status)).toEqual(['discarded', 'recording']);

    const m = newReplay();
    feed(m, [{ type: 'manual_start', t: T0 }]);
    const d2 = new Drive().go(5 * MIN, 15);
    feed(m, d2.take());
    feed(m, [{ type: 'manual_stop', t: d2.t }]);
    feed(m, d2.park(MIN).go(MIN, 15).take());
    expect(m.trips.size).toBe(2);
  });
});

describe('discard (< 500 m or < 2 min)', () => {
  it('an auto hop of 400 m is discarded', () => {
    const d = new Drive().go(MIN, 6.5).park(5 * MIN);
    const r = feed(newReplay(), d.take());
    const c = r.results.find((x) => x.close)!.close!;
    expect(c).toMatchObject({ discard: true, discardReason: 'distance' });
  });

  it('a manual 300 m walk is discarded on stop', () => {
    const r = feed(newReplay(), [{ type: 'manual_start', t: T0 }]);
    const d = new Drive().go(215, 1.4);
    feed(r, d.take());
    feed(r, [{ type: 'manual_stop', t: d.t }]);
    const c = r.results.find((x) => x.close)!.close!;
    expect(c).toMatchObject({ reason: 'manual', discard: true, discardReason: 'distance' });
  });

  it('a fast 600 m in 40 s is discarded for duration', () => {
    const r = feed(newReplay(), [{ type: 'manual_start', t: T0 }]);
    const d = new Drive().go(40, 15);
    feed(r, d.take());
    feed(r, [{ type: 'manual_stop', t: d.t }]);
    expect(r.results.find((x) => x.close)!.close).toMatchObject({ discard: true, discardReason: 'duration' });
  });
});

describe('manual trips', () => {
  it('manual_start opens at once (with the given position) and switches to recording', () => {
    const out = step(initialTripState(), { type: 'manual_start', t: T0, lat: LAT, lng: -69.97 }, DEFAULT_TRIP_CFG, {
      newId: () => 'm1',
    });
    expect(out.open).toEqual({ tripId: 'm1', source: 'manual', startedAt: T0, startLat: LAT, startLng: -69.97 });
    expect(out.switchTo).toBe('recording');
  });

  it('never ends on its own: long stops, gaps and ticks do nothing; manual_stop ends it', () => {
    const r = feed(newReplay(), [{ type: 'manual_start', t: T0 }]);
    const d = new Drive().go(5 * MIN, 15).park(10 * MIN).gap(20 * MIN).go(5 * MIN, 15);
    feed(r, d.take(), DEFAULT_TRIP_CFG, 10);
    feed(r, [tick(d.t + 60 * MIN * 1000)]);
    expect(r.results.some((x) => x.close)).toBe(false);
    expect(openTrips(r)).toHaveLength(1);

    const endT = d.t + 60 * MIN * 1000 + 5000;
    feed(r, [{ type: 'manual_stop', t: endT }]);
    const out = r.results[r.results.length - 1];
    expect(out.close).toMatchObject({ reason: 'manual', endedAt: endT, discard: false, source: 'manual' });
    expect(out.switchTo).toBe('watching');
    expect(r.trips.size).toBe(1);
  });

  it('fills the start position from the first fix when manual_start had none', () => {
    const r = feed(newReplay(), [{ type: 'manual_start', t: T0 }]);
    const d = new Drive().go(3 * MIN, 15);
    const first = d.fixes[0];
    feed(r, d.take());
    feed(r, [{ type: 'manual_stop', t: d.t }]);
    const c = r.results.find((x) => x.close)!.close!;
    expect(c.startLat).toBe(first.lat);
    expect(c.startLng).toBe(first.lng);
  });

  it('manual_start while an auto trip is recording adopts it — never two trips', () => {
    const d = new Drive().go(2 * MIN, 15);
    const r = feed(newReplay(), d.take());
    const [auto] = r.trips.values();
    feed(r, [{ type: 'manual_start', t: d.t + 500 }]);
    const out = r.results[r.results.length - 1];
    expect(out.adopt).toEqual({ tripId: auto.id });
    expect(out.open).toBeUndefined();
    expect(out.switchTo).toBeUndefined();
    expect(auto.source).toBe('manual');
    // Now it is manual: a 6-min stop does not close it.
    feed(r, d.park(6 * MIN).take());
    expect(openTrips(r)).toHaveLength(1);
    feed(r, [{ type: 'manual_stop', t: d.t }]);
    expect(r.trips.size).toBe(1);
    expect(auto.status).toBe('done');
  });

  it('manual_start while manual is recording, and manual_stop while idle, are no-ops', () => {
    const s0 = initialTripState();
    const idleStop = step(s0, { type: 'manual_stop', t: T0 });
    expect(idleStop).toMatchObject({ points: [], rest: [] });
    expect(idleStop.close).toBeUndefined();
    const a = step(s0, { type: 'manual_start', t: T0 });
    const b = step(a.state, { type: 'manual_start', t: T0 + 1000 });
    expect(b.open).toBeUndefined();
    expect(b.adopt).toBeUndefined();
    expect(b.state.trip!.id).toBe(a.state.trip!.id);
  });
});

describe('batches and state', () => {
  it('one step never emits two transitions: the rest comes back in `rest`', () => {
    const d = new Drive().go(3 * MIN, 15).gap(12 * MIN, 5000).go(3 * MIN, 15);
    const inputs: TripInput[] = [...d.take(), { type: 'manual_stop', t: d.t + 1000 }];
    const first = step(initialTripState(), inputs, DEFAULT_TRIP_CFG, { newId: seqId });
    expect(first.open).toBeDefined(); // trip A
    expect(first.close).toBeUndefined(); // …its gap close would be a second transition
    expect(first.rest.length).toBeGreaterThan(0);

    const all = stepAll(initialTripState(), inputs, DEFAULT_TRIP_CFG, { newId: seqId });
    const opens = all.filter((x) => x.open).length;
    const closes = all.filter((x) => x.close).map((x) => x.close!.reason);
    expect(opens).toBe(2);
    expect(closes).toEqual(['gap', 'manual']);
    expect(all[all.length - 1].rest).toEqual([]);
    for (const x of all) {
      expect(Number(!!x.open) + Number(!!x.merge)).toBeLessThanOrEqual(1);
    }
  });

  it('batching does not change the outcome', () => {
    const mk = () => new Drive().go(5 * MIN, 15).park(3 * MIN).go(5 * MIN, 20).park(5 * MIN).take();
    const one = feed(newReplay(), mk(), DEFAULT_TRIP_CFG, 1);
    const ten = feed(newReplay(), mk(), DEFAULT_TRIP_CFG, 10);
    const summary = (r: typeof one) =>
      [...r.trips.values()].map((t) => ({ n: t.points.length, status: t.status, closes: t.closes.map((c) => c.reason) }));
    expect(summary(ten)).toEqual(summary(one));
  });

  it('never mutates the input state; the state survives a JSON round-trip', () => {
    const s0 = initialTripState();
    const frozen = JSON.stringify(s0);
    const out = step(s0, new Drive().go(30, 15).take());
    expect(JSON.stringify(s0)).toBe(frozen);
    const back = parseTripState(JSON.stringify(out.state));
    expect(back).toEqual(out.state);
    const next = step(back, new Drive().go(5, 15).take().map((f) => ({ ...f, t: f.t + 60_000 })));
    expect(next.state.phase).toBe('recording');
  });

  it('parseTripState falls back to idle on garbage', () => {
    expect(parseTripState(null)).toEqual(initialTripState());
    expect(parseTripState('{nope')).toEqual(initialTripState());
    expect(parseTripState('{"v":2}')).toEqual(initialTripState());
  });

  it('skips duplicate and out-of-order fixes (trip_point PK is trip_id + t)', () => {
    const fixes = new Drive().go(MIN, 15).take();
    const r = feed(newReplay(), [...fixes, ...fixes.slice(10, 20)], DEFAULT_TRIP_CFG, 7);
    const [trip] = r.trips.values();
    expect(new Set(trip.points.map((p) => p.t)).size).toBe(trip.points.length);
  });
});

describe('config', () => {
  it('resolveTripCfg merges valid overrides from JSON and ignores the rest', () => {
    const cfg = resolveTripCfg('{"stopMinutes":6,"startSpeedMs":-1,"mergeRadiusM":"x","bogus":3}');
    expect(cfg.stopMinutes).toBe(6);
    expect(cfg.startSpeedMs).toBe(DEFAULT_TRIP_CFG.startSpeedMs);
    expect(cfg.mergeRadiusM).toBe(150);
    expect(resolveTripCfg('not json')).toEqual(DEFAULT_TRIP_CFG);
  });

  it('a longer stopMinutes keeps a 5-minute stop inside the trip', () => {
    const d = new Drive().go(5 * MIN, 15).park(5 * MIN).go(MIN, 15);
    const r = feed(newReplay(), d.take(), resolveTripCfg({ stopMinutes: 6 }));
    expect(r.results.some((x) => x.close || x.merge)).toBe(false);
  });

  it('fixFromLocation maps expo-location objects and nulls invalid values', () => {
    expect(
      fixFromLocation({
        timestamp: T0,
        coords: { latitude: 18.4, longitude: -69.9, speed: -1, accuracy: 7, altitude: 30, heading: -1 },
      }),
    ).toEqual({ t: T0, lat: 18.4, lng: -69.9, speed: null, acc: 7, alt: 30, heading: null });
  });
});

describe('GPX fixture replay (drive-synthetic.gpx)', () => {
  it('auto: one trip, survives the 2-min stops, closes at the 5-min stop and merges on resume', () => {
    const fixes = loadDrive(8);
    // Background delivery: batches of 5 fixes (10 s at 2 s per trkpt).
    const r = feed(newReplay(), fixes, DEFAULT_TRIP_CFG, 5);
    expect(r.trips.size).toBe(1);
    const [trip] = r.trips.values();
    expect(trip.segments).toBe(2);
    expect(trip.closes.map((c) => c.reason)).toEqual(['stop']);
    // The fixture ends parked; nothing arrives any more → the recorder's tick.
    const end = fixes[fixes.length - 1].t;
    feed(r, [tick(end + 5 * MIN * 1000)]);
    expect(trip.status).toBe('done');
    const c = trip.closes[1];
    expect(c.reason).toBe('stop');
    expect(c.segments).toBe(2);
    expect(c.distanceM).toBeGreaterThan(11_800);
    expect(c.distanceM).toBeLessThan(12_300);
    expect(r.switches).toEqual(['recording', 'watching', 'recording', 'watching']);
  });

  it('manual: never closes on its own over the whole drive; manual_stop gets the full distance', () => {
    const fixes = loadDrive(8);
    const r = feed(newReplay(), [{ type: 'manual_start', t: fixes[0].t - 1000 }]);
    feed(r, fixes, DEFAULT_TRIP_CFG, 5);
    feed(r, [tick(fixes[fixes.length - 1].t + 30 * MIN * 1000)]);
    expect(openTrips(r)).toHaveLength(1);
    feed(r, [{ type: 'manual_stop', t: fixes[fixes.length - 1].t }]);
    const [trip] = r.trips.values();
    expect(trip.points.length).toBe(fixes.length);
    expect(trip.closes[0]).toMatchObject({ reason: 'manual', discard: false });
    expect(trip.closes[0].distanceM).toBeGreaterThan(11_800);
  });
});
