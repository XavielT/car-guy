/**
 * IMP 03112026 SPEC-B §B8: the eval fixtures are consistent with the functions they test. A typo in an expected field
 * would score a correct read as a miss (or the reverse), so the manifest is checked against the real field lists.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { FIELDS as INTENT_FIELDS, TARGETS } from '../../supabase/functions/cg-ai-intent/intents';
import { normalizeCode as obdNormalize } from '../../supabase/functions/cg-ai-obd/obd';
import { safetyFloor } from '../../supabase/functions/cg-ai-obd/safety';
import { KINDS } from '../../supabase/functions/cg-ai-read/kinds';

const root = join(__dirname, '../../evals/ai');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const manifest = require('../../evals/ai/fixtures/manifest.json') as { cases: { id: string; kind: string; images: string[]; critical: string[]; expected: Record<string, unknown> }[] };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const intents = require('../../evals/ai/fixtures/intents.json') as { context: { features: string[] }; cases: { id: string; text: string; expected: { target: string; fields: Record<string, unknown> } }[] };

describe('read fixtures', () => {
  it('ids are unique and every image exists', () => {
    const ids = manifest.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of manifest.cases) for (const img of c.images) expect(existsSync(join(root, 'fixtures', img))).toBe(true);
  });
  it.each(manifest.cases.map((c) => [c.id, c] as const))('%s: the kind exists, the image count fits it, expected fields are real', (_id, c) => {
    const kind = KINDS[c.kind];
    expect(kind).toBeDefined();
    expect(c.images.length).toBeGreaterThan(0);
    expect(c.images.length).toBeLessThanOrEqual(kind.maxImages);
    const allowed = new Set([...Object.keys(kind.fields), ...(kind.items ? ['items_count'] : [])]);
    for (const k of Object.keys(c.expected)) expect(allowed.has(k)).toBe(true);
    for (const k of c.critical) expect(k in c.expected).toBe(true);
  });
  it('covers every kind the forms use, and has cases where the answer is "not in the photo"', () => {
    const kinds = new Set(manifest.cases.map((c) => c.kind));
    for (const k of ['fuel_receipt', 'odometer', 'invoice', 'fuel_express']) expect(kinds.has(k)).toBe(true);
    const nulls = manifest.cases.flatMap((c) => Object.values(c.expected)).filter((v) => v === null);
    expect(nulls.length).toBeGreaterThanOrEqual(4);
  });
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const docs = require('../../evals/ai/documents.json') as { cases: { id: string; kind: string; images: string[]; critical: string[]; forbidden: string[]; expected: Record<string, unknown> }[] };

describe('document fixtures (PROMPT-03)', () => {
  it('ids are unique and every image exists', () => {
    const ids = docs.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of docs.cases) for (const img of c.images) expect(existsSync(join(root, 'fixtures', img))).toBe(true);
  });
  it.each(docs.cases.map((c) => [c.id, c] as const))('%s: a privacy kind, expected fields are real, critical fields are expected', (_id, c) => {
    const kind = KINDS[c.kind];
    expect(kind?.privacy).toBe(true);
    expect(c.images.length).toBeLessThanOrEqual(kind.maxImages);
    for (const k of Object.keys(c.expected)) expect(k in kind.fields).toBe(true);
    for (const k of c.critical) expect(k in c.expected).toBe(true);
  });
  it('the personal papers forbid the fake cédula, owner and address (and no forbidden value is also an expected one)', () => {
    const personal = docs.cases.filter((c) => ['doc-matricula', 'doc-seguro', 'doc-licencia'].includes(c.id));
    expect(personal).toHaveLength(3);
    for (const c of personal) {
      expect(c.forbidden).toEqual(expect.arrayContaining(['001-1234567-8', 'JUAN']));
      const wanted = JSON.stringify(c.expected).toLowerCase();
      for (const x of c.forbidden) expect(wanted).not.toContain(x.toLowerCase());
    }
  });
  it('covers every document kind, a JDM frame number, and fields that are NOT on the paper', () => {
    const kinds = new Set(docs.cases.map((c) => (c.expected.doc_kind as string | undefined) ?? c.kind));
    for (const k of ['matricula', 'seguro', 'marbete', 'licencia', 'revision', 'garantia', 'vin_plate']) expect(kinds.has(k)).toBe(true);
    expect(docs.cases.some((c) => c.expected.vin === 'AE85-5012345')).toBe(true);
    expect(docs.cases.flatMap((c) => Object.values(c.expected)).filter((v) => v === null).length).toBeGreaterThanOrEqual(5);
  });
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const obd = require('../../evals/ai/obd.json') as { vehicles: Record<string, unknown>; cases: { id: string; codes: string[]; vehicle: string; history?: { repairs?: unknown[]; sameCode?: unknown[] }; expect: { safety?: boolean; canDrive: string[]; historyCited?: boolean; recentlyRepaired?: boolean } }[] };

describe('OBD fixtures (PROMPT-04, SPEC-D §D6)', () => {
  it('has 25 cases with unique ids, valid codes and known cars', () => {
    expect(obd.cases).toHaveLength(25);
    expect(new Set(obd.cases.map((c) => c.id)).size).toBe(25);
    for (const c of obd.cases) {
      expect(obd.vehicles[c.vehicle]).toBeDefined();
      for (const code of c.codes) expect(obdNormalize(code)).toBe(code);
    }
  });
  it("SAFETY: a case is flagged safety exactly when the server's own table has a floor for its codes, and a flagged case never accepts 'yes'", () => {
    for (const c of obd.cases) {
      const floor = safetyFloor(c.codes);
      expect([c.id, Boolean(c.expect.safety)]).toEqual([c.id, floor != null]);
      if (floor) {
        expect(c.expect.canDrive).not.toContain('yes');
        if (floor.floor === 'no') expect(c.expect.canDrive).toEqual(['no']);
      }
    }
  });
  it('every case that demands the history cited was given some history', () => {
    for (const c of obd.cases.filter((x) => x.expect.historyCited || x.expect.recentlyRepaired)) {
      expect((c.history?.repairs?.length ?? 0) + (c.history?.sameCode?.length ?? 0)).toBeGreaterThan(0);
    }
  });
  it('covers the SPEC-D list: generic, safety, mixed, JDM, repeat-after-repair, injection', () => {
    const ids = obd.cases.map((c) => c.id).join(' ');
    for (const k of ['p0300', 'p0420', 'p0171', 'p0128', 'c0035', 'b0010', 'u0100', 'mixed', 'jdm', 'repeat-after', 'injection']) expect(ids).toContain(k);
  });
});

describe('intent fixtures', () => {
  it('ids are unique, targets are in the closed list, expected fields are real', () => {
    const ids = intents.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of intents.cases) {
      expect((TARGETS as readonly string[]).includes(c.expected.target)).toBe(true);
      for (const k of Object.keys(c.expected.fields)) expect(k in INTENT_FIELDS).toBe(true);
    }
  });
  it('navigate cases only name sections the context offers', () => {
    for (const c of intents.cases.filter((x) => x.expected.target === 'navigate')) {
      expect(intents.context.features).toContain(c.expected.fields.navigate_to);
    }
  });
  it('has the traps: several cars, nothing invented, every target', () => {
    expect(intents.cases.some((c) => c.id === 'two-cars-ambiguous')).toBe(true);
    expect(intents.cases.filter((c) => c.id.startsWith('no-invent')).length).toBeGreaterThanOrEqual(2);
    const targets = new Set(intents.cases.map((c) => c.expected.target));
    for (const t of TARGETS) expect(targets.has(t)).toBe(true);
  });
});
