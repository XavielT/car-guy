/**
 * Carga parcial (IMP 29092026 note 4) — research 02 §1. The worked example of
 * §1.9 is the spec; its numbers are pinned to 2 decimals.
 */
import { computeEconomy } from '@/lib/domain/economy';
import { latestKnown, partialEconomy, type GaugeFillUp } from '@/lib/domain/partialEconomy';
import { GAL_L } from '@/lib/domain/units';

let n = 0;
const log = (o: Partial<GaugeFillUp> & { odometerKm: number; volume: number }): GaugeFillUp => ({
  id: `f${++n}`,
  vehicleId: 'v',
  occurredAt: `2026-09-${String(n).padStart(2, '0')}T12:00:00.000Z`,
  pricePerUnit: 80,
  totalDop: o.volume * 80,
  fuelType: 'regular',
  isFullTank: false,
  station: '',
  notes: '',
  createdAt: `2026-09-${String(n).padStart(2, '0')}T12:00:00.000Z`,
  ...o,
});

// §1.9: 45 L tank, reserve 5 L (±2.5), nonlinK = 0 for clean numbers. Liters in, km/L out.
const cfg = { capacityL: 45, reserveL: 5, unitL: 1, nonlinK: 0 };
const A = () => log({ odometerKm: 10000, volume: 34, isFullTank: true, gaugeBefore8: 2, gaugeAfter8: 8 });
const B = () => log({ odometerKm: 10300, volume: 13.5, gaugeBefore8: 3, gaugeAfter8: 6 });
const C = () => log({ odometerKm: 10650, volume: 39.5, isFullTank: true, inReserve: true, gaugeAfter8: 8 });

describe('§1.9 worked example', () => {
  it('before C exists: A→B is estimated, 10.67 km/L (9.68–11.87)', () => {
    const r = partialEconomy([A(), B()], cfg);
    expect(r.spans).toHaveLength(0);
    const [ab] = r.segments;
    expect(ab.status).toBe('estimated');
    expect(ab.kmPerUnit).toBeCloseTo(10.67, 2);
    expect(ab.kmPerUnitLow).toBeCloseTo(9.68, 2);
    expect(ab.kmPerUnitHigh).toBeCloseTo(11.87, 2);
    expect(ab.warnings).toBeUndefined();
    expect(r.average).toBeNull();
    expect(partialEconomy([A(), B()], cfg, { includeEstimates: true }).average).toBeCloseTo(10.67, 2);
  });

  it('after C: the span is measured 12.26 km/L and the parts are reconciled 11.05 and 13.54', () => {
    const r = partialEconomy([A(), B(), C()], cfg);
    expect(r.spans).toHaveLength(1);
    expect(r.spans[0].status).toBe('measured');
    expect(r.spans[0].kmPerUnit).toBeCloseTo(12.26, 2);
    expect(r.series.map((p) => p.status)).toEqual(['reconciled', 'reconciled']);
    expect(r.series[0].kmPerUnit).toBeCloseTo(11.05, 2);
    expect(r.series[1].kmPerUnit).toBeCloseTo(13.54, 2);
    // They add up to the measured 53.0 L.
    expect(r.series[0].volume + r.series[1].volume).toBeCloseTo(53.0, 2);
    expect(r.average).toBeCloseTo(12.26, 2);
  });

  it('B→C alone was 12.93 km/L (11.57–14.66) before reconciling', () => {
    // C not yet marked full: B→C is still an estimate.
    const r = partialEconomy([A(), B(), { ...C(), isFullTank: false }], cfg);
    const bc = r.segments[1];
    expect(bc.status).toBe('estimated');
    expect(bc.kmPerUnit).toBeCloseTo(12.93, 2);
    expect(bc.kmPerUnitLow).toBeCloseTo(11.57, 2);
    expect(bc.kmPerUnitHigh).toBeCloseTo(14.66, 2);
  });
});

