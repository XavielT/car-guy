/** ADR-30: the trip's odometer suggestion. */
import { calibrationFactor, estimateOdometer } from '@/lib/trips/odometer';

it('corrects GPS by how it compared with the odometer, clamped to 0.9–1.1', () => {
  expect(calibrationFactor(1030, 1000)).toBeCloseTo(1.03, 5);
  expect(calibrationFactor(1500, 1000)).toBe(1.1);
  expect(calibrationFactor(500, 1000)).toBe(0.9);
});

it('no comparison yet (or too little GPS to compare) → 1', () => {
  expect(calibrationFactor(null, 900)).toBe(1);
  expect(calibrationFactor(300, 2)).toBe(1);
  expect(calibrationFactor(0, 100)).toBe(1);
});

it('last typed + GPS since × factor; nothing without a typed reading', () => {
  expect(estimateOdometer({ lastTypedKm: 101622, gpsSinceKm: 12.4, factor: 1.03 })).toBe(101635);
  expect(estimateOdometer({ lastTypedKm: null, gpsSinceKm: 12.4, factor: 1 })).toBeNull();
  expect(estimateOdometer({ lastTypedKm: 100, gpsSinceKm: -3, factor: 1 })).toBe(100);
});
