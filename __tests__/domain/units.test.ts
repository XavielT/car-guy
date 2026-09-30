/** lib/domain/units.ts — the one place the gallon factor lives (ADR-33). */
import {
  economyFromKmPerLiter,
  economyUnitLabel,
  fromLiters,
  fuelForDisplay,
  fuelForStorage,
  GAL_L,
  higherIsBetter,
  priceFromPerLiter,
  pricePerLiter,
  tankForDisplay,
  tankForStorage,
  toLiters,
} from '@/lib/domain/units';

describe('the factor', () => {
  it('is the exact US gallon', () => {
    expect(GAL_L).toBe(3.785411784);
    expect(toLiters(1, 'gal')).toBe(3.785412);
    expect(fromLiters(3.785411784, 'gal')).toBe(1);
  });

  it('round-trips gallons with no drift a screen could show', () => {
    for (const g of [0.5, 4.2, 10.4, 11.2, 11.37, 12.004, 13.2, 25]) {
      expect(Math.round(fromLiters(toLiters(g, 'gal'), 'gal') * 1000) / 1000).toBe(g);
    }
  });

  it('liters pass through; prices divide where volumes multiply', () => {
    expect(toLiters(40, 'l')).toBe(40);
    expect(pricePerLiter(322, 'gal')).toBeCloseTo(85.063, 3);
    expect(Math.round(priceFromPerLiter(pricePerLiter(322, 'gal'), 'gal') * 100) / 100).toBe(322);
  });
});

describe('economy', () => {
  it('km/L → km/gal, km/L, L/100 km', () => {
    expect(economyFromKmPerLiter(10, 'km_gal')).toBeCloseTo(37.854, 3);
    expect(economyFromKmPerLiter(10, 'km_l')).toBe(10);
    expect(economyFromKmPerLiter(10, 'l_100km')).toBe(10);
    expect(economyFromKmPerLiter(12.5, 'l_100km')).toBe(8);
    expect(economyFromKmPerLiter(0, 'l_100km')).toBe(0);
  });

  it('L/100 km inverts "better"', () => {
    expect(higherIsBetter('km_gal')).toBe(true);
    expect(higherIsBetter('l_100km')).toBe(false);
  });

  it('labels, with GNV always km/m³', () => {
    expect(economyUnitLabel('premium', 'km_gal')).toBe('km/gal');
    expect(economyUnitLabel('premium', 'km_l')).toBe('km/L');
    expect(economyUnitLabel('premium', 'l_100km')).toBe('L/100 km');
    expect(economyUnitLabel('gnv', 'km_l')).toBe('km/m³');
  });
});

describe("the store's boundary", () => {
  it('a gallons fill-up is stored in liters and shown back exactly as typed', () => {
    const stored = fuelForStorage({ volume: 11.2, pricePerUnit: 322, fuelType: 'premium' }, 'gal');
    expect(stored.volume).toBeCloseTo(42.397, 3);
    expect(stored.volumeEntered).toBe(11.2);
    expect(stored.volumeEnteredUnit).toBe('gal');
    expect(fuelForDisplay({ ...stored, fuelType: 'premium' }, 'gal')).toEqual({ volume: 11.2, pricePerUnit: 322 });
  });

  it('shown in the other unit it converts', () => {
    const stored = fuelForStorage({ volume: 40, pricePerUnit: 80, fuelType: 'regular' }, 'l');
    expect(fuelForDisplay({ ...stored, fuelType: 'regular' }, 'gal')).toEqual({ volume: 10.567, pricePerUnit: 302.83 });
  });

  it('GNV stays m³ both ways', () => {
    const stored = fuelForStorage({ volume: 9.5, pricePerUnit: 43.97, fuelType: 'gnv' }, 'gal');
    expect(stored).toEqual({ volume: 9.5, pricePerUnit: 43.97, volumeEntered: 9.5, volumeEnteredUnit: 'm3' });
    expect(fuelForDisplay({ ...stored, fuelType: 'gnv' }, 'l')).toEqual({ volume: 9.5, pricePerUnit: 43.97 });
  });

  it('the tank', () => {
    const t = tankForStorage(13.2, 'gal', 'premium');
    expect(tankForDisplay(t.tankVolume, t.tankVolumeEntered, 'gal', 'premium')).toBe(13.2);
    expect(tankForDisplay(t.tankVolume, t.tankVolumeEntered, 'l', 'premium')).toBe(49.967);
    expect(tankForStorage(null, 'gal', 'premium')).toEqual({ tankVolume: null, tankVolumeEntered: null });
  });
});

describe('L/100 km on screen (2.2.3)', () => {
  const { kmPerUnit, economyValue } = jest.requireActual('@/lib/format') as typeof import('@/lib/format');
  it('20 km/gal is 18.9 L/100 km; 12.5 km/L is 8 L/100 km', () => {
    expect(economyValue(20, 'gal', 'l_100km')).toBeCloseTo(18.93, 2);
    expect(economyValue(12.5, 'l', 'l_100km')).toBeCloseTo(8, 5);
    expect(kmPerUnit(12.5, 'regular', 'l', 'l_100km')).toBe('8.0 L/100 km');
  });
  it('km/gal and km/L pass through unchanged; GNV never inverts', () => {
    expect(economyValue(20, 'gal', 'km_gal')).toBe(20);
    expect(kmPerUnit(20, 'regular', 'gal')).toMatch(/km\/gal/);
    expect(kmPerUnit(20, 'gnv', 'gal', 'l_100km')).not.toMatch(/L\/100/);
  });
});
