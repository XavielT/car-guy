/**
 * IMP 03112026 SPEC-B §B8: the rules the evals judge by. If these drift, an accuracy number means something else.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkObd, judge, same, scoreCase, scoreIntent, summarize } = require('../../evals/ai/score.cjs');

const f = (value: unknown, confidence = 0.9) => ({ value, confidence });

describe('same', () => {
  it('numbers within 0.2 % or 0.01', () => {
    expect(same(2580, 2580)).toBe(true);
    expect(same(2580, 2583)).toBe(true); // 0.12 %
    expect(same(2580, 2600)).toBe(false);
    expect(same(0.5, 0.505)).toBe(true);
  });
  it('strings fold case, accents and spaces', () => {
    expect(same('Taller Díaz', 'taller  diaz')).toBe(true);
    expect(same('Shell', 'Texaco')).toBe(false);
  });
  it('{contains} matches a substring after folding', () => {
    expect(same({ contains: '6 meses' }, 'Garantía: 6 MESES o 10,000 km')).toBe(true);
    expect(same({ contains: '6 meses' }, '3 meses')).toBe(false);
    expect(same({ contains: '6 meses' }, null)).toBe(false);
  });
  it('a number is never equal to its string', () => {
    expect(same(84830, '84830')).toBe(false);
  });
});

describe('judge', () => {
  it('right, wrong, missed', () => {
    expect(judge(84830, f(84830))).toBe('correct');
    expect(judge(84830, f(84380))).toBe('wrong');
    expect(judge(84830, f(null, 0))).toBe('missed');
    expect(judge(84830, undefined)).toBe('missed');
  });
  it('expected null: null or an unsure value is fine; a CONFIDENT value is a false fill', () => {
    expect(judge(null, f(null, 0))).toBe('correct_null');
    expect(judge(null, f('B0100000001', 0.3))).toBe('correct_null');
    expect(judge(null, f('B0100000001', 0.9))).toBe('false_fill');
    expect(judge(null, undefined)).toBe('correct_null');
  });
});

describe('summarize', () => {
  const cases = [
    { id: 'a', critical: ['total'], verdicts: scoreCase({ total: 2580, gallons: 7.5, ncf: null }, { total: f(2580), gallons: f(7.4, 0.5), ncf: f('B0100000009', 0.95) }) },
    { id: 'b', critical: ['total'], verdicts: scoreCase({ total: 1000, gallons: 3 }, { total: f(1000, 0.4), gallons: f(null, 0) }) },
  ];
  const s = summarize(cases);
  it('counts fields that are in the photo, and false fills separately', () => {
    expect(s.tally).toMatchObject({ correct: 2, wrong: 1, missed: 1, false_fill: 1, correct_null: 0 });
    expect(s.accuracy).toBeCloseTo(2 / 4);
    expect(s.falseFillRate).toBeCloseTo(1);
  });
  it('confident accuracy ignores what the model itself marked unsure', () => {
    // total 2580 (0.9) correct; gallons 7.4 (0.5, unsure, wrong, ignored); total 1000 (0.4 unsure, correct, ignored)
    expect(s.confidentAccuracy).toBeCloseTo(1);
  });
  it('critical accuracy covers only the listed fields', () => {
    expect(s.criticalAccuracy).toBeCloseTo(1);
  });
  it('empty input has no ratios instead of NaN', () => {
    const e = summarize([]);
    expect(e.accuracy).toBeNull();
    expect(e.falseFillRate).toBeNull();
  });
});

describe('scoreIntent', () => {
  it('the target must match, then the listed fields', () => {
    const r = scoreIntent({ target: 'fuel', fields: { gallons: 12 } }, { target: 'fuel', fields: { gallons: f(12) } });
    expect(r.targetOk).toBe(true);
    expect(r.verdicts.gallons.verdict).toBe('correct');
    expect(scoreIntent({ target: 'fuel', fields: {} }, { target: 'expense', fields: {} }).targetOk).toBe(false);
    expect(scoreIntent({ target: 'fuel', fields: {} }, null).targetOk).toBe(false);
  });
});

describe('checkObd — the SPEC-D §D6 assertions', () => {
  const cause = (over: Record<string, unknown> = {}) => ({ title: 'Catalizador gastado', likelihood: 'probable', why: 'Por el uso.', parts: ['catalizador'], diy_or_shop: 'shop', cost_rd: { min: 18000, max: 42000 }, recently_repaired: false, ...over });
  const ok = (over: Record<string, unknown> = {}) => ({ can_drive: 'careful', causes: [cause()], first_checks: ['Revisa el escape'], history_note: null, ...over });

  it('a good answer passes', () => {
    expect(checkObd({ canDrive: ['yes', 'careful'] }, ok())).toEqual([]);
  });
  it('can_drive outside the accepted set fails (a safety code answered "yes")', () => {
    expect(checkObd({ canDrive: ['careful', 'no'], safety: true }, ok({ can_drive: 'yes' }))[0]).toMatch(/not in \[careful, no\]/);
  });
  it('a bad shape fails', () => {
    expect(checkObd({ canDrive: ['yes'] }, ok({ can_drive: 'maybe' })).length).toBeGreaterThan(0);
    expect(checkObd({ canDrive: ['careful'] }, ok({ causes: [] })).join()).toMatch(/at least one cause/);
    expect(checkObd({ canDrive: ['careful'] }, ok({ first_checks: 'x' })).join()).toMatch(/first_checks/);
    expect(checkObd({ canDrive: ['careful'] }, null)).toEqual(['no answer']);
  });
  it('any dollar, euro or USD figure fails; RD$ passes', () => {
    expect(checkObd({}, ok({ causes: [cause({ why: 'Cuesta US$ 600' })] })).join()).toMatch(/foreign-currency/);
    expect(checkObd({}, ok({ causes: [cause({ why: 'Unos $300' })] })).join()).toMatch(/foreign-currency/);
    expect(checkObd({}, ok({ causes: [cause({ why: 'Cuesta RD$ 18,000 a RD$ 42,000' })] }))).toEqual([]);
  });
  it('an invented part number fails; a common name passes', () => {
    expect(checkObd({}, ok({ causes: [cause({ parts: ['NGK-ZFR6F-11'] })] })).join()).toMatch(/invented part number/);
    expect(checkObd({}, ok({ causes: [cause({ parts: ['bobina del cilindro 3'] })] }))).toEqual([]);
  });
  it('causeMatches, historyCited and recentlyRepaired are enforced when asked', () => {
    expect(checkObd({ causeMatches: 'catal' }, ok())).toEqual([]);
    expect(checkObd({ causeMatches: 'termostato' }, ok()).join()).toMatch(/no cause matches/);
    expect(checkObd({ historyCited: true }, ok()).join()).toMatch(/did not cite the history/);
    expect(checkObd({ historyCited: true }, ok({ history_note: 'Salió en marzo.' }))).toEqual([]);
    expect(checkObd({ recentlyRepaired: true }, ok()).join()).toMatch(/recently_repaired/);
    expect(checkObd({ recentlyRepaired: true }, ok({ causes: [cause({ recently_repaired: true })] }))).toEqual([]);
  });
});
