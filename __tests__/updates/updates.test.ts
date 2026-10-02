/** IMP 01102026 Phase 4: version compare for the APK prompt and the OTA gate's decision. */
import { compareVersions, isNewer, parseVersion } from '@/lib/updates/semver';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { decide } = require('../../tools/ota-gate.cjs') as {
  decide: (current: string | null, record: unknown) => { kind: 'ota' | 'apk'; reason: string };
};

describe('versions', () => {
  it('parses tags and app versions', () => {
    expect(parseVersion('v2.5.0')).toEqual([2, 5, 0]);
    expect(parseVersion('2.4')).toEqual([2, 4, 0]);
    expect(parseVersion('2.5.1-rc.1')).toEqual([2, 5, 1]);
    expect(parseVersion('nope')).toBeNull();
  });

  it('compares numerically, not as text', () => {
    expect(compareVersions('2.10.0', '2.9.9')).toBe(1);
    expect(compareVersions('2.4.3', '2.4.3')).toBe(0);
    expect(compareVersions('v2.4.2', '2.4.3')).toBe(-1);
  });

  it('prompts only for a strictly newer, known version', () => {
    expect(isNewer('2.5.0', '2.4.3')).toBe(true);
    expect(isNewer('2.4.3', '2.4.3')).toBe(false);
    expect(isNewer('2.4.2', '2.4.3')).toBe(false);
    expect(isNewer('2.5.0', null)).toBe(false);
    expect(isNewer(undefined, '2.4.3')).toBe(false);
  });
});

describe('the OTA gate', () => {
  const record = { version: '2.5.0', android: 'abc123' };
  it('same fingerprint as the released APK → OTA', () => {
    expect(decide('abc123', record)).toEqual({ kind: 'ota', reason: 'same runtime as 2.5.0' });
  });
  it('a native change → APK', () => {
    expect(decide('def456', record).kind).toBe('apk');
    expect(decide('def456', record).reason).toMatch(/native changed since 2.5.0/);
  });
  it('no record yet (first release with expo-updates) or no fingerprint → APK', () => {
    expect(decide('abc123', null).kind).toBe('apk');
    expect(decide('abc123', { version: '2.4.3' }).kind).toBe('apk');
    expect(decide(null, record).kind).toBe('apk');
  });
});
