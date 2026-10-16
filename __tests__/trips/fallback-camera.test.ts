/**
 * Where the drive-mode map looks while it does not know where you are (IMP 16102026 M-7, ADR-64): the last position
 * (with how old), else the middle of the recent trips, else Santo Domingo — never a corner, never a black box.
 */
import { fallbackCamera, SANTO_DOMINGO } from '../../lib/map/fallbackCamera';
import { __resetLastFixThrottle, parseLastFix, saveLastFix } from '../../lib/map/lastFix';

jest.mock('../../lib/db/repos', () => ({ settings: { set: jest.fn(async () => {}), get: jest.fn() } }));
const settings = (jest.requireMock('../../lib/db/repos') as { settings: { set: jest.Mock } }).settings;

const NOW = 1_790_000_000_000;

describe('fallbackCamera', () => {
  it('the last position wins, with its age for "hace X"', () => {
    const c = fallbackCamera({ lastFix: { lat: 18.5, lng: -70.1, t: NOW - 3 * 3_600_000 }, tripPoints: [{ lat: 19, lng: -70 }], now: NOW });
    expect(c).toMatchObject({ lat: 18.5, lng: -70.1, source: 'last_fix', ageMs: 3 * 3_600_000 });
  });

  it('without it, the middle of the recent trips (the median: one far trip does not drag it into the sea)', () => {
    const c = fallbackCamera({
      lastFix: null,
      tripPoints: [
        { lat: 18.48, lng: -69.93 },
        { lat: 18.5, lng: -69.9 },
        { lat: 18.49, lng: -69.95 },
        { lat: 19.8, lng: -70.7 },
      ],
      now: NOW,
    });
    expect(c.source).toBe('trips');
    expect(c.lat).toBeCloseTo(18.495, 3);
    expect(c.lng).toBeCloseTo(-69.94, 3);
  });

  it('with nothing: Santo Domingo, city zoom', () => {
    expect(fallbackCamera({ lastFix: null, tripPoints: [], now: NOW })).toEqual({ ...SANTO_DOMINGO, zoom: 12, source: 'default', ageMs: null });
    expect(SANTO_DOMINGO).toEqual({ lat: 18.4861, lng: -69.9312 });
  });

  it('ignores a corrupt saved position and trips without coordinates', () => {
    expect(fallbackCamera({ lastFix: { lat: NaN, lng: 0, t: NOW }, tripPoints: [{ lat: 200, lng: 0 }], now: NOW }).source).toBe('default');
  });
});

describe('last_fix', () => {
  beforeEach(() => {
    __resetLastFixThrottle();
    settings.set.mockClear();
  });

  it('is saved at most every 30 s (a fix arrives every second)', () => {
    saveLastFix({ lat: 18.4, lng: -69.9 }, NOW, NOW);
    saveLastFix({ lat: 18.5, lng: -69.9 }, NOW + 1000, NOW + 1000);
    expect(settings.set).toHaveBeenCalledTimes(1);
    saveLastFix({ lat: 18.6, lng: -69.9 }, NOW + 31_000, NOW + 31_000);
    expect(settings.set).toHaveBeenCalledTimes(2);
    expect(settings.set).toHaveBeenLastCalledWith('last_fix', { lat: 18.6, lng: -69.9, t: NOW + 31_000 });
  });

  it('parseLastFix accepts a good one and rejects the rest', () => {
    expect(parseLastFix({ lat: 18.4, lng: -69.9, t: 1 })).toEqual({ lat: 18.4, lng: -69.9, t: 1 });
    expect(parseLastFix(null)).toBeNull();
    expect(parseLastFix({ lat: 'x', lng: 1, t: 1 })).toBeNull();
    expect(parseLastFix({ lat: 95, lng: 1, t: 1 })).toBeNull();
  });
});
