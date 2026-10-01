/**
 * IMP 01102026 Phase 3: the gauge of one car end to end — observations from fill-ups (old-grid readings at
 * half weight), the stored calibration, partial economy on fractions + the learned grid, and the tank now.
 */
import { calibrateVehicle, formatFrac, gaugeCfgOf, observationsOf, stepForLiters, tankNow, type CalibrationLog } from '@/lib/domain/gaugeVehicle';
import { parseCalibration } from '@/lib/domain/gaugeCalibration';
import { fuelCfgFor, partialEconomy } from '@/lib/domain/partialEconomy';
import type { FillUp } from '@/lib/types';

const DS3 = { gaugeType: 'segments' as const, gaugeSegments: 9, gaugeReserveAt: null, tankVolume: 45, reserveVolumeL: null, defaultFuelType: 'regular', volumeUnit: 'l' as const };

/** Research 03 §3.4: three fulls and one partial on 9 squares. */
const EXAMPLE: CalibrationLog[] = [
  { occurredAt: '2026-06-01T10:00:00Z', volume: 28, isFullTank: true, gaugeBeforeFrac: 3 / 9, gaugeBeforeRaw: '3/9' },
  { occurredAt: '2026-07-01T10:00:00Z', volume: 19, isFullTank: true, gaugeBeforeFrac: 5 / 9, gaugeBeforeRaw: '5/9' },
  { occurredAt: '2026-08-01T10:00:00Z', volume: 18, isFullTank: false, gaugeBeforeFrac: 2 / 9, gaugeAfterFrac: 6 / 9, gaugeBeforeRaw: '2/9' },
  { occurredAt: '2026-09-01T10:00:00Z', volume: 36, isFullTank: true, gaugeBeforeFrac: 1 / 9, gaugeBeforeRaw: '1/9' },
];

let n = 0;
function fill(over: Partial<FillUp>): FillUp {
  n += 1;
  return {
    id: `f${n}`,
    vehicleId: 'v',
    occurredAt: '2026-09-01T10:00:00.000Z',
    odometerKm: 1000,
    volume: 30,
    pricePerUnit: 80,
    totalDop: 2400,
    fuelType: 'regular',
    isFullTank: true,
    station: '',
    notes: '',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...over,
  };
}

describe('config and observations', () => {
  it('reads the car\'s gauge, and falls back to the needle on a bad row', () => {
    expect(gaugeCfgOf(DS3)).toEqual({ type: 'segments', segments: 9, reserveAt: null });
    expect(gaugeCfgOf({ gaugeType: 'segments', gaugeSegments: 40 })).toEqual({ type: 'needle8' });
    expect(gaugeCfgOf(null)).toEqual({ type: 'needle8' });
  });

  it('a reading taken on another grid counts half; one on this grid, whole', () => {
    const obs = observationsOf(
      [
        { occurredAt: 'a', volume: 20, isFullTank: true, gaugeBeforeFrac: 3 / 8, gaugeBeforeRaw: '3/8' },
        { occurredAt: 'b', volume: 20, isFullTank: true, gaugeBeforeEighths: 2 },
        { occurredAt: 'c', volume: 20, isFullTank: true, gaugeBeforeFrac: 4 / 9, gaugeBeforeRaw: '4/9' },
      ],
      gaugeCfgOf(DS3),
    );
    expect(obs.map((o) => o.weight)).toEqual([0.5, 0.5, 1]);
    expect(obs[1].fracBefore).toBe(0.25);
  });

  it('formats and inverts readings on the car\'s grid', () => {
    expect(formatFrac(4 / 9, gaugeCfgOf(DS3))).toBe('4/9');
    expect(formatFrac(0.45, { type: 'percent' })).toBe('45 %');
    expect(stepForLiters(20, gaugeCfgOf(DS3), 45, null)).toBe(4);
  });
});

describe('calibrateVehicle', () => {
  it('learns the research example (45 L, 9 squares): aprendido, f(4) ≈ 21 L', () => {
    const cal = calibrateVehicle(DS3, EXAMPLE)!;
    expect(cal.status).toBe('aprendido');
    expect(cal.n_full).toBe(3);
    expect(cal.n_partial).toBe(1);
    expect(cal.grid[4]).toBeCloseTo(21.0, 1);
    expect(cal.grid[9]).toBe(45);
  });

  it('none for GNV or a car without a tank', () => {
    expect(calibrateVehicle({ ...DS3, defaultFuelType: 'gnv' }, EXAMPLE)).toBeNull();
    expect(calibrateVehicle({ ...DS3, tankVolume: null }, EXAMPLE)).toBeNull();
  });

  it('a reset ignores the fills before it and is carried over by the next recompute', () => {
    const reset = calibrateVehicle(DS3, EXAMPLE, { resetAt: '2026-08-15T00:00:00Z' })!;
    expect(reset.status).toBe('parcial');
    expect(reset.reset_at).toBe('2026-08-15T00:00:00Z');
    const again = calibrateVehicle({ ...DS3, gaugeCalibration: JSON.stringify(reset) }, EXAMPLE)!;
    expect(again.reset_at).toBe('2026-08-15T00:00:00Z');
    expect(again.n_full).toBe(1);
  });

  it('parseCalibration refuses garbage and keeps a bare reset marker', () => {
    expect(parseCalibration('nope')).toBeNull();
    expect(parseCalibration('{"x":1}')).toBeNull();
    expect(parseCalibration('{"reset_at":"2026-09-01"}')?.reset_at).toBe('2026-09-01');
  });
});

