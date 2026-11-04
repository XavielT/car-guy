/**
 * PROMPT-10 / SPEC-I §I3, §I5: the SpeedEngine against the same ground-truth drives as the baseline, old vs new, case by case, with the
 * targets as assertions. Where a case misses, the assertion says by how much and why (it is a documented limit, not a loosened test).
 */
import { markdown, newPipeline, oldPipeline, table } from '../helpers/speed/replay';

const oldRows = Object.fromEntries(table(oldPipeline).map((r) => [r.id, r.m]));
const newRows = Object.fromEntries(table(newPipeline).map((r) => [r.id, r.m]));

describe('SpeedEngine on ground-truth drives', () => {
  it('prints old and new (the table in docs/imp-03112026/speed-before-after.md)', () => {
    // eslint-disable-next-line no-console
    console.log('\nOLD\n' + markdown(table(oldPipeline)) + '\n\nNEW\n' + markdown(table(newPipeline)));
    expect(Object.keys(newRows)).toHaveLength(10);
  });

  describe('targets (SPEC-I §I3) where the phone reports a Doppler speed', () => {
    it.each(['highway-1hz', 'highway-0.2hz', 'city-1hz', 'hard-brake', 'tunnel'])('%s: steady ≤ 1.5 km/h, accelerating ≤ 3, top ±2, distance ±1.5 %%', (id) => {
      const m = newRows[id];
      expect(m.rmseSteady!).toBeLessThanOrEqual(1.5);
      expect(m.rmseAccel!).toBeLessThanOrEqual(3);
      expect(m.topSavedErr).toBeLessThanOrEqual(2);
      expect(m.topLiveErr).toBeLessThanOrEqual(2);
      expect(m.distErrPct).toBeLessThanOrEqual(1.5);
    });
    it('a hard brake is followed within a fraction of a second (the old needle was ~1.9 s late)', () => {
      expect(newRows['hard-brake'].brakeLagS!).toBeLessThanOrEqual(0.5);
      expect(oldRows['hard-brake'].brakeLagS!).toBeGreaterThan(1);
    });
  });

  describe('the live max IS the saved max (I0: they were two different numbers)', () => {
    it('for every drive, to the last decimal', () => {
      for (const m of Object.values(newRows)) expect(m.liveSavedGap).toBe(0);
    });
  });

  describe('the cases that were broken', () => {
    it('Android "speed 0 while moving": distance 45 % off → under 5 %, steady error 12.7 → ≤ 3.5 km/h', () => {
      expect(oldRows['android-zero'].distErrPct).toBeGreaterThan(30);
      expect(newRows['android-zero'].distErrPct).toBeLessThan(5);
      expect(newRows['android-zero'].rmseSteady!).toBeLessThanOrEqual(3.5);
    });
    it('urban canyon: the live top speed no longer follows a position jump, and distance is not inflated', () => {
      expect(oldRows['city-canyon'].distErrPct).toBeGreaterThan(30);
      expect(newRows['city-canyon'].distErrPct).toBeLessThan(2);
      expect(newRows['city-canyon'].rmseSteady!).toBeLessThan(oldRows['city-canyon'].rmseSteady!);
    });
    it('no speed at all (web / iPhone −1): top speed and distance are better than before', () => {
      for (const id of ['ios-minus1', 'web-null', 'web-null-city']) {
        expect(newRows[id].topSavedErr).toBeLessThanOrEqual(oldRows[id].topSavedErr);
        expect(newRows[id].distErrPct).toBeLessThanOrEqual(oldRows[id].distErrPct + 0.01);
      }
      expect(newRows['web-null-city'].distErrPct).toBeLessThan(oldRows['web-null-city'].distErrPct);
    });
  });

  describe('honest limits, pinned so they cannot get worse unnoticed', () => {
    it('without a Doppler the steady error stays ≤ 3.5 km/h (the positions alone cannot do the 1.5 km/h target: their errors drift)', () => {
      for (const id of ['ios-minus1', 'web-null', 'web-null-city', 'android-zero']) expect(newRows[id].rmseSteady!).toBeLessThanOrEqual(3.5);
    });
    it('without a Doppler a CHANGE of speed is followed no better than before: accel/brake errors are 9–19 km/h in stop-and-go (this is the miss)', () => {
      // Recorded so the report can say which case misses and why: a position window cannot know the car has started moving until it has moved
      // farther than its own error circle. The old needle was faster on stops but stuck at ~10 km/h after them for 7 s.
      expect(newRows['web-null-city'].rmseBrake!).toBeLessThan(25);
      expect(newRows['web-null'].rmseAccel!).toBeLessThan(12);
    });
  });
});
