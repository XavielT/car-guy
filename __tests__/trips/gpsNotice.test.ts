/**
 * What Modo conducir says about the position (IMP 16102026 M-1, M-2, M-4, M-5). The iPhone screenshot of
 * 2026-10-16 — "Sin permiso de ubicación" — was a permission nobody had ever asked for.
 */
import { gpsNotice, mapPosition } from '../../lib/trips/gpsNotice';
import type { MyPosition } from '../../lib/trips/myPosition';

const NOW = 1_790_000_000_000;
const fix = (ageS: number, acc = 8) => ({ lat: 18.4861, lng: -69.9312, acc, heading: 90, t: NOW - ageS * 1000 });
const pos = (over: Partial<MyPosition>): MyPosition => ({ status: 'searching', permission: 'granted', error: null, fix: null, approx: null, ...over });

describe('gpsNotice', () => {
  it('idle: nothing', () => expect(gpsNotice(pos({ status: 'idle', permission: null }), NOW)).toBeNull());

  it.each(['undetermined', 'denied_can_ask', 'denied_blocked', 'services_off', 'unavailable'] as const)(
    'permission %s → the registry chip, never "sin permiso" text',
    (status) => {
      expect(gpsNotice(pos({ status: 'denied', permission: status }), NOW)).toEqual({ kind: 'permission', status });
    },
  );

  it('"unknown" (the browser cannot say) lets the watch try and speaks only if it fails', () => {
    expect(gpsNotice(pos({ permission: 'unknown' }), NOW)).toEqual({ kind: 'searching' });
  });

  it('permission fine but the read failed → why, with "Reintentar", not "Buscando GPS…" forever (M-5)', () => {
    expect(gpsNotice(pos({ status: 'error', error: 'timeout' }), NOW)).toEqual({ kind: 'error', reason: 'timeout' });
    expect(gpsNotice(pos({ status: 'error', error: 'unavailable' }), NOW)).toEqual({ kind: 'error', reason: 'unavailable' });
    expect(gpsNotice(pos({ status: 'error' }), NOW)).toEqual({ kind: 'error', reason: 'unknown' });
  });

  it('only a coarse fix → approximate, with its accuracy (M-4)', () => {
    expect(gpsNotice(pos({ approx: fix(1, 420) }), NOW)).toEqual({ kind: 'approx', acc: 420 });
  });

  it('nothing yet → searching', () => expect(gpsNotice(pos({}), NOW)).toEqual({ kind: 'searching' }));

  it('a fresh fix → silence; an old one → how old', () => {
    expect(gpsNotice(pos({ status: 'ok', fix: fix(2) }), NOW)).toBeNull();
    expect(gpsNotice(pos({ status: 'ok', fix: fix(40) }), NOW)).toEqual({ kind: 'stale', ageMs: 40_000 });
  });
});

describe('mapPosition', () => {
  it('the precise fix is the dot, with its heading', () => {
    expect(mapPosition(pos({ status: 'ok', fix: fix(2) }), NOW)).toMatchObject({ fresh: true, approx: false, heading: 90 });
  });

  it('without one, the approximate fix is drawn (greyed, no heading) so the map is not stuck on its default (M-4)', () => {
    expect(mapPosition(pos({ approx: fix(1, 420) }), NOW)).toMatchObject({ fresh: false, approx: true, heading: null });
  });

  it('nothing → null', () => expect(mapPosition(pos({}), NOW)).toBeNull());
});
