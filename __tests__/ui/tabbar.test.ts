/**
 * The tab bar with the CONDUCIR disc (IMP 30092026 Phase 4, ADR-43): slot order,
 * the disc's recording state, and Cifras gone from the bar (audit (j)).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { CENTRE, centreState, tabSlots } from '../../components/tabbar/state';

describe('tabSlots', () => {
  it('puts the disc in the middle: Inicio · Garaje · ● · Historial · Más', () => {
    expect(tabSlots(['index', 'garaje', 'historial', 'mas'])).toEqual(['index', 'garaje', CENTRE, 'historial', 'mas']);
  });
  it('an odd count keeps the extra tab on the left', () => {
    expect(tabSlots(['a', 'b', 'c'])).toEqual(['a', 'b', CENTRE, 'c']);
  });
  it('no tabs → only the disc', () => {
    expect(tabSlots([])).toEqual([CENTRE]);
  });
});

describe('centreState', () => {
  it('idle: no ring, no REC, the plain label', () => {
    expect(centreState(false, false)).toEqual({ recording: false, ring: 'none', showRec: false, labelKey: 'open' });
    expect(centreState(false, true).ring).toBe('none');
  });
  it('recording: the amber ring pulses and REC shows', () => {
    expect(centreState(true, false)).toEqual({ recording: true, ring: 'pulse', showRec: true, labelKey: 'openRecording' });
  });
  it('recording under reduced motion: the ring stays, static', () => {
    expect(centreState(true, true)).toMatchObject({ ring: 'static', showRec: true });
  });
  it('the loop ends with the trip', () => {
    const during = centreState(true, false);
    const after = centreState(false, false);
    expect(during.ring).toBe('pulse');
    expect(after.ring).toBe('none');
  });
});

describe('Cifras left the tab bar', () => {
  const files = execSync(
    "git ls-files --cached --others --exclude-standard 'app/**/*.ts' 'app/**/*.tsx' 'app/*.tsx' 'components/**/*.tsx' 'components/**/*.ts' 'lib/**/*.ts' 'lib/**/*.tsx' 'hooks/**/*.ts'",
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter((f) => f && existsSync(f));

  it('no push, replace or Link to /(tabs)/cifras remains', () => {
    const hits = files.filter((f) => readFileSync(f, 'utf8').includes('(tabs)/cifras'));
    expect(hits).toEqual([]);
  });
  it('the route is a stack screen now', () => {
    expect(existsSync('app/cifras.tsx')).toBe(true);
    expect(existsSync('app/(tabs)/cifras.tsx')).toBe(false);
    expect(readFileSync('app/(tabs)/_layout.tsx', 'utf8')).not.toMatch(/name="cifras"/);
    expect(readFileSync('app/_layout.tsx', 'utf8')).toMatch(/name="cifras"/);
  });
});
