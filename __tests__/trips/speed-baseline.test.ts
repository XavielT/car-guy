/**
 * The "before" numbers of PROMPT-10 (SPEC-I §I3): the OLD pipeline (helpers/speed/legacy.ts keeps its code verbatim) on synthetic drives with
 * ground truth. It asserts the facts that motivated the work (I0): the live max and the saved max are two different numbers, an Android
 * "speed 0 while moving" trip loses almost half its distance, and an urban canyon inflates the live top speed by tens of km/h.
 */
import { markdown, oldPipeline, table } from '../helpers/speed/replay';

describe('old pipeline on ground-truth drives (baseline)', () => {
  const rows = table(oldPipeline);
  const by = Object.fromEntries(rows.map((r) => [r.id, r.m]));
  it('prints the table', () => {
    // eslint-disable-next-line no-console
    console.log('\nOLD PIPELINE\n' + markdown(rows));
    expect(rows).toHaveLength(10);
  });
  it('I0 confirmed: live max and saved max are two different numbers for the same trip', () => {
    expect(by['city-canyon'].liveSavedGap).toBeGreaterThan(20);
    expect(by['android-zero'].liveSavedGap).toBeGreaterThan(4);
  });
  it('I0 confirmed: Android "speed 0 while moving" loses ~45 % of the distance', () => {
    expect(by['android-zero'].distErrPct).toBeGreaterThan(40);
  });
  it('I0 confirmed: the needle is ~2 s late at a hard brake and ~6 km/h off while accelerating', () => {
    expect(by['hard-brake'].brakeLagS!).toBeGreaterThan(1.5);
    expect(by['highway-1hz'].rmseAccel!).toBeGreaterThan(5);
  });
});
