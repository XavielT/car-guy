/** Note 8: a draft equal to a log saved < 60 s ago on the same car is the same fill-up. */
import { findRecentDuplicate } from '@/lib/domain/fillupDedupe';
import type { FillUp } from '@/lib/types';

const now = Date.parse('2026-09-30T15:00:30Z');
const saved: FillUp = {
  id: 'f1', vehicleId: 'ds3', occurredAt: '2026-09-30T15:00:00Z', odometerKm: 52_300, volume: 7.5, pricePerUnit: 272.5,
  totalDop: 2043.75, fuelType: 'regular', isFullTank: false, station: 'Petronan', notes: '', createdAt: '2026-09-30T15:00:05Z',
};
const draft = { vehicleId: 'ds3', occurredAt: '2026-09-30T15:00:40Z', odometerKm: 52_300, volume: 7.5, totalDop: 2043.75 };

it('the same fill-up tapped twice, or re-sent from the filled form, is found', () => {
  expect(findRecentDuplicate(draft, [saved], now)?.id).toBe('f1');
});

it('after 60 s it is a new fill-up', () => {
  expect(findRecentDuplicate(draft, [saved], Date.parse('2026-09-30T15:01:10Z'))).toBeNull();
});

it('another car, another odometer, another amount or another minute is not a duplicate', () => {
  expect(findRecentDuplicate({ ...draft, vehicleId: 'c3' }, [saved], now)).toBeNull();
  expect(findRecentDuplicate({ ...draft, odometerKm: 52_340 }, [saved], now)).toBeNull();
  expect(findRecentDuplicate({ ...draft, totalDop: 1000 }, [saved], now)).toBeNull();
  expect(findRecentDuplicate({ ...draft, volume: 3.7 }, [saved], now)).toBeNull();
  expect(findRecentDuplicate({ ...draft, occurredAt: '2026-09-30T14:40:00Z' }, [saved], now)).toBeNull();
});
