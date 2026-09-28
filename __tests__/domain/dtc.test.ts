import {
  allCodes,
  describe as describeCode,
  isManufacturerSpecific,
  lookup,
  normalizeCode,
} from '@/lib/domain/dtc';
import overrides from '@/tools/data/dtc-overrides.json';

/**
 * The DTC table is generated data shipped in the bundle, so these tests guard
 * the properties a UI would silently break on: a row with no Spanish text, a
 * duplicate code, or a system slug the screens do not know how to label.
 */

describe('normalizeCode', () => {
  it('trims and upper-cases', () => {
    expect(normalizeCode('p0301')).toBe('P0301');
    expect(normalizeCode('  u0100 ')).toBe('U0100');
    expect(normalizeCode('C1a2F')).toBe('C1A2F');
  });

  it('rejects malformed codes', () => {
    expect(normalizeCode('')).toBeNull();
    expect(normalizeCode('P030')).toBeNull();
    expect(normalizeCode('P03011')).toBeNull();
    expect(normalizeCode('X0301')).toBeNull();
    expect(normalizeCode('P4301')).toBeNull();
    expect(normalizeCode('P0G01')).toBeNull();
  });
});

describe('lookup', () => {
  it('finds P0301 as the cylinder 1 misfire', () => {
    const hit = lookup('p0301');
    expect(hit).not.toBeNull();
    expect(hit?.code).toBe('P0301');
    expect(hit?.descEs).toMatch(/cilindro 1\b/i);
    expect(hit?.system).toBe('motor');
  });

  it('flags P0xxx as generic and P1xxx as manufacturer', () => {
    expect(lookup('P0100')?.isGeneric).toBe(true);
    const p1 = allCodes().find((r) => r.code.startsWith('P1'));
    expect(p1).toBeDefined();
    expect(p1?.isGeneric).toBe(false);
  });

  it('is null for malformed input', () => {
    expect(lookup('hello')).toBeNull();
  });
});

/**
 * The source CSV is shifted for most generic P0 codes; these are the codes people
 * actually see on a scanner, pinned to their SAE J2012 meaning by the overrides.
 */
describe('SAE overrides for common generic codes', () => {
  it('P0300 is the random/multiple misfire', () => {
    expect(lookup('P0300')?.descEs).toMatch(/aleatorio/i);
    expect(lookup('P0300')?.descEn).toBe('Random/Multiple Cylinder Misfire Detected');
  });

  it('P0301 is cylinder 1, P0302 is cylinder 2', () => {
    expect(lookup('P0301')?.descEs).toMatch(/cilindro 1$/);
    expect(lookup('P0302')?.descEs).toMatch(/cilindro 2$/);
  });

  it('P0420 is catalyst efficiency, bank 1', () => {
    const es = lookup('P0420')?.descEs ?? '';
    expect(es).toMatch(/catalizador/i);
    expect(es).toMatch(/banco 1/);
  });

  it('P0171 is lean, bank 1', () => {
    const es = lookup('P0171')?.descEs ?? '';
    expect(es).toMatch(/pobre/i);
    expect(es).toMatch(/banco 1/);
  });

  it('P0442 is a small EVAP leak', () => {
    const es = lookup('P0442')?.descEs ?? '';
    expect(es).toMatch(/EVAP/);
    expect(es).toMatch(/fuga pequeña/i);
  });

  it('P0700 is the transmission control system', () => {
    expect(lookup('P0700')?.descEs).toMatch(/transmisión/i);
  });

  it('never gives two overridden codes the same Spanish text', () => {
    const overridden = Object.keys(overrides);
    expect(overridden.length).toBeGreaterThan(300);
    const texts = overridden.map((code) => lookup(code)?.descEs);
    for (const t of texts) expect(t).toBeTruthy();
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('ships every overridden row with its hand-written text', () => {
    for (const [code, ov] of Object.entries(overrides)) {
      expect(lookup(code)?.descEs).toBe(ov.descEs);
      expect(lookup(code)?.descEn).toBe(ov.descEn);
    }
  });
});

describe('isManufacturerSpecific', () => {
  it('follows the second-character rule', () => {
    expect(isManufacturerSpecific('P0301')).toBe(false);
    expect(isManufacturerSpecific('P1999')).toBe(true);
    expect(isManufacturerSpecific('P3400')).toBe(true);
    expect(isManufacturerSpecific('P2A00')).toBe(false);
    expect(isManufacturerSpecific('B1000')).toBe(true);
    expect(isManufacturerSpecific('C2000')).toBe(true);
    expect(isManufacturerSpecific('U0100')).toBe(false);
    expect(isManufacturerSpecific('U3000')).toBe(false);
  });

  it('agrees with the table for every row', () => {
    for (const row of allCodes()) {
      expect(isManufacturerSpecific(row.code)).toBe(!row.isGeneric);
    }
  });
});

describe('describe', () => {
  it('returns the Spanish description when known', () => {
    expect(describeCode('P0301')).toBe(lookup('P0301')?.descEs);
  });

  it('explains an unknown manufacturer code instead of failing', () => {
    expect(lookup('P1FFF')).toBeNull();
    expect(describeCode('P1FFF')).toBe('Código específico del fabricante');
  });

  it('says not found for an unknown generic or malformed code', () => {
    expect(lookup('P0FFF')).toBeNull();
    expect(describeCode('P0FFF')).toBe('Código no encontrado en la tabla');
    expect(describeCode('nope')).toBe('Código no encontrado en la tabla');
  });
});

describe('table integrity', () => {
  const rows = allCodes();

  it('has at least 3000 rows', () => {
    expect(rows.length).toBeGreaterThanOrEqual(3000);
  });

  it('has unique, well-formed codes', () => {
    const codes = rows.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(normalizeCode(c)).toBe(c);
  });

  it('gives every row non-empty English and Spanish text', () => {
    for (const r of rows) {
      expect(r.descEn.trim()).not.toBe('');
      expect(r.descEs.trim()).not.toBe('');
    }
  });

  it('uses only the four system slugs, matching the first letter', () => {
    const bySlug = { P: 'motor', B: 'carroceria', C: 'chasis', U: 'red' } as const;
    for (const r of rows) {
      expect(r.system).toBe(bySlug[r.code[0] as keyof typeof bySlug]);
    }
  });
});
