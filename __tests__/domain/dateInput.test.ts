/**
 * The purchase date drifted one day back every time the vehicle editor was opened and saved (found by the ADR-63
 * round-trip test): the form stores "YYYY-MM-DD", the editor read it as a UTC instant.
 */
process.env.TZ = 'America/Santo_Domingo';

import { dateInputFromIso, isoFromDateInput } from '@/lib/format';

describe('dateInputFromIso', () => {
  it('a date-only value is already the day to show', () => {
    expect(dateInputFromIso('2020-03-15')).toBe('2020-03-15');
  });

  it('opening and saving the editor again and again never moves the day', () => {
    let day = '2020-03-15';
    for (let i = 0; i < 5; i++) day = dateInputFromIso(day);
    expect(day).toBe('2020-03-15');
  });

  it('a full instant is still shown as the local calendar day', () => {
    expect(dateInputFromIso(isoFromDateInput('2026-10-16'))).toBe('2026-10-16');
    // 02:00 UTC is still the evening before in Santo Domingo (UTC-4).
    expect(dateInputFromIso('2026-10-16T02:00:00.000Z')).toBe('2026-10-15');
  });
});
