/**
 * Learned gauge calibration (IMP 01102026, ADR-51) — research 03 §3.5 and §4.
 * The worked example (45 L tank, 9 squares, κ = 0.5, reserve unknown) is the
 * spec; its numbers are pinned to 2 decimals.
 */
import {
  calibrate,
  fitGauge,
  pav,
  recentKmPerL,
  remaining,
  type GaugeCalibration,
  type GaugeObservation,
} from '@/lib/domain/gaugeCalibration';
import type { GaugeCfg } from '@/lib/domain/gauge';

const nine: GaugeCfg = { type: 'segments', segments: 9 };
const C = 45;
const ones = (n: number) => new Array<number>(n).fill(1);

let day = 0;
const at = () => `2026-09-${String(++day).padStart(2, '0')}T12:00:00.000Z`;
const fullAt = (k: number, liters: number, extra: Partial<GaugeObservation> = {}): GaugeObservation => ({
  fracBefore: k / 9,
  liters,
  isFull: true,
  at: at(),
  ...extra,
});
const partialAt = (b: number, a: number, liters: number): GaugeObservation => ({
  fracBefore: b / 9,
  fracAfter: a / 9,
  liters,
  isFull: false,
  at: at(),
});
const expectRow = (got: number[], want: number[]) => {
  expect(got).toHaveLength(want.length);
  want.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 2));
};
const expectMonotone = (f: number[], cap: number) => {
  for (let k = 1; k < f.length; k++) expect(f[k]).toBeGreaterThanOrEqual(f[k - 1]);
  expect(f[0]).toBeGreaterThanOrEqual(0);
  expect(f[f.length - 1]).toBe(cap);
};

describe('pav', () => {
  it('leaves a monotone input unchanged', () => {
    expect(pav([1, 2, 3], [1, 1, 1])).toEqual([1, 2, 3]);
  });
  it('pools adjacent violators', () => {
    expect(pav([1, 3, 2, 4, 3.5, 5], ones(6))).toEqual([1, 2.5, 2.5, 3.75, 3.75, 5]);
    expect(pav([10, 4, 6], [1, 2, 1])).toEqual([6, 6, 6]);
    expect(pav([3, 2, 1], ones(3))).toEqual([2, 2, 2]);
  });
  it('throws on mismatched lengths or a weight ≤ 0', () => {
    expect(() => pav([1, 2], [1])).toThrow();
    expect(() => pav([1, 2], [1, 0])).toThrow();
    expect(() => pav([1, 2], [1, -1])).toThrow();
  });
});

// §3.4: fulls 3/9 + 28 L, 5/9 + 19 L, 1/9 + 36 L; partial 2/9 → 6/9 with 18 L.
const F_ROW = [0, 7.67, 10.81, 16.33, 21.0, 25.67, 29.5, 34.67, 39.83, 45];
const BAND_ROW = [2.98, 2.22, 2.44, 2.22, 2.98, 2.22, 2.44, 2.98, 2.98, 0.5];
const workedLogs = () => [fullAt(3, 28), fullAt(5, 19), partialAt(2, 6, 18), fullAt(1, 36)];

describe('§3.4 worked example (core)', () => {
  const fit = fitGauge(
    9,
    C,
    [
      { before: 3, addedL: 28 },
      { before: 5, addedL: 19 },
      { before: 1, addedL: 36 },
    ],
    [{ before: 2, after: 6, addedL: 18 }],
  );
  it('prior is 5 L per square', () => {
    expectRow(fit.prior, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45]);
  });
  it('ρ after 3 passes', () => {
    expectRow(
      fit.z.map((z, k) => z - fit.prior[k]),
      [0, 2.67, 0.81, 1.33, 1.0, 0.67, -0.5, -0.33, -0.17, 0],
    );
  });
  it('the f row, monotone', () => {
    expectRow(fit.f, F_ROW);
    expectMonotone(fit.f, C);
  });
  it('the partial pulls f(6) − f(2) to 18.69', () => {
    expect(fit.f[6] - fit.f[2]).toBeCloseTo(18.69, 2);
  });
  it('bands and pooled σ', () => {
    expectRow(fit.band, BAND_ROW);
    expect(fit.band[4]).toBeCloseTo(2.98, 2);
    expect(fit.sigma).toBeCloseTo(1.72, 2);
  });
  it('without the partial f(2) = 12.00 and f(6) = 30.50', () => {
    const noPartial = fitGauge(
      9,
      C,
      [
        { before: 3, addedL: 28 },
        { before: 5, addedL: 19 },
        { before: 1, addedL: 36 },
      ],
      [],
    );
    expect(noPartial.f[2]).toBeCloseTo(12.0, 2);
    expect(noPartial.f[6]).toBeCloseTo(30.5, 2);
  });
});