describe('rules', () => {
  it('measured spans are exactly brim-to-brim (no gauge data → nothing else changes)', () => {
    const logs = [
      log({ odometerKm: 1000, volume: 10, isFullTank: true }),
      log({ odometerKm: 1200, volume: 3 }),
      log({ odometerKm: 1400, volume: 7, isFullTank: true }),
      log({ odometerKm: 1800, volume: 10.4, isFullTank: true }),
    ];
    const r = partialEconomy(logs, { capacityL: 45, unitL: GAL_L });
    expect(r.spans.map((p) => p.kmPerUnit)).toEqual(computeEconomy(logs).map((p) => p.kmPerUnit));
    // Without gauges the partial is unknown inside its span → the span itself is drawn.
    expect(r.series.map((p) => p.status)).toEqual(['measured', 'measured']);
  });

  it('F without the full toggle is 15/16 of the tank, not full', () => {
    const r = partialEconomy(
      [log({ odometerKm: 0, volume: 10, gaugeBefore8: 4, gaugeAfter8: 8 }), log({ odometerKm: 400, volume: 20, gaugeBefore8: 4 })],
      { ...cfg, reserveL: null },
    );
    // after(0) combines gauge 42.19 and pump 22.5+10 = 32.5 → between; fuel = after − 22.5.
    expect(r.segments[0].status).not.toBe('measured');
    expect(r.segments[0].warnings).toContain('gauge_pump_mismatch');
  });

  it('a forgotten fill-up breaks both chains', () => {
    const r = partialEconomy(
      [
        log({ odometerKm: 0, volume: 30, isFullTank: true }),
        log({ odometerKm: 300, volume: 10, gaugeBefore8: 2, gaugeAfter8: 4, missedPrevious: true }),
        log({ odometerKm: 600, volume: 30, isFullTank: true, gaugeBefore8: 1 }),
      ],
      cfg,
    );
    expect(r.segments[0]).toMatchObject({ status: 'unknown', reason: 'missed_fill' });
    expect(r.spans).toHaveLength(0);
  });

  it('a reserve reading is the reserve ± half', () => {
    const r = partialEconomy([A(), log({ odometerKm: 10400, volume: 38, inReserve: true })], cfg);
    // 45 − 5 = 40 L over 400 km.
    expect(r.segments[0]).toMatchObject({ status: 'estimated' });
    expect(r.segments[0].kmPerUnit).toBeCloseTo(10, 1);
  });

  it('too short a gauge move is unknown, with the reason', () => {
    const r = partialEconomy(
      [log({ odometerKm: 0, volume: 5, gaugeBefore8: 4, gaugeAfter8: 5 }), log({ odometerKm: 60, volume: 5, gaugeBefore8: 4 })],
      cfg,
    );
    expect(r.segments[0]).toMatchObject({ status: 'unknown', reason: 'too_uncertain' });
  });

  it('missing readings, a stuck odometer, no tank', () => {
    const noGauge = partialEconomy([log({ odometerKm: 0, volume: 5 }), log({ odometerKm: 100, volume: 5 })], cfg);
    expect(noGauge.segments[0].reason).toBe('missing_gauge');
    const stuck = partialEconomy([log({ odometerKm: 50, volume: 5, gaugeAfter8: 6 }), log({ odometerKm: 50, volume: 5, gaugeBefore8: 2 })], cfg);
    expect(stuck.segments[0].reason).toBe('odometer');
    const noTank = partialEconomy([log({ odometerKm: 0, volume: 5, gaugeAfter8: 6 }), log({ odometerKm: 300, volume: 5, gaugeBefore8: 2 })], { capacityL: null, unitL: 1 });
    expect(noTank.segments[0].reason).toBe('missing_gauge');
  });

  it('in gallons: the same car reads km/gal', () => {
    const inGal = [A(), B()].map((f) => ({ ...f, volume: f.volume / GAL_L }));
    const r = partialEconomy(inGal, { ...cfg, unitL: GAL_L });
    expect(r.segments[0].kmPerUnit).toBeCloseTo(40.4, 1);
  });

  it('latestKnown skips a trailing unknown', () => {
    const r = partialEconomy([A(), B(), log({ odometerKm: 10500, volume: 5 })], cfg);
    expect(latestKnown(r.series)?.status).toBe('estimated');
  });
});
