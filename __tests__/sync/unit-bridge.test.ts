/**
 * lib/sync/unitBridge.ts — liters on v6 devices, gallons for 2.1.x, both in the
 * cloud (02-cloud-v3.md "Sync protocol changes" 2; verify-sync 18–20 offline).
 */
import { GAL_L } from '@/lib/domain/units';
import { fromCloudUnits, toCloudUnits } from '@/lib/sync/unitBridge';
import { gateBySchema } from '@/lib/sync/merge';

const fuel = (extra: Record<string, unknown> = {}) => ({
  id: 'f1',
  fuel_type: 'premium',
  volume: 11.2 * GAL_L,
  price_per_unit: 322 / GAL_L,
  volume_entered: 11.2,
  volume_entered_unit: 'gal',
  ...extra,
});

describe('push', () => {
  it('writes liters and the legacy gallons, and stamps v6', () => {
    const up = toCloudUnits('fuel_log', fuel());
    expect(up.volume_l).toBeCloseTo(42.397, 3);
    expect(up.volume).toBeCloseTo(11.2, 6);
    expect(up.price_per_l).toBeCloseTo(85.063, 3);
    expect(up.price_per_unit).toBeCloseTo(322, 6);
    expect(up.schema_hint).toBe('v6');
  });

  it('GNV keeps m³ in the legacy columns and has no liters', () => {
    const up = toCloudUnits('fuel_log', { id: 'g', fuel_type: 'gnv', volume: 9.5, price_per_unit: 43.97 });
    expect(up.volume).toBe(9.5);
    expect(up.volume_l).toBeUndefined();
  });

  it('the tank; tables without the column get no hint', () => {
    const v = toCloudUnits('vehicle', { id: 'v', default_fuel_type: 'regular', tank_volume: 13.2 * GAL_L });
    expect(v.tank_l).toBeCloseTo(49.967, 3);
    expect(v.tank_volume).toBeCloseTo(13.2, 6);
    expect(toCloudUnits('expense', { id: 'e' })).toEqual({ id: 'e' });
    expect(toCloudUnits('trip', { id: 't' }).schema_hint).toBe('v6');
  });
});

describe('pull', () => {
  it('liters round-trip (verify-sync 19)', () => {
    const down = fromCloudUnits('fuel_log', toCloudUnits('fuel_log', fuel()));
    expect(down.volume).toBeCloseTo(11.2 * GAL_L, 5);
    expect(down.price_per_unit).toBeCloseTo(322 / GAL_L, 5);
    expect(down.volume_l).toBeUndefined();
    expect(down.volume_entered).toBe(11.2);
  });

  it('an old row (2.1.x, gallons only) is converted on the way in', () => {
    const down = fromCloudUnits('fuel_log', { id: 'old', fuel_type: 'regular', volume: 10, price_per_unit: 300 });
    expect(down.volume).toBeCloseTo(37.854, 3);
    expect(down.price_per_unit).toBeCloseTo(79.252, 3);
    expect(down).toMatchObject({ volume_entered: 10, volume_entered_unit: 'gal' });
  });

  it('a v6 row a 2.1.x device edited afterwards: its new gallons win over the stale liters', () => {
    const pushed = toCloudUnits('fuel_log', fuel());
    const editedBy213 = { ...pushed, volume: 12, price_per_unit: 322 };
    const down = fromCloudUnits('fuel_log', editedBy213);
    expect(down.volume).toBeCloseTo(12 * GAL_L, 5);
    expect(down.volume_entered).toBe(12);
  });

  it('a 2.1.3 client skips a hinted row (verify-sync 18)', () => {
    const { accepted, skipped } = gateBySchema([toCloudUnits('fuel_log', fuel()), { id: 'old' }], 'v5');
    expect(skipped.map((r) => r.id)).toEqual(['f1']);
    expect(accepted.map((r) => r.id)).toEqual(['old']);
  });
});
