/** Phase 0's Redmi: Automático chosen, no permission, nothing said. Now the first blocker is named. */
import { agoShort, autoBlocker, lastFixTime } from '../../lib/trips/autoStatus';

const ok = { mode: 'auto' as const, readiness: 'ready' as const, autostart: 'enabled' as const, battery: 'unrestricted' as const };

it("the Redmi of Phase 0: Automático with no location permission → 'foreground'", () => {
  expect(autoBlocker({ ...ok, readiness: 'foreground', autostart: 'disabled', battery: 'optimized' })).toBe('foreground');
});
it('permission order: background, approximate, unavailable come before MIUI and battery', () => {
  expect(autoBlocker({ ...ok, readiness: 'background', autostart: 'disabled' })).toBe('background');
  expect(autoBlocker({ ...ok, readiness: 'approximate' })).toBe('approximate');
  expect(autoBlocker({ ...ok, readiness: 'unavailable' })).toBe('unavailable');
});
it('with the permission: MIUI autostart, then battery', () => {
  expect(autoBlocker({ ...ok, autostart: 'disabled', battery: 'optimized' })).toBe('autostart');
  expect(autoBlocker({ ...ok, battery: 'optimized' })).toBe('battery');
});
it('nothing to say: all green, unknown states, manual/off mode, the web, not read yet', () => {
  expect(autoBlocker(ok)).toBeNull();
  expect(autoBlocker({ ...ok, autostart: 'unknown', battery: 'unknown' })).toBeNull();
  expect(autoBlocker({ ...ok, mode: 'manual', readiness: 'foreground' })).toBeNull();
  expect(autoBlocker({ ...ok, readiness: 'web' })).toBeNull();
  expect(autoBlocker({ ...ok, readiness: null })).toBeNull();
});
it('agoShort and lastFixTime', () => {
  expect([agoShort(12_000), agoShort(300_000), agoShort(3 * 3_600_000), agoShort(3 * 86_400_000)]).toEqual(['12 s', '5 min', '3 h', '3 d']);
  expect(lastFixTime(null)).toBeNull();
  expect(lastFixTime({ recent: [{ t: 5 }], trip: null })).toBe(5);
  expect(lastFixTime({ recent: [{ t: 5 }], trip: { last: { t: 9 } } })).toBe(9);
  expect(lastFixTime({ recent: [], trip: { last: null } })).toBeNull();
});
