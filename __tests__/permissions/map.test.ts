/**
 * The registry's state mapping (IMP 16102026 ADR-59, SPEC-A "Pruebas"): what each system answer means, by platform,
 * and why a geolocation error is not always "denied" (M-5).
 */
import { canAskInApp, fromBattery, fromResponse, fromWebQuery, geoErrorKind, isMissing, needsSettings, withLocationDetail } from '../../lib/permissions/map';

describe('fromResponse', () => {
  it('granted is granted, on any platform', () => {
    expect(fromResponse({ granted: true, status: 'granted' }, 'native')).toEqual({ status: 'granted' });
    expect(fromResponse({ granted: true, status: 'granted' }, 'web')).toEqual({ status: 'granted' });
  });

  it('never asked is undetermined — not a refusal (M-1)', () => {
    expect(fromResponse({ granted: false, status: 'undetermined', canAskAgain: true }, 'native')).toEqual({ status: 'undetermined' });
    expect(fromResponse({ granted: false, status: 'undetermined', canAskAgain: true }, 'web')).toEqual({ status: 'undetermined' });
  });

  it('Android: a refusal that can be asked again vs one that only the settings can change', () => {
    expect(fromResponse({ granted: false, status: 'denied', canAskAgain: true }, 'native')).toEqual({ status: 'denied_can_ask' });
    expect(fromResponse({ granted: false, status: 'denied', canAskAgain: false }, 'native')).toEqual({ status: 'denied_blocked' });
  });

  it('web: every refusal is blocked, even though the expo-location shim says canAskAgain (M-6)', () => {
    expect(fromResponse({ granted: false, status: 'denied', canAskAgain: true }, 'web')).toEqual({ status: 'denied_blocked' });
  });

  it('the web shim answers {status: granted, granted: false} to a position error: the permission is there', () => {
    expect(fromResponse({ granted: false, status: 'granted', canAskAgain: true }, 'web')).toEqual({ status: 'granted' });
  });

  it('an answer it does not understand is unknown, not a guess', () => {
    expect(fromResponse({}, 'native')).toEqual({ status: 'unknown' });
  });
});

describe('fromWebQuery (navigator.permissions.query)', () => {
  it('maps the three states and a missing API', () => {
    expect(fromWebQuery('granted').status).toBe('granted');
    expect(fromWebQuery('prompt').status).toBe('undetermined');
    expect(fromWebQuery('denied').status).toBe('denied_blocked');
    expect(fromWebQuery(undefined).status).toBe('unknown');
  });
});

describe('withLocationDetail', () => {
  const granted = { status: 'granted' as const };
  it('granted but the phone\'s location services are off → services_off (a phone state, not the app\'s permission)', () => {
    expect(withLocationDetail(granted, { android: { accuracy: 'fine' } }, false)).toEqual({ status: 'services_off' });
  });
  it('Android 12+ coarse-only is granted with the detail', () => {
    expect(withLocationDetail(granted, { android: { accuracy: 'coarse' } }, true)).toEqual({ status: 'granted', detail: 'approximate' });
  });
  it('a missing permission is left as it is', () => {
    expect(withLocationDetail({ status: 'undetermined' }, null, false)).toEqual({ status: 'undetermined' });
  });
});

describe('fromBattery', () => {
  it('unrestricted / optimized / the phone does not say', () => {
    expect(fromBattery('unrestricted').status).toBe('granted');
    expect(fromBattery('optimized').status).toBe('denied_can_ask');
    expect(fromBattery('unknown').status).toBe('unknown');
  });
});

describe('geoErrorKind — the codes of a failed position', () => {
  it('numeric codes 1 / 2 / 3', () => {
    expect([1, 2, 3].map((c) => geoErrorKind(c))).toEqual(['denied', 'unavailable', 'timeout']);
    expect(geoErrorKind({ code: 1, message: 'User denied Geolocation' })).toBe('denied');
    expect(geoErrorKind({ code: 3 })).toBe('timeout');
  });
  it('the web shim hands only a string: its message, or "geolocation error N"', () => {
    expect(geoErrorKind('User denied Geolocation')).toBe('denied');
    expect(geoErrorKind('Timeout expired')).toBe('timeout');
    expect(geoErrorKind('Position update is unavailable')).toBe('unavailable');
    expect(geoErrorKind('geolocation error 2')).toBe('unavailable');
    expect(geoErrorKind('geolocation error 3')).toBe('timeout');
  });
  it('something else is unknown', () => {
    expect(geoErrorKind('boom')).toBe('unknown');
    expect(geoErrorKind(undefined)).toBe('unknown');
  });
});

describe('predicates', () => {
  it('can ask in the app / needs the settings / is missing', () => {
    expect(['undetermined', 'denied_can_ask'].every((s) => canAskInApp(s as never))).toBe(true);
    expect(['denied_blocked', 'services_off'].every((s) => needsSettings(s as never))).toBe(true);
    expect(isMissing('granted')).toBe(false);
    expect(isMissing('unavailable')).toBe(false);
    expect(isMissing('unknown')).toBe(false);
    expect(isMissing('denied_blocked')).toBe(true);
    expect(isMissing('undetermined')).toBe(true);
  });
});