describe('partial economy on fractions', () => {
  const needleLogs = [
    fill({ occurredAt: '2026-09-01T00:00:00Z', odometerKm: 1000, isFullTank: true }),
    fill({ occurredAt: '2026-09-05T00:00:00Z', odometerKm: 1300, isFullTank: false, volume: 10, gaugeBefore8: 4, gaugeAfter8: 6 }),
    fill({ occurredAt: '2026-09-09T00:00:00Z', odometerKm: 1600, isFullTank: true, volume: 25, gaugeBefore8: 2 }),
  ];

  it('a needle car gives the same numbers from eighths, from fractions, and with the gauge named', () => {
    const base = { capacityL: 45, unitL: 1 };
    const a = partialEconomy(needleLogs, base);
    const b = partialEconomy(
      needleLogs.map((f) => ({ ...f, gaugeBeforeFrac: f.gaugeBefore8 != null ? f.gaugeBefore8 / 8 : null, gaugeAfterFrac: f.gaugeAfter8 != null ? f.gaugeAfter8 / 8 : null })),
      { ...base, gauge: { type: 'needle8' } },
    );
    expect(b.series).toEqual(a.series);
    expect(b.average).toBe(a.average);
  });

  it('squares read as squares: 4/9 is 20 L on a linear 45 L map, not 22.5 (4/8)', () => {
    const logs = [
      fill({ occurredAt: '2026-09-01T00:00:00Z', odometerKm: 1000, isFullTank: true }),
      fill({ occurredAt: '2026-09-05T00:00:00Z', odometerKm: 1350, isFullTank: false, volume: 10, gaugeBeforeFrac: 4 / 9, gaugeAfterFrac: 6 / 9 }),
    ];
    const seg = partialEconomy(logs, { capacityL: 45, unitL: 1, gauge: { type: 'segments', segments: 9 } }).segments[0];
    expect(seg.status).toBe('estimated');
    // consumed = 45 − 20 = 25 L over 350 km
    expect(seg.kmPerUnit).toBeCloseTo(14, 1);
  });

  it('a learned grid replaces the linear map when its status is not linear', () => {
    const cal = calibrateVehicle(DS3, EXAMPLE)!;
    const cfg = fuelCfgFor({ ...DS3, gaugeCalibration: JSON.stringify(cal) });
    expect(cfg.calibration?.status).toBe('aprendido');
    const logs = [
      fill({ occurredAt: '2026-09-01T00:00:00Z', odometerKm: 1000, isFullTank: true }),
      fill({ occurredAt: '2026-09-05T00:00:00Z', odometerKm: 1350, isFullTank: false, volume: 10, gaugeBeforeFrac: 4 / 9, gaugeAfterFrac: 6 / 9 }),
    ];
    const seg = partialEconomy(logs, cfg).segments[0];
    expect(seg.kmPerUnit).toBeCloseTo(350 / (45 - cal.grid[4]), 1);
  });
});

describe('tankNow', () => {
  const now = new Date('2026-09-20T12:00:00Z');
  const history = [
    fill({ occurredAt: '2026-08-01T00:00:00Z', odometerKm: 1000, isFullTank: true, volume: 30 }),
    fill({ occurredAt: '2026-08-15T00:00:00Z', odometerKm: 1600, isFullTank: true, volume: 34 }),
    fill({ occurredAt: '2026-09-01T00:00:00Z', odometerKm: 2020, isFullTank: true, volume: 24 }),
    fill({ occurredAt: '2026-09-18T00:00:00Z', odometerKm: 2530, isFullTank: true, volume: 29 }),
  ];

  it('a full tank minus the km since, at the recent km/L, with a band', () => {
    const tank = tankNow(DS3, history, 2706, now)!;
    // 17.59 km/L over the last three spans; 176 km ≈ 10 L gone from 45
    expect(tank.liters).toBe(35);
    expect(tank.band[0]).toBeLessThan(35);
    expect(tank.band[1]).toBeGreaterThan(35);
    expect(tank.km).toBe(620);
    expect(tank.stepNow).toBe(7);
    expect(tank.telltale).toBe('off');
    expect(tank.fromRaw).toBe('F');
  });

  it('amber at two squares or less, red when the estimate is at the reserve', () => {
    expect(tankNow(DS3, history, 2530 + 600, now)!.telltale).toBe('amber');
    expect(tankNow(DS3, history, 2530 + 720, now)!.telltale).toBe('red');
  });

  it('nothing after 30 days, nothing when the estimate runs out, nothing without a tank', () => {
    expect(tankNow(DS3, history, 2600, new Date('2026-11-01T00:00:00Z'))).toBeNull();
    expect(tankNow(DS3, history, 2530 + 2000, now)).toBeNull();
    expect(tankNow({ ...DS3, tankVolume: null }, history, 2600, now)).toBeNull();
  });

  it('a partial with an after reading starts from that reading', () => {
    const tank = tankNow(DS3, [...history, fill({ occurredAt: '2026-09-19T00:00:00Z', odometerKm: 2600, isFullTank: false, volume: 10, gaugeBeforeFrac: 2 / 9, gaugeAfterFrac: 4 / 9, gaugeAfterRaw: '4/9' })], 2600, now)!;
    expect(tank.fromRaw).toBe('4/9');
    expect(tank.liters).toBe(20);
  });
});