describe('calibrate (fuel logs → gauge_calibration JSON)', () => {
  it('reproduces the worked example from fractions', () => {
    const cal = calibrate(nine, C, null, workedLogs())!;
    expectRow(cal.grid, F_ROW);
    expectRow(cal.band, BAND_ROW);
    expect(cal).toMatchObject({ n_full: 3, n_partial: 1, status: 'aprendido' });
    expect(cal.updated_at).toBe(`2026-09-${String(day).padStart(2, '0')}T12:00:00.000Z`);
    expect(cal.reserve_l).toBeUndefined();
  });
  it('is order-independent (sorts by date)', () => {
    const logs = workedLogs();
    expect(calibrate(nine, C, null, [...logs].reverse())).toEqual(calibrate(nine, C, null, logs));
  });
  it('PAV violation: 3/9 + 22 L and 4/9 + 30 L pool to 18.50', () => {
    const cal = calibrate(nine, C, null, [fullAt(3, 22), fullAt(4, 30)])!;
    expect(cal.grid[3]).toBeCloseTo(18.5, 2);
    expect(cal.grid[4]).toBeCloseTo(18.5, 2);
    expectMonotone(cal.grid, C);
  });
  it('null for an invalid config or capacity', () => {
    expect(calibrate({ type: 'segments', segments: 2 }, C, null, [])).toBeNull();
    expect(calibrate(nine, null, null, [])).toBeNull();
    expect(calibrate(nine, 0, null, [])).toBeNull();
  });
});

describe('status', () => {
  const status = (logs: GaugeObservation[]) => calibrate(nine, C, null, logs)!.status;
  it('linear with no data or only fills from F', () => {
    expect(status([])).toBe('linear');
    expect(status([fullAt(9, 2)])).toBe('linear');
  });
  it('parcial with one fill, or all at the same reading', () => {
    expect(status([fullAt(3, 28)])).toBe('parcial');
    expect(status([fullAt(3, 28), fullAt(3, 29)])).toBe('parcial');
  });
  it('aprendido with ≥ 2 fills at ≥ 2 distinct readings below F', () => {
    expect(status([fullAt(3, 28), fullAt(5, 19)])).toBe('aprendido');
  });
  it('partials alone stay linear', () => {
    expect(status([partialAt(2, 6, 18)])).toBe('linear');
  });
  it('linear keeps the legacy band C/(2G) + nonlinK·C', () => {
    const cal = calibrate(nine, C, null, [])!;
    expectRow(cal.band.slice(0, 9), new Array(9).fill(3.85));
    expect(cal.band[9]).toBe(0.5);
    expectRow(cal.grid, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45]);
    expect(cal.updated_at).toBeNull();
  });
});

describe('prior and reserve', () => {
  it('reserveAt 1, reserveL 6 → f₀..₂ = 0, 6.00, 10.88', () => {
    const cal = calibrate({ ...nine, reserveAt: 1 }, C, 6, [])!;
    expectRow(cal.grid.slice(0, 3), [0, 6, 10.88]);
  });
  it('reserveAt 0, reserveL 6 → f₀ = 3.00', () => {
    const cal = calibrate({ ...nine, reserveAt: 0 }, C, 6, [])!;
    expect(cal.grid[0]).toBeCloseTo(3, 2);
  });
  it('reserve defaults to 10 % of C', () => {
    const cal = calibrate({ ...nine, reserveAt: 1 }, C, null, [])!;
    expect(cal.grid[1]).toBeCloseTo(4.5, 2);
  });
  it('full fills on "solo la luz" give the reserve median once there are 2', () => {
    const one = calibrate(nine, C, null, [fullAt(0, 41, { fracBefore: null, inReserve: true })])!;
    expect(one.reserve_l).toBeUndefined();
    const two = calibrate(nine, C, null, [
      fullAt(0, 41, { fracBefore: null, inReserve: true }),
      fullAt(0, 40, { fracBefore: null, inReserve: true }),
    ])!;
    expect(two.reserve_l).toBe(4.5);
    // On reserve the dash reading is overridden: not a grid point.
    expect(two.n_full).toBe(0);
  });
});

