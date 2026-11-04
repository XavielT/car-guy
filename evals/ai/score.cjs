/**
 * Scoring for the AI evals (IMP 03112026 SPEC-B §B8). Pure, no network: `run.mjs` calls the deployed functions and
 * hands (expected, got) pairs here; `__tests__/ai/evals-score.test.ts` pins the rules.
 *
 * Rules (what counts as right):
 *   · numbers: equal within max(0.01, 0.2 %)  (a receipt total of 2580 vs 2580.0)
 *   · strings: equal after case/accent/space folding
 *   · dates / enums: exact
 *   · {contains: "6 meses"}: the string contains it (for text copied tal cual, where the exact framing is not the point)
 *   · expected `null` means "not in the photo": the model must say null OR give it confidence < 0.6. A confident value
 *     there is a FALSE FILL, the error the form cannot catch (it looks right).
 *   · a field the model skipped counts as null.
 */
const LOW = 0.6;

const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function same(expected, got) {
  if (expected && typeof expected === 'object' && 'contains' in expected) return typeof got === 'string' && fold(got).includes(fold(expected.contains));
  if (typeof expected === 'number') {
    if (typeof got !== 'number') return false;
    return Math.abs(expected - got) <= Math.max(0.01, Math.abs(expected) * 0.002);
  }
  if (typeof expected === 'string') return typeof got === 'string' && fold(expected) === fold(got);
  return expected === got;
}

/** One field → 'correct' | 'wrong' | 'false_fill' | 'missed' | 'correct_null'. */
function judge(expected, field) {
  const value = field && field.value !== undefined ? field.value : null;
  const confidence = field && typeof field.confidence === 'number' ? field.confidence : 0;
  if (expected === null) return value === null || confidence < LOW ? 'correct_null' : 'false_fill';
  if (value === null) return 'missed';
  return same(expected, value) ? 'correct' : 'wrong';
}

/** expected: {field: value|null}; got: {field: {value, confidence}} → per-field verdicts. */
function scoreCase(expected, got) {
  const verdicts = {};
  for (const [k, v] of Object.entries(expected)) verdicts[k] = { verdict: judge(v, got ? got[k] : null), confidence: got && got[k] ? got[k].confidence ?? 0 : 0 };
  return verdicts;
}

/**
 * cases: [{id, kind, critical?: string[], verdicts}] → the report numbers.
 *   accuracy      correct / (correct + wrong + missed)   over fields that ARE in the photo
 *   falseFillRate false_fill / (false_fill + correct_null) over fields that are NOT in the photo
 *   confident     accuracy among fields the model was ≥ 0.6 sure of (what the form shows without an "unsure" mark)
 *   critical      accuracy over the fields a wrong value would hurt most (total, odometer, date…) — must stay ≥ the bar
 */
function summarize(cases) {
  const tally = { correct: 0, wrong: 0, missed: 0, false_fill: 0, correct_null: 0 };
  const conf = { correct: 0, wrong: 0 };
  const crit = { correct: 0, total: 0 };
  const perField = {};
  for (const c of cases) {
    for (const [field, { verdict, confidence }] of Object.entries(c.verdicts)) {
      tally[verdict]++;
      if (verdict === 'correct' || verdict === 'wrong') {
        if (confidence >= LOW) conf[verdict]++;
        perField[field] ??= { correct: 0, n: 0 };
        perField[field].n++;
        if (verdict === 'correct') perField[field].correct++;
      }
      if ((c.critical || []).includes(field) && verdict !== 'correct_null') {
        crit.total++;
        if (verdict === 'correct') crit.correct++;
      }
    }
  }
  const ratio = (a, b) => (b === 0 ? null : a / b);
  return {
    fields: tally.correct + tally.wrong + tally.missed,
    accuracy: ratio(tally.correct, tally.correct + tally.wrong + tally.missed),
    falseFillRate: ratio(tally.false_fill, tally.false_fill + tally.correct_null),
    confidentAccuracy: ratio(conf.correct, conf.correct + conf.wrong),
    criticalAccuracy: ratio(crit.correct, crit.total),
    tally,
    perField,
  };
}

/** Intent cases: the target must match exactly; then the listed fields as in `scoreCase`. */
function scoreIntent(expected, got) {
  const targetOk = got && got.target === expected.target;
  const verdicts = scoreCase(expected.fields || {}, got ? got.fields : null);
  return { targetOk: Boolean(targetOk), verdicts };
}

module.exports = { LOW, fold, same, judge, scoreCase, summarize, scoreIntent };
