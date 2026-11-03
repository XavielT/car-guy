/**
 * Field specs and the validator shared by every `cg-*` function that turns model output into typed values
 * (cg-ai-read, cg-ai-intent). The validator, not the model, decides what is acceptable: ranges, formats, enums.
 * A value that fails becomes null with confidence 0 (never "fixed"): the person types it (ADR-67).
 */
export type FieldType = 'number' | 'string' | 'date' | 'time' | 'enum' | 'fraction';
export type FieldSpec = {
  type: FieldType;
  desc: string;
  min?: number;
  max?: number;
  /** For 'enum'. */
  values?: readonly string[];
  /** For 'string': a post-validation format; a value that does not match becomes null. Applied after `clean`. */
  pattern?: RegExp;
  /** For 'string': normalise before the pattern (e.g. digits only, upper-case). */
  clean?: (s: string) => string;
  maxLen?: number;
};

export type Field = { value: string | number | null; confidence: number };
const EMPTY: Field = { value: null, confidence: 0 };
const clamp01 = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

function validDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** One raw { value, confidence } → a validated Field. Anything out of range, malformed or unconfident becomes null/0. */
export function normalizeField(raw: unknown, spec: FieldSpec): Field {
  if (!raw || typeof raw !== 'object') return { ...EMPTY };
  const r = raw as { value?: unknown; confidence?: unknown };
  const confidence = clamp01(r.confidence);
  let v = r.value;
  if (v === null || v === undefined || v === '') return { ...EMPTY };

  switch (spec.type) {
    case 'number':
    case 'fraction': {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^\d.-]/g, '')) : NaN;
      if (!Number.isFinite(n)) return { ...EMPTY };
      const lo = spec.type === 'fraction' ? 0 : spec.min ?? -Infinity;
      const hi = spec.type === 'fraction' ? 1 : spec.max ?? Infinity;
      if (n < lo || n > hi) return { ...EMPTY };
      return { value: Math.round(n * 1000) / 1000, confidence };
    }
    case 'date':
      return typeof v === 'string' && validDate(v.trim()) ? { value: v.trim(), confidence } : { ...EMPTY };
    case 'time': {
      if (typeof v !== 'string') return { ...EMPTY };
      const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
      return m ? { value: `${m[1].padStart(2, '0')}:${m[2]}`, confidence } : { ...EMPTY };
    }
    case 'enum': {
      const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
      return spec.values?.includes(s) ? { value: s, confidence } : { ...EMPTY };
    }
    case 'string': {
      if (typeof v !== 'string' && typeof v !== 'number') return { ...EMPTY };
      let s = String(v).trim();
      if (spec.clean) s = spec.clean(s);
      if (!s) return { ...EMPTY };
      if (spec.pattern && !spec.pattern.test(s)) return { ...EMPTY };
      if (spec.maxLen && s.length > spec.maxLen) s = s.slice(0, spec.maxLen);
      return { value: s, confidence };
    }
  }
  return { ...EMPTY };
}