describe('edge cases (§7)', () => {
  it('more liters than the tank holds keeps the point at 0', () => {
    const cal = calibrate(nine, C, null, [fullAt(2, 50)])!;
    expect(cal.grid[2]).toBeGreaterThanOrEqual(0);
    expectMonotone(cal.grid, C);
    // ρ₂ = (0 − 10)/1.5 → z₂ = 3.33.
    expect(cal.grid[2]).toBeCloseTo(3.33, 2);
  });
  it('a reading > 1 step above the last after-level is dropped; 1 step is tolerated', () => {
    const rise = calibrate(nine, C, null, [partialAt(1, 4, 15), fullAt(6, 12)])!;
    expect(rise.n_full).toBe(0);
    const ok = calibrate(nine, C, null, [partialAt(1, 4, 15), fullAt(5, 19)])!;
    expect(ok.n_full).toBe(1);
  });
  it('ignores logs before the reset date', () => {
    const logs = workedLogs();
    const cal = calibrate(nine, C, null, logs, { resetAt: logs[3].at })!;
    expect(cal).toMatchObject({ n_full: 1, n_partial: 0, status: 'parcial' });
  });
  it('weight 0 drops a log; partial with after ≤ before is ignored', () => {
    const cal = calibrate(nine, C, null, [fullAt(3, 28, { weight: 0 }), partialAt(5, 5, 3), partialAt(6, 2, 3)])!;
    expect(cal).toMatchObject({ n_full: 0, n_partial: 0, status: 'linear' });
  });
  it('half-weight readings from an older grid move a cell less', () => {
    const w1 = calibrate(nine, C, null, [fullAt(3, 28)])!;
    const w05 = calibrate(nine, C, null, [fullAt(3, 28, { weight: 0.5 })])!;
    expect(w1.grid[3]).toBeCloseTo(16.33, 2); // 15 + 2/1.5
    expect(w05.grid[3]).toBeCloseTo(16.0, 2); // 15 + 1/1
  });
  it('works on percent and needle grids', () => {
    const p = calibrate({ type: 'percent' }, 40, null, [
      { fracBefore: 0.47, liters: 22, isFull: true, at: at() },
      { fracBefore: 0.2, liters: 33, isFull: true, at: at() },
    ])!;
    expect(p.grid).toHaveLength(21);
    expect(p.status).toBe('aprendido');
    expectMonotone(p.grid, 40);
    const n = calibrate({ type: 'needle8' }, 48, null, [{ fracBefore: 0.25, liters: 38, isFull: true, at: at() }])!;
    expect(n.grid).toHaveLength(9);
    expect(n.grid[2]).toBeCloseTo(12 - 2 / 1.5, 2);
  });
  it('stays monotone and inside [0, C] on noisy data', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let trial = 0; trial < 20; trial++) {
      const logs: GaugeObservation[] = [];
      for (let i = 0; i < 12; i++) {
        const k = Math.floor(rnd() * 9);
        logs.push(rnd() < 0.7 ? fullAt(k, rnd() * 55) : partialAt(k, Math.min(9, k + 1 + Math.floor(rnd() * 4)), rnd() * 30));
      }
      const cal = calibrate(nine, C, null, logs)!;
      expectMonotone(cal.grid, C);
      cal.grid.forEach((v) => expect(v).toBeLessThanOrEqual(C));
      cal.band.forEach((b) => expect(b).toBeGreaterThan(0));
    }
  });
});

describe('recentKmPerL (§4)', () => {
  const spans = [
    { distanceKm: 600, liters: 34, status: 'measured' },
    { distanceKm: 420, liters: 24, status: 'measured' },
    { distanceKm: 510, liters: 29, status: 'measured' },
  ];
  it('ΣD/ΣL over the last 3 measured spans, ±5 % floor', () => {
    const r = recentKmPerL(spans)!;
    expect(r.kmPerL).toBeCloseTo(17.59, 2);
    expect(r.rel).toBe(0.05);
    expect(r.source).toBe('recent');
  });
  it('only the last 3 measured points count', () => {
    const r = recentKmPerL([{ distanceKm: 100, liters: 50, status: 'measured' }, ...spans, { distanceKm: 900, liters: 10, status: 'estimated' }])!;
    expect(r.kmPerL).toBeCloseTo(1530 / 87, 6);
  });
  it('a wide spread widens the band beyond the floor', () => {
    const r = recentKmPerL([
      { distanceKm: 300, liters: 30 },
      { distanceKm: 600, liters: 30 },
    ])!;
    expect(r.kmPerL).toBe(15);
    // km/L {10, 20}, weights 300:600, around 15: variance (300·25 + 600·25)/900 = 25 → SD 5.
    expect(r.rel).toBeCloseTo(5 / 15, 6);
  });
  it('falls back to the lifetime average, then to nothing', () => {
    expect(recentKmPerL([], 16)).toEqual({ kmPerL: 16, rel: 0.05, source: 'lifetime' });
    expect(recentKmPerL([])).toBeNull();
  });
});

