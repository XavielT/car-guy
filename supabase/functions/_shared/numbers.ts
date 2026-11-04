/**
 * Number checks for model-written text (IMP 03112026 SPEC-E §E2, SPEC-G §G9). The model is allowed to WORD facts, never to produce
 * a figure: every number in its text must come from the facts it cites. Shared by `cg-ai-insights` and `cg-ai-sale`.
 * Pure, no imports, so Node can load it in tests exactly as Deno does.
 */

/** Numbers written in a text: "1,234.5", "RD$ 2,580", "38 %", "5.36", also the digits of "2026-11-14". Thousands separators are removed. */
export function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d[\d.,]*/g)) {
    let s = m[0].replace(/[.,]+$/, '');
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    out.push(normNum(s));
  }
  return out;
}

export const normNum = (s: string): string => {
  const n = Number(s);
  return Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : s;
};

/** Every number a record may be quoted with: its numeric values, the numbers inside its strings (dates, DOT codes), and the same rounded. */
export function allowedNumbersOf(records: readonly { data: Record<string, number | string | boolean | null> }[]): Set<string> {
  const ok = new Set<string>();
  const add = (n: number) => {
    ok.add(normNum(String(n)));
    ok.add(normNum(String(Math.round(n))));
    ok.add(normNum(String(Math.round(n * 10) / 10)));
    ok.add(normNum(String(Math.round(n * 100) / 100)));
    ok.add(normNum(String(Math.abs(n))));
  };
  for (const f of records) {
    for (const v of Object.values(f.data)) {
      if (typeof v === 'number') add(v);
      else if (typeof v === 'string') for (const n of numbersIn(v)) ok.add(n);
    }
  }
  return ok;
}

/** The first number in `text` that no record backs, or null when every number is backed. */
export function strayNumberIn(text: string, records: readonly { data: Record<string, number | string | boolean | null> }[]): string | null {
  const ok = allowedNumbersOf(records);
  for (const n of numbersIn(text)) if (!ok.has(n)) return n;
  return null;
}

const FOREIGN_MONEY = /(?:US\s?\$|USD|U\.S\.|d[oó]lar(?:es)?|dollar|euros?|€|£)|\$/i;
/** Any currency other than RD$ (the app's only money). */
export const hasForeignMoney = (s: string) => FOREIGN_MONEY.test(s.replace(/RD\s?\$/gi, ''));