describe('remaining (§4)', () => {
  const kpl = recentKmPerL([
    { distanceKm: 600, liters: 34 },
    { distanceKm: 420, liters: 24 },
    { distanceKm: 510, liters: 29 },
  ]);
  const learned = calibrate(nine, C, null, workedLogs()) as GaugeCalibration;

  it('4/9 learned: 21 L (18–24), ≈ 370 km (300–450)', () => {
    const r = remaining(learned, nine, C, 4 / 9, kpl)!;
    expect(r.liters).toBeCloseTo(21, 2);
    expect(r.band[0]).toBeCloseTo(18.02, 2);
    expect(r.band[1]).toBeCloseTo(23.98, 2);
    expect(r.km).toBe(370);
    expect(r.kmBand).toEqual([300, 450]);
  });
  it('4/9 linear: 20 ± 3.85 L, 260–450 km', () => {
    for (const cal of [null, calibrate(nine, C, null, [])]) {
      const r = remaining(cal, nine, C, 4 / 9, kpl)!;
      expect(r.liters).toBeCloseTo(20, 2);
      expect(r.band[0]).toBeCloseTo(16.15, 2);
      expect(r.band[1]).toBeCloseTo(23.85, 2);
      expect(r.kmBand).toEqual([260, 450]);
    }
  });
  it('light on (reserveL 4.5): 2–4.5 L, ≈ 30–90 km', () => {
    const r = remaining(learned, nine, C, null, kpl, { onReserve: true, reserveL: 4.5 })!;
    expect(r.band).toEqual([2.25, 4.5]);
    expect(r.kmBand).toEqual([30, 90]);
  });
  it('light on uses the learned reserve median when none is configured', () => {
    const cal = calibrate(nine, C, null, [
      fullAt(0, 41, { fracBefore: null, inReserve: true }),
      fullAt(0, 40, { fracBefore: null, inReserve: true }),
    ]);
    expect(remaining(cal, nine, C, null, null, { onReserve: true })!.band).toEqual([2.25, 4.5]);
  });
  it('liters only without an economy figure', () => {
    const r = remaining(learned, nine, C, 4 / 9)!;
    expect(r.km).toBeNull();
    expect(r.kmBand).toBeNull();
    expect(r.band[1]).toBeGreaterThan(r.band[0]);
  });
  it('a plain km/L number gets the 5 % floor', () => {
    expect(remaining(learned, nine, C, 4 / 9, 17.586)!.kmBand).toEqual([300, 450]);
  });
  it('interpolates between grid steps and clamps the band to [0, C]', () => {
    const mid = remaining(learned, nine, C, 4.5 / 9)!;
    expect(mid.liters).toBeCloseTo((21 + 25.67) / 2, 2);
    const top = remaining(learned, nine, C, 1)!;
    expect(top.liters).toBe(45);
    expect(top.band[1]).toBeLessThanOrEqual(45);
    const bottom = remaining(null, nine, C, 0)!;
    expect(bottom.band[0]).toBe(0);
  });
  it('null for an invalid reading or config', () => {
    expect(remaining(learned, nine, C, 1.2)).toBeNull();
    expect(remaining(learned, nine, C, null)).toBeNull();
    expect(remaining(learned, { type: 'segments', segments: 25 }, C, 0.5)).toBeNull();
    expect(remaining(learned, nine, 0, 0.5)).toBeNull();
  });
  it('ignores a grid from another config (falls back to linear)', () => {
    const r = remaining(learned, { type: 'needle8' }, C, 0.5)!;
    expect(r.liters).toBeCloseTo(22.5, 2);
  });
});
